import { BaseTool } from ".";
import { gs } from "$lib/state.svelte";
import { ToolType } from "../types";
import { v4 as uuid } from "uuid";

export class BucketTool extends BaseTool {
  public onmousedown(event: MouseEvent, element: HTMLElement) {
    super.onmousedown(event, element);
    if (!gs.selectedLayer) {
      return;
    }
    gs.server?.instructionBox(
      {
        instruction: {
          point: this.cursorPosition!,
          brush: gs.brush,
          tolerance: gs.tolerance,
        },
        uuid: uuid(),
        applied: true,
      },
      gs.selectedLayer,
    );
  }

  public getToolType() {
    return ToolType.Bucket;
  }
}
