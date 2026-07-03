import type { Point } from "$lib/drinfo";
import { gs } from "$lib/state.svelte";
import type { ToolType } from "../types";
import { getRealX, getRealY, translatePointR2C } from "../util";

export abstract class Tool {
  public abstract onmousemove(event: MouseEvent, element: HTMLElement): void;
  public abstract onmouseup(event: MouseEvent, element: HTMLElement): void;
  public abstract onmousedown(event: MouseEvent, element: HTMLElement): void;
  public abstract onmouseenter(event: MouseEvent, element: HTMLElement): void;
  public abstract onmouseleave(event: MouseEvent, element: HTMLElement): void;
  public abstract onkeydown(event: KeyboardEvent, element: HTMLElement): void;
  public abstract onkeyup(event: KeyboardEvent, element: HTMLElement): void;
  public abstract getToolType(): ToolType;
}

export abstract class BaseTool extends Tool {
  protected mousedown: Point | null = null;
  protected previousCursorPosition: Point | null = null;
  protected cursorPosition: Point | null = null;
  protected canvas: HTMLCanvasElement | OffscreenCanvas | null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas | null) {
    super();
    this.canvas = canvas;
  }

  public onmouseup(_event: MouseEvent, _element: HTMLElement): void {
    this.mousedown = null;
  }
  public onmousedown(event: MouseEvent, element: HTMLElement): void {
    const x = getRealX(element, event);
    const y = getRealY(element, event);
    this.mousedown = translatePointR2C({ x, y }, gs.camera);
  }
  public onmouseleave(event: MouseEvent, element: HTMLElement): void {
    this.onmouseup(event, element);
  }
  public onmousemove(event: MouseEvent, element: HTMLElement): void {
    const x = getRealX(element, event);
    const y = getRealY(element, event);
    this.previousCursorPosition = this.cursorPosition;
    this.cursorPosition = translatePointR2C({ x, y }, gs.camera);
    if (!this.previousCursorPosition) this.previousCursorPosition = this.cursorPosition;
  }
  public onmouseenter(_event: MouseEvent, _element: HTMLElement): void {}
  public onkeydown(_event: KeyboardEvent, _element: HTMLElement): void {}
  public onkeyup(_event: KeyboardEvent, _element: HTMLElement): void {}
}
