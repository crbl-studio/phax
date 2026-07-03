<script lang="ts">
  import { gs } from "$lib/state.svelte";
  import { drawSquares } from "$lib/render";
  import { untrack } from "svelte";

  interface Props {
    name: string;
    visible: boolean;
  }

  let { name, visible }: Props = $props();

  let canvas: HTMLCanvasElement;

  let original = $derived.by(() => {
    return gs.renderer?.getLayerCanvas(name);
  });
  /* svelte-ignore state_referenced_locally */
  let currentRenderID = $state(original?.renderID);

  $effect(() => {
    let req: number;
    function loop() {
      if (canvas && original && original.renderID !== untrack(() => currentRenderID)) {
        const context = canvas.getContext("2d")!;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawSquares(context, 120);
        context.drawImage(original.canvas, 0, 0);
        currentRenderID = original.renderID;
      }
      req = requestAnimationFrame(loop);
    }
    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="layer {gs.selectedLayer === name ? 'selected' : ''}"
  onclick={() => {
    gs.selectedLayer = name;
  }}
>
  <canvas
    bind:this={canvas}
    width={original?.canvas.width}
    height={original?.canvas.height}
    class="layer-preview"
  >
  </canvas>
  <span class="name" title={name}>
    {name}
  </span>
  <div class="buttons">
    <button class="up" onclick={() => gs.server?.layerUp(name)}>UP</button>
    <button class="down" onclick={() => gs.server?.layerDown(name)}>DOWN</button>
    <button class="toggle" onclick={() => gs.server?.setLayerVisibility(name, !visible)}
      >{visible ? "HIDE" : "SHOW"}</button
    >
  </div>
</div>

<style>
  .layer {
    border: 1px solid var(--darkGrey);
    outline: none;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
  .layer:first-child {
    border-top: none;
  }
  .selected {
    background: var(--blue);
  }
  .selected * {
    color: var(--black);
  }
  .layer-preview {
    border-right: 1px solid var(--darkGrey);
    max-height: 3em;
  }
  .buttons {
    display: grid;
    grid-template-rows: 2;
    grid-template-columns: 2;
  }
  .up,
  .down {
    border-left: 1px solid var(--darkGrey);
    border-right: 1px solid var(--darkGrey);
  }
  .up {
    grid-row: 1;
    border-bottom: 1px solid var(--darkGrey);
  }
  .down {
    grid-row: 2;
    border-top: none;
  }
  .toggle {
    grid-column: 2;
    grid-row: 1 / 3;
    width: 7ch;
  }
  .name {
    place-content: center;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    text-wrap-mode: nowrap;
  }
</style>
