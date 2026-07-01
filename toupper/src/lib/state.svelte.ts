import { Drawing, type Brush, type InstructionBox, type Point } from "$lib/drinfo";
import type { Server } from "$lib/tolower";
import { getDefaultBrush, getSecondaryDefaultBrush } from "$lib/default";
import { type Cursor, type Tool as ToolServerType, ToolType } from "$lib/types";
import { Tool } from "$lib/tools";
import { SvelteMap } from "svelte/reactivity";
import type { Renderer } from "./render";
import { percentageToU32 } from "./util";

export type InProgressEntry = {
  instructionBox: InstructionBox;
  layer: string;
  username: string;
};

interface GlobalState {
  cursorPosition: Point | null;
  brush: Brush;
  secondaryBrush: Brush;
  ratio: number;
  server: Server | null;
  selectedLayer: string | null;
  bg: boolean;
  hoveredInstruction: InstructionBox | null;
  draggedInstruction: number | null;
  tool: Tool | null;
  canvasWorker: Worker | null;
  tolerance: number;
  selections: SvelteMap<string, { points: Point[]; closed: boolean }>;
  cursors: SvelteMap<string, Cursor | null>;
  username: string;
  renderer: Renderer | null;
  drawing: Drawing;
  canvas: HTMLCanvasElement | null;
  inProgress: SvelteMap<string, Map<string, InProgressEntry>>;
  currentUuid: string | null;
}

export const gs: GlobalState = $state({
  cursorPosition: null,
  brush: getDefaultBrush(),
  secondaryBrush: getSecondaryDefaultBrush(),
  ratio: 0,
  server: null,
  selectedLayer: null,
  bg: true,
  hoveredInstruction: null,
  draggedInstruction: null,
  tool: null,
  canvasWorker: null,
  tolerance: percentageToU32(1),
  selections: new SvelteMap(),
  cursors: new SvelteMap(),
  username: "",
  renderer: null,
  canvas: null,
  drawing: new Drawing(),
  inProgress: new SvelteMap(),
  currentUuid: null,
});

export const getStateTool = (gs: GlobalState): ToolServerType | null => {
  if (gs.tool === null) return null;
  const toolType = gs.tool.getToolType();
  if (
    toolType === ToolType.Bucket ||
    toolType === ToolType.Eraser ||
    toolType === ToolType.Stroke
  ) {
    return {
      type: toolType,
      brush: gs.brush,
    };
  }
  return { type: toolType };
};
