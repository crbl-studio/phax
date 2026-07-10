import type { Point, Stroke } from "$lib/drinfo";
import { BaseTool } from ".";
import { gs } from "$lib/state.svelte";
import { ToolType } from "../types";
import { SvelteMap } from "svelte/reactivity";
import { v4 as uuid } from "uuid";

export class StrokeTool extends BaseTool {
  private lastPoint: Point | null = null;

  public onmousemove(event: MouseEvent, element: HTMLElement): void {
    super.onmousemove(event, element);
    if (!gs.selectedLayer || !gs.currentUuid) return;
    const instructionBox = gs.inProgress.get(gs.selectedLayer)!.get(gs.currentUuid)!.instructionBox;
    (instructionBox.instruction as Stroke).points.push(this.cursorPosition!);
    gs.server?.drawTemp(
      gs.brush,
      instructionBox.uuid,
      this.previousCursorPosition!,
      this.cursorPosition!,
      gs.selectedLayer,
    );
  }
  public onmouseup(event: MouseEvent, element: HTMLElement): void {
    super.onmouseup(event, element);
    if (!gs.selectedLayer || !gs.currentUuid) return;
    const instructionBox = gs.inProgress.get(gs.selectedLayer)?.get(gs.currentUuid)?.instructionBox;
    if (instructionBox) {
      gs.server?.instructionBox(instructionBox, gs.selectedLayer);
      const stroke = instructionBox.instruction as Stroke;
      this.lastPoint = stroke.points[stroke.points.length - 1];
    }
    gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
    gs.currentUuid = null;
  }
  public onmousedown(event: MouseEvent, element: HTMLElement): void {
    super.onmousedown(event, element);
    if (event.button !== 0) return;
    if (!gs.selectedLayer) return;
    const selection = gs.selections.get(gs.username);
    const instructionBox = {
      uuid: uuid(),
      applied: true,
      instruction: {
        points: [],
        brush: gs.brush,
        ...(selection?.closed && selection.points.length >= 3
          ? { selection: selection.points }
          : {}),
      },
    };
    gs.currentUuid = instructionBox.uuid;
    let map = gs.inProgress.get(gs.selectedLayer);
    if (!map) {
      map = new SvelteMap();
      gs.inProgress.set(gs.selectedLayer, map);
    }
    map.set(instructionBox.uuid, {
      username: gs.username,
      layer: gs.selectedLayer,
      instructionBox,
    });
    if (event.shiftKey && this.lastPoint) {
      (instructionBox.instruction as Stroke).points.push(this.lastPoint);
    }
    (instructionBox.instruction as Stroke).points.push(this.mousedown!);
  }
  public onmouseleave(event: MouseEvent, element: HTMLElement): void {
    super.onmouseleave(event, element);
    this.onmouseup(event, element);
  }

  public getToolType() {
    return ToolType.Stroke;
  }
}
