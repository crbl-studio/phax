import type { Motion, Point } from "$lib/drinfo";
import { BaseTool } from ".";
import { gs } from "$lib/state.svelte";
import { ToolType } from "../types";
import { SvelteMap } from "svelte/reactivity";
import { applyTransform } from "./transform";
import { v4 as uuid } from "uuid";

function selectionCenter(selection: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of selection) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / selection.length, y: cy / selection.length };
}

export class MoveTool extends BaseTool {
  public onmouseup(event: MouseEvent, element: HTMLElement): void {
    super.onmouseup(event, element);
  }
  public onmousedown(event: MouseEvent, element: HTMLElement): void {
    super.onmousedown(event, element);
    if ((gs.selections.get(gs.username)?.points.length ?? 0) >= 3 && gs.selectedLayer !== null) {
      if (gs.currentUuid) return;
      const instructionBox = {
        applied: true,
        uuid: uuid(),
        instruction: {
          selection: gs.selections.get(gs.username)!.points,
          end: gs.selections.get(gs.username)!.points[0],
          scale: { x: 1, y: 1 },
          rotate: 0,
        },
      };
      gs.currentUuid = instructionBox.uuid;
      let map = gs.inProgress.get(gs.selectedLayer);
      if (!map) {
        map = new SvelteMap();
        gs.inProgress.set(gs.selectedLayer, map);
      }
      map.set(instructionBox.uuid, { username: gs.username, layer: gs.selectedLayer, instructionBox });
      const motion = instructionBox.instruction as Motion;
      gs.server?.sendMoveStart(
        instructionBox.uuid,
        gs.selectedLayer,
        motion.selection,
        motion.end,
        motion.scale,
        motion.rotate,
      );
    }
  }
  public onmouseleave(event: MouseEvent, element: HTMLElement): void {
    super.onmouseleave(event, element);
  }
  public onmousemove(event: MouseEvent, element: HTMLElement): void {
    super.onmousemove(event, element);
    if (!this.mousedown) return;
    if (!gs.selectedLayer || !gs.currentUuid) return;
    const instructionBox = gs.inProgress.get(gs.selectedLayer)!.get(gs.currentUuid)!.instructionBox;
    const motion = instructionBox.instruction as Motion;
    const center = selectionCenter(motion.selection);
    const pivot = {
      x: center.x + (motion.end.x - motion.selection[0].x),
      y: center.y + (motion.end.y - motion.selection[0].y),
    };
    const result = applyTransform(
      motion.end,
      motion.scale,
      motion.rotate,
      this.cursorPosition!,
      this.previousCursorPosition!,
      event,
      pivot,
    );
    motion.end = result.position;
    motion.scale = result.scale;
    motion.rotate = result.rotate;
    gs.server?.sendMove(gs.currentUuid, gs.selectedLayer!, motion.end, motion.scale, motion.rotate);
  }

  public getToolType() {
    return ToolType.Move;
  }
}
