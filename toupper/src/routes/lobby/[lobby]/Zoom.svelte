<script lang="ts">
  import { drawSquares, renderTool } from "$lib/render";
  import { onMount } from "svelte";
  import { getStateTool, gs } from "$lib/state.svelte";

  let bottom = $state(30);
  let left = $state(30);
  let moving = $state(false);

  let canvas: HTMLCanvasElement;
  let context = $derived.by(() => canvas?.getContext("2d"));

  $effect(() => {
    let req: number;
    function loop() {
      if (context && gs.cursorPosition !== null && gs.renderer) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawSquares(context);
        context.drawImage(
          gs.renderer.canvas,
          gs.cursorPosition.x - 100 / gs.zoomRatio,
          gs.cursorPosition.y - 100 / gs.zoomRatio,
          200 / gs.zoomRatio,
          200 / gs.zoomRatio,
          0,
          0,
          200,
          200,
        );
        if (gs.tool) {
          renderTool(
            context,
            gs.ratio,
            { point: gs.cursorPosition, tool: getStateTool(gs)! },
            null,
          );
        }
      }
      req = requestAnimationFrame(loop);
    }
    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  });

  function onMouseDown() {
    moving = true;
  }

  function onMouseMove(e: MouseEvent) {
    if (moving) {
      left += e.movementX;
      bottom -= e.movementY;
    }
  }

  function onMouseUp() {
    moving = false;
  }

  onMount(() => {
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawSquares(context);
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="zoom" onmousedown={onMouseDown} style="left: {left}px; bottom: {bottom}px;">
  <canvas bind:this={canvas} height={200} width={200}></canvas>
</div>
<svelte:window onmouseup={onMouseUp} onmousemove={onMouseMove} />

<style>
  .zoom {
    position: absolute;
    height: min(15vw, 15vh);
    width: min(15vw, 15vh);
    border: 1px solid var(--darkRed);
  }

  .zoom,
  .zoom * {
    border-radius: 100%;
  }

  .zoom canvas {
    height: 100%;
    width: 100%;
  }
</style>
