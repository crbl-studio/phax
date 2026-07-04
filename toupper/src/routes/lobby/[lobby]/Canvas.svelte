<script lang="ts">
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
    gs.canvas = canvas;
  });

  $effect(() => {
    let req: number;
    let cancelled = false;
    function loop() {
      if (gs.renderer) {
        gs.renderer
          .render(
            gs.camera,
            gs.showBackground,
            height * window.devicePixelRatio,
            width * window.devicePixelRatio,
          )
          .then(() => {
            if (!cancelled) req = requestAnimationFrame(loop);
          });
      } else {
        if (!cancelled) req = requestAnimationFrame(loop);
      }
    }
    req = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(req);
    };
  });
</script>

<canvas bind:this={canvas} bind:clientHeight={height} bind:clientWidth={width}></canvas>

<style>
  canvas {
    height: 100%;
    width: 100%;
  }
</style>
