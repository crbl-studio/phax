import { percentageToU32, rgbToStr } from "$lib/util";
import { BaseTool } from ".";
import { gs } from "$lib/state.svelte";
import { ToolType } from "../types";

export class ColorPickerTool extends BaseTool {
  public onmousedown(event: MouseEvent, element: HTMLElement) {
    super.onmousedown(event, element);
    if (!this.cursorPosition || !gs.renderer) {
      return;
    }
    const imgd = gs.renderer.getPixelAt(this.cursorPosition.x, this.cursorPosition.y);
    const colorStr = rgbToStr(imgd.data[0], imgd.data[1], imgd.data[2]);
    gs.brush.opacity = Math.floor(percentageToU32((imgd.data[3] * 100) / 255));
    gs.brush.color = colorStr;
  }

  public getToolType() {
    return ToolType.PickColor;
  }
}
