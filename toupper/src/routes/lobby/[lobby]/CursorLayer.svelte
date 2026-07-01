<script lang="ts">
  import { getX, getY } from "$lib/util";
  import { renderSelection, renderTool } from "$lib/render";
  import { getStateTool, gs } from "$lib/state.svelte";
  import { untrack } from "svelte";

  let canvas: HTMLCanvasElement;

  const drawAllCursors = () => {
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, gs.drawing.width, gs.drawing.height);

    gs.cursors.entries().forEach((v) => {
      renderTool(context, gs.ratio, v[1], v[0]);
    });

    gs.selections.entries().forEach((v) => {
      renderSelection(context, v[1].points, v[1].closed, 1, v[0]);
    });

    if (gs.cursorPosition) {
      renderTool(
        context,
        gs.ratio,
        {
          tool: getStateTool(gs),
          point: gs.cursorPosition,
        },
        null,
      );
    }
  };

  const updateCursorPosition = (element: HTMLElement, e: MouseEvent) => {
    const x = getX(element, e, gs.ratio);
    const y = getY(element, e, gs.ratio);
    gs.cursorPosition = {
      x,
      y,
    };
  };

  $effect(() => {
    gs.cursors.entries();
    gs.selections.entries();
    untrack(() => drawAllCursors());
  });

  // Browser event handlers.
  const onmousemove = (element: HTMLElement, e: MouseEvent) => {
    updateCursorPosition(element, e);
    if (gs.tool) {
      gs.server?.cursor(getStateTool(gs)!, gs.cursorPosition);
      gs.tool.onmousemove(e, element);
    }
    drawAllCursors();
  };

  const onmousedown = (element: HTMLElement, e: MouseEvent) => {
    if (gs.tool) {
      gs.tool.onmousedown(e, element);
    }
  };

  const onmouseup = (element: HTMLElement, e: MouseEvent) => {
    if (gs.tool) {
      gs.tool.onmouseup(e, element);
    }
  };

  const onmouseleave = (element: HTMLElement, e: MouseEvent) => {
    if (gs.tool) {
      gs.tool.onmouseleave(e, element);
      gs.server?.cursor(getStateTool(gs)!, null);
    }
    gs.cursorPosition = null;
    drawAllCursors();
  };

  const onmouseenter = (element: HTMLElement, e: MouseEvent) => {
    if (gs.tool) {
      gs.tool.onmouseenter(e, element);
    }
  };

  $effect(() => {
    // Functions are wrapped to handle `this`.
    const onmousemovewrapped = function (this: HTMLElement, e: MouseEvent) {
      onmousemove(this, e);
    };
    const onmousedownwrapped = function (this: HTMLElement, e: MouseEvent) {
      onmousedown(this, e);
    };
    const onmouseupwrapped = function (this: HTMLElement, e: MouseEvent) {
      onmouseup(this, e);
    };
    const onmouseoutleavewrapped = function (this: HTMLElement, e: MouseEvent) {
      onmouseleave(this, e);
    };
    const onmouseoutenterwrapped = function (this: HTMLElement, e: MouseEvent) {
      onmouseenter(this, e);
    };
    if (canvas) {
      canvas.addEventListener("mousemove", onmousemovewrapped);
      canvas.addEventListener("mousedown", onmousedownwrapped);
      canvas.addEventListener("mouseup", onmouseupwrapped);
      canvas.addEventListener("mouseleave", onmouseoutleavewrapped);
      canvas.addEventListener("mouseenter", onmouseoutenterwrapped);
      return () => {
        canvas.removeEventListener("mousemove", onmousemovewrapped);
        canvas.removeEventListener("mousedown", onmousedownwrapped);
        canvas.removeEventListener("mouseup", onmouseupwrapped);
        canvas.removeEventListener("mouseleave", onmouseoutleavewrapped);
        canvas.removeEventListener("mouseenter", onmouseoutenterwrapped);
      };
    }
  });

  const onfriendcursor = () => {
    drawAllCursors();
  };

  $effect(() => {
    /* eslint-disable-next-line @typescript-eslint/no-unused-expressions */
    canvas;
    gs.server?.addEventListener("cursor", onfriendcursor);
    return () => {
      gs.server?.removeEventListener("cursor", onfriendcursor);
    };
  });
</script>

<canvas
  bind:this={canvas}
  height={gs.drawing.height}
  width={gs.drawing.width}
  oncontextmenu={(e) => {
    e.preventDefault();
    return false;
  }}
></canvas>

<style>
  canvas {
    position: absolute;
    cursor: none;
  }
</style>
