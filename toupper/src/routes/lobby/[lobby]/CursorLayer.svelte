<script lang="ts">
  import { getRealX, getRealY, translatePointR2C } from "$lib/util";
  import { renderSelection, renderTool } from "$lib/render";
  import { getStateTool, gs } from "$lib/state.svelte";
  import { untrack } from "svelte";

  let canvas: HTMLCanvasElement;

  let height = $state(1);
  let width = $state(1);

  $effect(() => {
    if (canvas && width > 0 && height > 0) {
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
    }
  });

  const drawAllCursors = () => {
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);

    gs.cursors.entries().forEach((v) => {
      renderTool(context, gs.camera.zoom, v[1], v[0]);
    });

    gs.selections.entries().forEach((v) => {
      renderSelection(context, v[1].points, v[1].closed, gs.camera, v[0]);
    });

    if (gs.cursorPosition) {
      renderTool(
        context,
        gs.camera.zoom,
        {
          tool: getStateTool(gs),
          point: gs.cursorPosition,
        },
        null,
      );
    }
  };

  const updateCursorPosition = (element: HTMLElement, e: MouseEvent) => {
    const x = getRealX(element, e);
    const y = getRealY(element, e);
    gs.cursorPosition = {
      x,
      y,
    };
  };

  $effect(() => {
    gs.cursors.entries();
    gs.selections.entries();
    let _1 = gs.camera.zoom;
    let _2 = gs.camera.panning;
    untrack(() => drawAllCursors());
  });

  $effect(() => {
    if (!gs.canvas) return;
    const newZoom =
      Math.min(gs.canvas.height / gs.drawing.height, gs.canvas.width / gs.drawing.width) * 100;
    gs.camera.zoom = newZoom;
    const drawingRealHeight = gs.drawing.height * (newZoom / 100);
    const drawingRealWidth = gs.drawing.width * (newZoom / 100);
    untrack(() => gs.camera.position).x = (gs.canvas.width - drawingRealWidth) / 2;
    untrack(() => gs.camera.position).y = (gs.canvas.height - drawingRealHeight) / 2;
  });

  // Browser event handlers.
  const onmousemove = (element: HTMLElement, e: MouseEvent) => {
    const oldPosition = gs.cursorPosition;
    updateCursorPosition(element, e);
    if (gs.camera.panning && oldPosition) {
      gs.camera.position.x += gs.cursorPosition!.x - oldPosition.x;
      gs.camera.position.y += gs.cursorPosition!.y - oldPosition.y;
    } else {
      if (gs.tool) {
        gs.server?.cursor(getStateTool(gs)!, gs.cursorPosition);
        gs.tool.onmousemove(e, element);
      }
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

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === " ") {
      gs.camera.panning = true;
    }
  };

  const onkeyup = (e: KeyboardEvent) => {
    if (e.key === " ") {
      gs.camera.panning = false;
    }
  };

  const onleave = () => {
    gs.camera.panning = false;
  };

  const onwheel = (element: HTMLElement, e: WheelEvent) => {
    const real = {
      x: getRealX(element, e),
      y: getRealY(element, e),
    };
    const world = translatePointR2C(real, gs.camera);

    if (e.deltaY < 0 && gs.camera.zoom < 1000) {
      gs.camera.zoom = Math.round(gs.camera.zoom * 1.1);
    } else if (e.deltaY > 0 && gs.camera.zoom > 10) {
      gs.camera.zoom = Math.round(gs.camera.zoom / 1.1);
    }

    gs.camera.position = {
      x: real.x - (world.x * gs.camera.zoom) / 100,
      y: real.y - (world.y * gs.camera.zoom) / 100,
    };
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
    const onwheelwrapped = function (this: HTMLElement, e: WheelEvent) {
      onwheel(this, e);
    };
    if (canvas) {
      canvas.addEventListener("mousemove", onmousemovewrapped);
      canvas.addEventListener("mousedown", onmousedownwrapped);
      canvas.addEventListener("mouseup", onmouseupwrapped);
      canvas.addEventListener("mouseleave", onmouseoutleavewrapped);
      canvas.addEventListener("mouseenter", onmouseoutenterwrapped);
      canvas.addEventListener("mouseleave", onleave);
      canvas.addEventListener("wheel", onwheelwrapped);
      window.addEventListener("keydown", onkeydown);
      window.addEventListener("keyup", onkeyup);
      return () => {
        canvas.removeEventListener("mousemove", onmousemovewrapped);
        canvas.removeEventListener("mousedown", onmousedownwrapped);
        canvas.removeEventListener("mouseup", onmouseupwrapped);
        canvas.removeEventListener("mouseleave", onmouseoutleavewrapped);
        canvas.removeEventListener("mouseenter", onmouseoutenterwrapped);
        canvas.removeEventListener("mouseleave", onleave);
        canvas.removeEventListener("wheel", onwheelwrapped);
        window.removeEventListener("keydown", onkeydown);
        window.removeEventListener("keyup", onkeyup);
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
  bind:clientHeight={height}
  bind:clientWidth={width}
  oncontextmenu={(e) => {
    e.preventDefault();
    return false;
  }}
></canvas>

<style>
  canvas {
    cursor: none;
    height: 100%;
    width: 100%;
  }
</style>
