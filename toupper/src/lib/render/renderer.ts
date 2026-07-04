import type { Drawing, InstructionBox } from "$lib/drinfo";
import type { CameraState, InProgressEntry } from "$lib/state.svelte";
import { SvelteMap } from "svelte/reactivity";
import {
  applyInstruction,
  applyStrokeCanvas,
  resumeStroke,
  type StrokeResumeState,
} from "./instruction";
import { v4 as uuid } from "uuid";
import { drawSquares } from "./draw";

export type SnapshotCallback = (layer: string, data: string, index: number) => void;

const SNAPSHOT_INTERVAL = 100;
const MAX_HISTORY_CANVASES = 10;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly drawing: Drawing;
  readonly imageCache = new SvelteMap<string, HTMLImageElement>();
  // Layer => UUID => entry
  private inProgressInstructions: Map<string, Map<string, InProgressEntry>>;
  // Layer => History index => data
  private layerHistoryCanvases = new SvelteMap<
    string,
    Map<number, { canvas: OffscreenCanvas; renderID: string }>
  >();
  // UUID => resume state
  private strokeResumeStates = new Map<string, StrokeResumeState>();
  // UUID => stroke canvas
  private inProgressCanvases = new Map<string, OffscreenCanvas>();
  // Layer => UUID => hash of instruction at time of last render
  private inProgressHashes = new Map<string, Map<string, string>>();
  private onSnapshot?: SnapshotCallback;
  private lastRenderMetadataHash: string = "";
  private previousCameraState: CameraState | null = null;
  private previousViewportHeight: number = 0;
  private previousViewportWidth: number = 0;
  private previousShowBackground: boolean = true;
  private squaresCanvas: OffscreenCanvas;
  private squaresInitialized = false;
  private compositionCanvas: OffscreenCanvas;

  constructor(
    canvas: HTMLCanvasElement,
    drawing: Drawing,
    inProgressInstructions: Map<string, Map<string, InProgressEntry>>,
    onSnapshot?: SnapshotCallback,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.drawing = drawing;
    this.inProgressInstructions = inProgressInstructions;
    this.onSnapshot = onSnapshot;
    this.squaresCanvas = new OffscreenCanvas(drawing.width, drawing.height);
    this.compositionCanvas = new OffscreenCanvas(drawing.width, drawing.height);
  }

  async render(
    camera: CameraState,
    showBackground: boolean,
    viewportHeight: number,
    viewportWidth: number,
  ): Promise<void> {
    const ratio = camera.zoom / 100;
    let needsRerender = false;
    for (const [layerName, layer] of this.drawing.layers) {
      if (!layer.visible) continue;
      if (!this.layerHistoryCanvases.get(layerName)?.has(layer.historyIndex)) {
        needsRerender = true;
        break;
      }
    }
    const drawingMetadataHash = this.getDrawingMetadataHash();
    if (this.lastRenderMetadataHash != drawingMetadataHash) needsRerender = true;
    if (
      !this.previousCameraState ||
      this.previousCameraState.zoom !== camera.zoom ||
      this.previousCameraState.position.x !== camera.position.x ||
      this.previousCameraState.position.y !== camera.position.y
    )
      needsRerender = true;
    if (this.previousViewportHeight !== viewportHeight) needsRerender = true;
    if (this.previousViewportWidth !== viewportWidth) needsRerender = true;
    if (this.previousShowBackground !== showBackground) needsRerender = true;
    if (!needsRerender) needsRerender = this.inProgressChanged();
    if (!needsRerender) return;
    console.log("rendering");

    this.previousCameraState = {
      panning: false,
      position: { ...camera.position },
      zoom: camera.zoom,
    };
    this.previousViewportHeight = viewportHeight;
    this.previousViewportWidth = viewportWidth;
    this.previousShowBackground = showBackground;

    if (!this.squaresInitialized) {
      drawSquares(this.squaresCanvas.getContext("2d")!);
      this.squaresInitialized = true;
    }

    const compositionCtx = this.compositionCanvas.getContext("2d")!;
    compositionCtx.clearRect(0, 0, this.drawing.width, this.drawing.height);

    for (const layerName of this.drawing.layerOrder) {
      const layerCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
      const layerCtx = layerCanvas.getContext("2d")!;
      const layer = this.drawing.layers.get(layerName);
      if (!layer || !layer.visible) continue;

      await this.ensureLayerContext(layerName, layer.historyIndex);
      const historyCanvas = this.getCanvas(layerName, layer.historyIndex)!;
      const inProgressInstructions = this.inProgressInstructions.get(layerName);

      layerCtx.drawImage(historyCanvas, 0, 0);

      if (inProgressInstructions) {
        for (const [uuid, entry] of inProgressInstructions) {
          if (!entry.instructionBox.applied) continue;
          const instruction = entry.instructionBox.instruction;
          let inProgressCanvas = this.inProgressCanvases.get(uuid);
          if (!inProgressCanvas) {
            inProgressCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
            this.inProgressCanvases.set(uuid, inProgressCanvas);
          }
          const inProgressCtx = inProgressCanvas.getContext("2d")!;
          if ("points" in instruction) {
            const prevResumeState = this.strokeResumeStates.get(uuid);
            if (prevResumeState && instruction.points.length === prevResumeState.pointCount) {
              continue;
            }
            let resumeState: StrokeResumeState;
            if (prevResumeState && instruction.points.length > prevResumeState.pointCount) {
              resumeState = resumeStroke(instruction, inProgressCtx, prevResumeState);
            } else {
              resumeState = resumeStroke(instruction, inProgressCtx, {
                lastDrawDistance: 0,
                segmentIndex: 0,
                segmentStartDistance: 0,
                pointCount: 0,
              });
            }
            this.strokeResumeStates.set(uuid, resumeState);
            applyStrokeCanvas(instruction.brush, inProgressCanvas, layerCtx);
          } else {
            await applyInstruction(instruction, inProgressCtx, this.imageCache);
            layerCtx.globalCompositeOperation = "source-over";
            layerCtx.drawImage(inProgressCanvas, 0, 0);
          }
        }
      }

      compositionCtx.drawImage(layerCanvas, 0, 0);
    }

    this.ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    this.ctx.imageSmoothingEnabled = false;

    if (showBackground) {
      this.ctx.drawImage(
        this.squaresCanvas,
        camera.position.x,
        camera.position.y,
        this.drawing.width * ratio,
        this.drawing.height * ratio,
      );
    }

    this.ctx.drawImage(
      this.compositionCanvas,
      camera.position.x,
      camera.position.y,
      this.drawing.width * ratio,
      this.drawing.height * ratio,
    );

    this.lastRenderMetadataHash = drawingMetadataHash;
    this.storeInProgressHashes();
  }

  async getPNG(): Promise<string> {
    const blob = await this.compositionCanvas.convertToBlob();
    return await this.blobToDataUrl(blob);
  }

  getPixelAt(x: number, y: number): ImageData {
    const compCtx = this.compositionCanvas.getContext("2d")!;
    return compCtx.getImageData(Math.round(x), Math.round(y), 1, 1);
  }

  getLayerCanvas(layer: string): { canvas: OffscreenCanvas; renderID: string } | undefined {
    const historyIndex = this.drawing.layers.get(layer)?.historyIndex;
    if (historyIndex === undefined) return undefined;
    return this.layerHistoryCanvases.get(layer)?.get(historyIndex);
  }

  setSnapshotCallback(callback: SnapshotCallback): void {
    this.onSnapshot = callback;
  }

  invalidateFrom(layerName: string, index: number): void {
    const layerHistory = this.layerHistoryCanvases.get(layerName);
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
    this.strokeResumeStates.delete(layerName);
    this.inProgressCanvases.delete(layerName);
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

    if (contexts.has(targetIndex)) {
      this.trimHistoryCanvases(layerName, targetIndex);
      return;
    }

    if (!contexts.has(0)) {
      const ctx = new OffscreenCanvas(this.drawing.width, this.drawing.height).getContext("2d")!;
      contexts.set(0, { canvas: ctx.canvas, renderID: uuid() });
    }

    if (targetIndex === 0) return;

    const layer = this.drawing.layers.get(layerName);
    if (!layer) return;

    let currentIndex = this.findClosestContext(contexts, targetIndex);

    const snapshot = this.drawing.getSnapshotBefore(layerName, targetIndex);
    if (snapshot && snapshot[0] > currentIndex && snapshot[0] <= targetIndex) {
      const image = await this.loadImage(snapshot[1]);
      const ctx = new OffscreenCanvas(this.drawing.width, this.drawing.height).getContext("2d")!;
      ctx.clearRect(0, 0, this.drawing.width, this.drawing.height);
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
      this.drawing.width,
      this.drawing.height
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
    let currentIndex = from;

    for (let i = from; i < to; i++) {
      const instructionBox = history[i];
      if (!instructionBox) break;

      const prevContext = contexts.get(currentIndex)!;
      const newCanvas = new OffscreenCanvas(w, h);
      const newCtx = newCanvas.getContext("2d")!;
      newCtx.drawImage(prevContext.canvas, 0, 0);

      if (instructionBox.applied) {
        await applyInstruction(instructionBox.instruction, newCtx, this.imageCache);
      }

      currentIndex++;

      for (const key of contexts.keys()) {
        if (key > currentIndex) {
          contexts.delete(key);
        }
      }

      contexts.set(currentIndex, { canvas: newCanvas, renderID: uuid() });

      if (currentIndex % SNAPSHOT_INTERVAL === 0 && this.onSnapshot) {
        const blob = await newCanvas.convertToBlob();
        const dataUrl = await this.blobToDataUrl(blob);
        this.onSnapshot(layerName, dataUrl, currentIndex);
      }
    }

    this.trimHistoryCanvases(layerName, currentIndex);
  }

  private trimHistoryCanvases(layerName: string, maxIndex: number): void {
    const contexts = this.layerHistoryCanvases.get(layerName);
    if (!contexts) return;

    const keepThreshold = maxIndex - MAX_HISTORY_CANVASES + 1;
    if (keepThreshold <= 1) return;

    const keysToDelete: number[] = [];
    for (const key of contexts.keys()) {
      if (key !== 0 && key < keepThreshold) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      contexts.delete(key);
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
    for (const [layerName, inProgress] of this.inProgressInstructions) {
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
      if (!this.inProgressInstructions.has(layerName)) {
        return true;
      }
    }
    return false;
  }

  private storeInProgressHashes(): void {
    this.inProgressHashes.clear();
    for (const [layerName, inProgress] of this.inProgressInstructions) {
      const layerHashes = new Map<string, string>();
      for (const [uuid, entry] of inProgress) {
        layerHashes.set(uuid, this.hashInstruction(entry.instructionBox));
      }
      this.inProgressHashes.set(layerName, layerHashes);
    }
  }
}
