<script lang="ts">
  import { drawSquares, applyInstruction } from "$lib/render";
  import { gs } from "$lib/state.svelte";

  let canvas: HTMLCanvasElement;

  let height = $state(1);
  let width = $state(1);

  $effect(() => {
    if (canvas && width > 0 && height > 0) {
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
    }
  });

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    if (gs.hoveredInstruction) {
      const ratio = gs.camera.zoom / 100;
      const offscreen = new OffscreenCanvas(gs.drawing.width, gs.drawing.height);
      const offCtx = offscreen.getContext("2d")!;

      drawSquares(offCtx);
      applyInstruction(
        gs.hoveredInstruction.instruction,
        offCtx,
        gs.renderer?.imageCache ?? new Map(),
      );

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        offscreen,
        gs.camera.position.x,
        gs.camera.position.y,
        gs.drawing.width * ratio,
        gs.drawing.height * ratio,
      );
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
</script>

<canvas bind:this={canvas} bind:clientHeight={height} bind:clientWidth={width}></canvas>

<style>
  canvas {
    position: absolute;
    height: 100%;
    width: 100%;
  }
</style>
