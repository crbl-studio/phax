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

type RenderParams = {
  camera: CameraState;
  showBackground: boolean;
  viewportHeight: number;
  viewportWidth: number;
};

const renderParamsAreEqual = (r1: RenderParams, r2: RenderParams) =>
  r1.camera.position.x === r2.camera.position.x &&
  r1.camera.position.y === r2.camera.position.y &&
  r1.camera.zoom === r2.camera.zoom &&
  r1.showBackground === r2.showBackground &&
  r1.viewportHeight === r2.viewportHeight &&
  r1.viewportWidth === r2.viewportWidth;

export class Renderer {
  /** Canvas element the drawing is actually rendered at at the end. This is what the user sees. */
  readonly realCanvas: HTMLCanvasElement;
  /** Canvas where the drawing gets rendered at its real resolution. */
  private renderCanvas: OffscreenCanvas;
  /** DrInFo drawing information. */
  readonly drawing: Drawing;
  /** A cache to store images to improve images rendering performance. */
  readonly imageCache = new SvelteMap<string, HTMLImageElement>();
  /**
   * A map of in progress instructions to draw on top of layers.
   * Layer => UUID => entry
   */
  private inProgressInstructions: Map<string, Map<string, InProgressEntry>>;
  /**
   * A map of previous layer renders, used for fast undo/redo without reapplying instructions.
   * Layer => History index => data
   */
  private layerHistoryRenders = new SvelteMap<
    string,
    Map<number, { canvas: OffscreenCanvas; renderID: string }>
  >();
  /**
   * Used to only apply the latest stroke information instead of redrawing the whole stroke when an stroke is in progress.
   * UUID => resume state
   */
  private strokeResumeStates = new Map<string, StrokeResumeState>();
  /**
   * A map of renderde in progress strokes.
   * UUID => in progress stroke canvas
   */
  private inProgressStrokeRenders = new Map<string, OffscreenCanvas>();
  /**
   * Map of in progress instruction hashes. Used to know when an in progress instruction needs rerendering.
   * UUID => hash of instruction at time of last render
   */
  private inProgressHashes = new Map<string, string>();
  /** Callback handler for snapshot generation. Used to send snapshots to the backend. */
  private onSnapshot?: SnapshotCallback;
  /** Drawing hash of the last render, used to detect changes to the drawing and trigger a rerender. */
  private lastRenderMetadataHash: string = "";
  /** Last used render parameters. If changed, will trigger a rerender. */
  private previousRenderParams: RenderParams | null = null;
  /** Cached background render. */
  private squaresCanvas: OffscreenCanvas | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    drawing: Drawing,
    inProgressInstructions: Map<string, Map<string, InProgressEntry>>,
    onSnapshot?: SnapshotCallback,
  ) {
    this.realCanvas = canvas;
    this.drawing = drawing;
    this.inProgressInstructions = inProgressInstructions;
    this.onSnapshot = onSnapshot;
    this.renderCanvas = new OffscreenCanvas(drawing.width, drawing.height);
  }

  async render(renderParams: RenderParams): Promise<void> {
    let needsRerender = this.checkRenderNeeded(renderParams);
    if (!needsRerender) return;

    console.log("rendering");
    const { camera, showBackground, viewportHeight, viewportWidth } = renderParams;
    const ratio = camera.zoom / 100;

    if (!this.squaresCanvas) {
      this.squaresCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
      drawSquares(this.squaresCanvas.getContext("2d")!);
    }

    const compositionCtx = this.renderCanvas.getContext("2d")!;
    compositionCtx.clearRect(0, 0, this.drawing.width, this.drawing.height);

    for (const layerName of this.drawing.layerOrder) {
      const layerCanvas = await this.renderInProgressLayer(layerName);
      if (layerCanvas) compositionCtx.drawImage(layerCanvas, 0, 0);
    }

    const realCtx = this.realCanvas.getContext("2d")!;
    realCtx.clearRect(0, 0, viewportWidth, viewportHeight);
    realCtx.imageSmoothingEnabled = false;

    if (showBackground) {
      realCtx.drawImage(
        this.squaresCanvas,
        camera.position.x,
        camera.position.y,
        this.drawing.width * ratio,
        this.drawing.height * ratio,
      );
    }

    realCtx.drawImage(
      this.renderCanvas,
      camera.position.x,
      camera.position.y,
      this.drawing.width * ratio,
      this.drawing.height * ratio,
    );

    this.previousRenderParams = JSON.parse(JSON.stringify(renderParams));
    this.lastRenderMetadataHash = this.getDrawingMetadataHash();
    this.storeInProgressHashes();
  }

  async getPNG(): Promise<string> {
    const blob = await this.renderCanvas.convertToBlob();
    return await this.blobToDataUrl(blob);
  }

  getPixelAt(x: number, y: number): ImageData {
    const compCtx = this.renderCanvas.getContext("2d")!;
    return compCtx.getImageData(Math.round(x), Math.round(y), 1, 1);
  }

  /**
   * Get the render of a layer.
   * In progress strokes not applied.
   */
  getLayerCanvas(layer: string): { canvas: OffscreenCanvas; renderID: string } | undefined {
    const historyIndex = this.drawing.layers.get(layer)?.historyIndex;
    if (historyIndex === undefined) return undefined;
    return this.layerHistoryRenders.get(layer)?.get(historyIndex);
  }

  setSnapshotCallback(callback: SnapshotCallback): void {
    this.onSnapshot = callback;
  }

  /**
   * Invalidate all renders after the given index.
   */
  invalidateFrom(layerName: string, index: number): void {
    const layerHistory = this.layerHistoryRenders.get(layerName);
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
    this.inProgressStrokeRenders.delete(layerName);
  }

  private checkRenderNeeded(renderParams: RenderParams) {
    for (const [layerName, layer] of this.drawing.layers) {
      if (!layer.visible) continue;
      if (!this.layerHistoryRenders.get(layerName)?.has(layer.historyIndex)) {
        return true;
      }
    }
    const drawingMetadataHash = this.getDrawingMetadataHash();
    if (this.lastRenderMetadataHash != drawingMetadataHash) return true;
    if (!this.previousRenderParams) return true;
    if (!renderParamsAreEqual(this.previousRenderParams, renderParams)) return true;
    return this.inProgressChanged();
  }

  /** Render a layer with it's in progress instructions. */
  private async renderInProgressLayer(layerName: string): Promise<OffscreenCanvas | null> {
    const layer = this.drawing.layers.get(layerName)!;
    if (!layer || !layer.visible) return null;

    const layerCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
    const layerCtx = layerCanvas.getContext("2d")!;

    await this.ensureRenderedTo(layerName, layer.historyIndex);
    const historyCanvas = this.getCanvas(layerName, layer.historyIndex)!;
    const layerInProgressInstructions = this.inProgressInstructions.get(layerName);

    layerCtx.drawImage(historyCanvas, 0, 0);

    if (layerInProgressInstructions) {
      for (const [uuid, entry] of layerInProgressInstructions) {
        if (!entry.instructionBox.applied) continue;
        const instruction = entry.instructionBox.instruction;
        if ("points" in instruction) {
          let strokeCanvas = this.inProgressStrokeRenders.get(uuid);
          if (!strokeCanvas) {
            strokeCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
            this.inProgressStrokeRenders.set(uuid, strokeCanvas);
          }
          const strokeCtx = strokeCanvas.getContext("2d")!;
          const prevResumeState = this.strokeResumeStates.get(uuid);
          if (prevResumeState && instruction.points.length === prevResumeState.pointCount) {
            continue;
          }
          let resumeState: StrokeResumeState;
          if (prevResumeState && instruction.points.length > prevResumeState.pointCount) {
            resumeState = resumeStroke(instruction, strokeCtx, prevResumeState);
          } else {
            resumeState = resumeStroke(instruction, strokeCtx, {
              lastDrawDistance: 0,
              segmentIndex: 0,
              segmentStartDistance: 0,
              pointCount: 0,
            });
          }
          this.strokeResumeStates.set(uuid, resumeState);
          applyStrokeCanvas(instruction.brush, strokeCanvas, layerCtx, instruction.selection);
        } else {
          await applyInstruction(instruction, layerCtx, this.imageCache);
        }
      }
    }
    return layerCanvas;
  }

  /**
   * Get a hash for the drawing metadata.
   *
   * Drawing metadata includes the layer visibility and the layer order. If any of these change, the hash will change.
   */
  private getDrawingMetadataHash(): string {
    const layerVisibility = [...this.drawing.layers.values().map((l) => (l.visible ? "1" : "0"))];
    const layerOrder = this.drawing.layerOrder;
    return layerOrder.join(" - ") + " " + layerVisibility.join("");
  }

  private getCanvas(layerName: string, index: number): OffscreenCanvas | null {
    return this.layerHistoryRenders.get(layerName)?.get(index)?.canvas ?? null;
  }

  /**
   * Makes sure that the layerHistoryCanvases map has an entry for the given layer and history index.
   */
  private async ensureRenderedTo(layerName: string, targetIndex: number): Promise<void> {
    const layer = this.drawing.layers.get(layerName);
    if (!layer) return;
    let canvases = this.layerHistoryRenders.get(layerName);
    if (!canvases) {
      canvases = new SvelteMap();
      this.layerHistoryRenders.set(layerName, canvases);
    }
    if (canvases.has(targetIndex)) {
      this.trimHistoryCanvases(layerName, targetIndex);
      return;
    }
    if (!canvases.has(0)) {
      const ctx = new OffscreenCanvas(this.drawing.width, this.drawing.height).getContext("2d")!;
      canvases.set(0, { canvas: ctx.canvas, renderID: uuid() });
    }
    if (targetIndex === 0) return;
    let currentIndex = 0;
    for (const index of canvases.keys()) {
      if (index > currentIndex && index <= targetIndex) {
        currentIndex = index;
      }
    }

    const snapshot = this.drawing.getSnapshotBefore(layerName, targetIndex);
    if (snapshot && snapshot[0] > currentIndex && snapshot[0] <= targetIndex) {
      const image = await this.loadImage(snapshot[1]);
      const canvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      canvases.set(snapshot[0], { canvas, renderID: uuid() });
      currentIndex = snapshot[0];
    }

    const from = currentIndex;

    for (const key of canvases.keys()) {
      if (key > currentIndex) {
        canvases.delete(key);
      }
    }

    for (let i = from; i < targetIndex; i++) {
      const instructionBox = layer.history[i];
      if (!instructionBox) break;

      const prevContext = canvases.get(currentIndex)!;
      const newCanvas = new OffscreenCanvas(this.drawing.width, this.drawing.height);
      const newCtx = newCanvas.getContext("2d")!;
      newCtx.drawImage(prevContext.canvas, 0, 0);

      if (instructionBox.applied) {
        await applyInstruction(instructionBox.instruction, newCtx, this.imageCache);
      }

      currentIndex++;

      canvases.set(currentIndex, { canvas: newCanvas, renderID: uuid() });

      if (currentIndex % SNAPSHOT_INTERVAL === 0 && this.onSnapshot) {
        const blob = await newCanvas.convertToBlob();
        const dataUrl = await this.blobToDataUrl(blob);
        this.onSnapshot(layerName, dataUrl, currentIndex);
      }
    }

    this.trimHistoryCanvases(layerName, currentIndex);
  }

  private trimHistoryCanvases(layerName: string, maxIndex: number): void {
    const contexts = this.layerHistoryRenders.get(layerName);
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
    for (const inProgress of this.inProgressInstructions.values()) {
      for (const [uuid, entry] of inProgress) {
        const storedHash = this.inProgressHashes.get(uuid);
        if (!storedHash || storedHash !== this.hashInstruction(entry.instructionBox)) {
          return true;
        }
      }
      for (const uuid of this.inProgressHashes.keys()) {
        if (!inProgress.has(uuid)) {
          return true;
        }
      }
    }
    return false;
  }

  private storeInProgressHashes(): void {
    this.inProgressHashes.clear();
    for (const inProgress of this.inProgressInstructions.values()) {
      for (const [uuid, entry] of inProgress) {
        this.inProgressHashes.set(uuid, this.hashInstruction(entry.instructionBox));
      }
    }
  }
}
