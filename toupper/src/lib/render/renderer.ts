import type { Drawing, InstructionBox } from "$lib/drinfo";
import type { InProgressEntry } from "$lib/state.svelte";
import { SvelteMap } from "svelte/reactivity";
import { applyInstruction, resumeStroke, type StrokeResumeState } from "./instruction";
import { v4 as uuid } from "uuid";

export type SnapshotCallback = (layer: string, data: string, index: number) => void;

const SNAPSHOT_INTERVAL = 20;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly drawing: Drawing;
  readonly imageCache = new SvelteMap<string, HTMLImageElement>();
  // Layer => UUID => entry
  private inProgress: Map<string, Map<string, InProgressEntry>>;
  // Layer => History index => data
  private layerHistoryCanvases = new SvelteMap<
    string,
    Map<number, { canvas: OffscreenCanvas; renderID: string }>
  >();
  // Persistent scratch canvas per layer: history + everything stamped for in-progress
  // entries. Kept across renders so strokes can be resumed with only the new tail.
  private scratchCanvases = new Map<string, OffscreenCanvas>();
  // renderID of the history canvas the scratch was last built from. A mismatch forces
  // a reinit (history advanced, snapshot swapped, resize, invalidateFrom, etc.).
  private scratchSourceRenderID = new Map<string, string>();
  // Layer => UUID => resume state, only for strokes/erasers.
  private strokeResumeStates = new Map<string, Map<string, StrokeResumeState>>();
  // Layer => UUID => hash of instruction at time of last render
  private inProgressHashes = new Map<string, Map<string, string>>();
  private onSnapshot?: SnapshotCallback;
  private lastRenderMetadataHash: string = "";

  constructor(
    canvas: HTMLCanvasElement,
    drawing: Drawing,
    inProgress: Map<string, Map<string, InProgressEntry>>,
    onSnapshot?: SnapshotCallback,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.drawing = drawing;
    this.inProgress = inProgress;
    this.onSnapshot = onSnapshot;
  }

  async render(): Promise<void> {
    let updates = false;
    for (const [layerName, layer] of this.drawing.layers) {
      if (!layer.visible) continue;
      if (!this.layerHistoryCanvases.get(layerName)?.has(layer.historyIndex)) {
        updates = true;
        break;
      }
    }
    if (!updates) {
      updates = this.inProgressChanged();
    }
    const drawingMetadataHash = this.getDrawingMetadataHash();
    if (this.lastRenderMetadataHash != drawingMetadataHash) {
      updates = true;
    }
    if (!updates) return;
    const w = this.drawing.width;
    const h = this.drawing.height;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;

    this.ctx.clearRect(0, 0, w, h);

    for (const layerName of this.drawing.layerOrder) {
      const layer = this.drawing.layers.get(layerName);
      if (!layer || !layer.visible) continue;

      await this.ensureLayerContext(layerName, layer.historyIndex);
      const historyCanvas = this.getCanvas(layerName, layer.historyIndex);
      const historyRenderID =
        this.layerHistoryCanvases.get(layerName)?.get(layer.historyIndex)?.renderID ?? "";
      const inProgress = this.inProgress.get(layerName);

      const scratch = this.getScratchFor(
        layerName,
        historyCanvas,
        historyRenderID,
        inProgress,
        w,
        h,
      );
      const scratchCtx = scratch.getContext("2d")!;

      if (inProgress) {
        const states = this.strokeResumeStates.get(layerName) ?? new Map();
        for (const [uuid, entry] of inProgress) {
          if (!entry.instructionBox.applied) continue;
          const instruction = entry.instructionBox.instruction;
          if ("points" in instruction) {
            const prev = states.get(uuid);
            const newLen = instruction.points.length;
            if (prev && newLen === prev.pointCount) {
              // Stroke unchanged since last render; already baked into scratch.
              continue;
            }
            if (prev && newLen > prev.pointCount) {
              // Append-only: resume from stored state.
              const next = resumeStroke(instruction, scratchCtx, prev);
              states.set(uuid, next);
            } else {
              // First render, or scratch was just reinit'd (so prev state is stale).
              // Re-stamp from the path origin onto the fresh scratch.
              const next = resumeStroke(instruction, scratchCtx, {
                lastDrawDistance: 0,
                segmentIndex: 0,
                segmentStartDistance: 0,
                pointCount: 0,
              });
              states.set(uuid, next);
            }
          } else {
            // Non-stroke instructions always force a reinit (handled in getScratchFor),
            // so the scratch is freshly built from history here; apply once for this frame.
            await applyInstruction(instruction, scratchCtx, this.imageCache);
          }
        }
        this.strokeResumeStates.set(layerName, states);
      }

      this.ctx.drawImage(scratch, 0, 0);
    }

    this.lastRenderMetadataHash = drawingMetadataHash;
    this.storeInProgressHashes();
  }

  getPNG(): string {
    return this.canvas.toDataURL("image/png");
  }

  getLayerCanvas(layer: string): { canvas: OffscreenCanvas; renderID: string } | undefined {
    const historyIndex = this.drawing.layers.get(layer)?.historyIndex;
    if (historyIndex === undefined) return undefined;
    return this.layerHistoryCanvases.get(layer)?.get(historyIndex);
  }

  invalidateFrom(layer: string, index: number): void {
    const layerHistory = this.layerHistoryCanvases.get(layer);
    if (!layerHistory) return;
    const keysToDelete = [];
    for (const key of layerHistory.keys()) {
      if (key >= index) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      layerHistory.delete(key);
    }
    // History will be rebuilt with new renderIDs on next ensureLayerContext, so the
    // existing scratch is no longer backed by the right history canvas.
    this.scratchCanvases.delete(layer);
    this.scratchSourceRenderID.delete(layer);
    this.strokeResumeStates.delete(layer);
  }

  private getScratchFor(
    layerName: string,
    historyCanvas: OffscreenCanvas | null,
    historyRenderID: string,
    inProgress: Map<string, InProgressEntry> | undefined,
    w: number,
    h: number,
  ): OffscreenCanvas {
    const existing = this.scratchCanvases.get(layerName);
    let needsReinit = false;
    if (!existing || existing.width !== w || existing.height !== h) needsReinit = true;
    if (this.scratchSourceRenderID.get(layerName) !== historyRenderID) needsReinit = true;

    // Non-stroke in-progress entries can't be incrementally resumed (meeting a being-moved
    // selection, a freshly filled bucket, etc.), so they force a full redraw from history.
    // Also detect non-append stroke mutations: any stroke whose point count went *down*
    // means the path was replaced, not appended — re-stamping onto the existing scratch
    // would double-stamp, so we reinit.
    if (inProgress && !needsReinit) {
      const states = this.strokeResumeStates.get(layerName);
      for (const [uuid, entry] of inProgress) {
        if (!entry.instructionBox.applied) continue;
        const instruction = entry.instructionBox.instruction;
        if ("points" in instruction) {
          const prev = states?.get(uuid);
          if (prev && instruction.points.length < prev.pointCount) {
            needsReinit = true;
            break;
          }
        } else {
          needsReinit = true;
          break;
        }
      }
    }

    if (!needsReinit) return existing!;

    const canvas =
      existing && existing.width === w && existing.height === h
        ? existing
        : new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    if (historyCanvas) ctx.drawImage(historyCanvas, 0, 0);
    this.scratchCanvases.set(layerName, canvas);
    this.scratchSourceRenderID.set(layerName, historyRenderID);
    // Scratch was rebuilt from history; any prior stroke resume states are stale.
    this.strokeResumeStates.set(layerName, new Map());
    return canvas;
  }

  private getDrawingMetadataHash(): string {
    const layerVisibility = [...this.drawing.layers.values().map((l) => (l.visible ? "1" : "0"))];
    const layerOrder = this.drawing.layerOrder;
    return layerOrder.join(" - ") + " " + layerVisibility.join("");
  }

  private getCanvas(layerName: string, index: number): OffscreenCanvas | null {
    return this.layerHistoryCanvases.get(layerName)?.get(index)?.canvas ?? null;
  }

  private async ensureLayerContext(layerName: string, targetIndex: number): Promise<void> {
    let contexts = this.layerHistoryCanvases.get(layerName);
    if (!contexts) {
      contexts = new SvelteMap();
      this.layerHistoryCanvases.set(layerName, contexts);
    }

    if (contexts.has(targetIndex)) return;

    const w = this.drawing.width;
    const h = this.drawing.height;

    if (!contexts.has(0)) {
      const ctx = new OffscreenCanvas(w, h).getContext("2d")!;
      contexts.set(0, { canvas: ctx.canvas, renderID: uuid() });
    }

    if (targetIndex === 0) return;

    const layer = this.drawing.layers.get(layerName);
    if (!layer) return;

    let currentIndex = this.findClosestContext(contexts, targetIndex);

    const snapshot = this.drawing.getSnapshotBefore(layerName, targetIndex);
    if (snapshot && snapshot[0] > currentIndex && snapshot[0] <= targetIndex) {
      const image = await this.loadImage(snapshot[1]);
      const ctx = new OffscreenCanvas(w, h).getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0);
      contexts.set(snapshot[0], { canvas: ctx.canvas, renderID: uuid() });
      currentIndex = snapshot[0];
    }

    await this.replayInstructions(
      layerName,
      layer.history,
      currentIndex,
      targetIndex,
      contexts,
      w,
      h,
    );
  }

  private async replayInstructions(
    layerName: string,
    history: InstructionBox[],
    from: number,
    to: number,
    contexts: Map<number, { canvas: OffscreenCanvas; renderID: string }>,
    w: number,
    h: number,
  ): Promise<void> {
    let current = from;

    for (let i = from; i < to; i++) {
      const instructionBox = history[i];
      if (!instructionBox) break;

      const prevContext = contexts.get(current)!;
      const newCanvas = new OffscreenCanvas(w, h);
      const newCtx = newCanvas.getContext("2d")!;
      newCtx.drawImage(prevContext.canvas, 0, 0);

      if (instructionBox.applied) {
        await applyInstruction(instructionBox.instruction, newCtx, this.imageCache);
      }

      current++;

      for (const key of contexts.keys()) {
        if (key > current) {
          contexts.delete(key);
        }
      }

      contexts.set(current, { canvas: newCanvas, renderID: uuid() });

      if (current % SNAPSHOT_INTERVAL === 0 && this.onSnapshot) {
        const blob = await newCanvas.convertToBlob();
        const data = await this.blobToDataUrl(blob);
        this.onSnapshot(layerName, data, current);
      }
    }
  }

  private findClosestContext(
    contexts: Map<number, { canvas: OffscreenCanvas; renderID: string }>,
    target: number,
  ): number {
    let closest = 0;
    for (const index of contexts.keys()) {
      if (index > closest && index <= target) {
        closest = index;
      }
    }
    return closest;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private hashInstruction(box: InstructionBox): string {
    return JSON.stringify(box.instruction) + (box.applied ? "1" : "0");
  }

  private inProgressChanged(): boolean {
    for (const [layerName, inProgress] of this.inProgress) {
      const layerHashes = this.inProgressHashes.get(layerName);
      if (!layerHashes) {
        if (inProgress.size > 0) return true;
        continue;
      }
      for (const [uuid, entry] of inProgress) {
        const storedHash = layerHashes.get(uuid);
        if (!storedHash || storedHash !== this.hashInstruction(entry.instructionBox)) {
          return true;
        }
      }
      for (const uuid of layerHashes.keys()) {
        if (!inProgress.has(uuid)) {
          return true;
        }
      }
    }
    for (const layerName of this.inProgressHashes.keys()) {
      if (!this.inProgress.has(layerName)) {
        return true;
      }
    }
    return false;
  }

  private storeInProgressHashes(): void {
    this.inProgressHashes.clear();
    for (const [layerName, inProgress] of this.inProgress) {
      const layerHashes = new Map<string, string>();
      for (const [uuid, entry] of inProgress) {
        layerHashes.set(uuid, this.hashInstruction(entry.instructionBox));
      }
      this.inProgressHashes.set(layerName, layerHashes);
    }
  }
}
