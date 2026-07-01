<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { SERVER_URL } from "$lib/env";
  import { Server } from "$lib/tolower";
  import Buttons from "./Buttons.svelte";
  import HistoryPane from "./HistoryPane.svelte";
  import LayersPane from "./LayersPane.svelte";
  import { gs } from "$lib/state.svelte";
  import { registerWsHandlers } from "$lib/ws-handlers.svelte";
  import Zoom from "./Zoom.svelte";
  import ToolSettings from "./toolsettings/ToolSettings.svelte";
  import { page } from "$app/state";
  import Canvas from "./Canvas.svelte";
  import CursorLayer from "./CursorLayer.svelte";
  import PreviewLayer from "./PreviewLayer.svelte";
  import BgCanvas from "./BgCanvas.svelte";
  import { getRatio } from "$lib/util";
  import { v4 as uuid } from "uuid";

  let username = page.params.lobby ?? uuid();

  $effect(() => {
    gs.username = username;
  });

  let menu: "tool" | "history" = $state("tool");

  function terminateWorker() {
    if (gs.canvasWorker) {
      gs.canvasWorker.terminate();
    }
  }

  onMount(() => {
    gs.server = new Server(`${location.protocol.replace(/http/, "ws")}//${SERVER_URL}`, username);

    registerWsHandlers(gs.server, username);

    document.addEventListener("keydown", (e) => {
      if (e.key === "x") {
        const temp = gs.secondaryBrush;
        gs.secondaryBrush = gs.brush;
        gs.brush = temp;
      }
    });
  });

  $effect(() => {
    if (gs.selectedLayer === null && gs.drawing.layerOrder.length > 0) {
      gs.selectedLayer = gs.drawing.layerOrder[0];
    }
  });

  let realHeight = $state(0);
  let realWidth = $state(0);

  $effect(() => {
    gs.ratio = getRatio(
      { width: realWidth - 2, height: realHeight - 2 },
      { width: gs.drawing.width, height: gs.drawing.height },
    );
  });

  onDestroy(() => {
    terminateWorker();
    if (gs.server) {
      gs.server.close();
      gs.server = null;
    }
  });
</script>

<div class="container">
  <div class="buttons">
    <Buttons />
  </div>
  <div class="layers-pane">
    <LayersPane />
  </div>
  <div class="history-pane">
    <div class="tool-history-tabs">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class={`tool-history-tab ${menu === "tool" ? "tool-history-tab-selected" : ""}`}
        onclick={() => (menu = "tool")}
      >
        Tool
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class={`tool-history-tab ${menu === "history" ? "tool-history-tab-selected" : ""}`}
        onclick={() => (menu = "history")}
      >
        History
      </div>
    </div>
    {#if menu === "tool"}
      <ToolSettings />
    {:else if menu === "history"}
      {#if gs.selectedLayer}
        <HistoryPane name={gs.selectedLayer} />
      {:else}
        <div></div>
      {/if}
    {/if}
  </div>
  <div class="layers" bind:clientWidth={realWidth} bind:clientHeight={realHeight}>
    <BgCanvas />
    {#if gs.hoveredInstruction}
      <PreviewLayer />
    {/if}
    <div style="visibility: {!gs.hoveredInstruction ? 'visible' : 'hidden'};">
      <Canvas />
      <CursorLayer />
    </div>
  </div>
  <div class="info">
    <div class="coordinates">
      <div>X: {gs.cursorPosition?.x.toFixed(0)}</div>
      <div>Y: {gs.cursorPosition?.y.toFixed(0)}</div>
    </div>
    <div class="coordinates">
      <div>H: {gs.drawing.height}</div>
      <div>W: {gs.drawing.width}</div>
    </div>
  </div>
  {#if gs.zoom}
    <Zoom />
  {/if}
</div>

<style>
  .container {
    height: 100vh;
    width: 100vw;
    display: grid;
    grid-template-rows: auto repeat(2, minmax(0, 1fr)) auto;
    grid-template-columns: minmax(0, 1fr) 5fr;
    overflow: hidden;
  }
  .layers-pane {
    grid-row: 2;
    grid-column: 1;
  }
  .history-pane {
    grid-row: 3;
    grid-column: 1;
  }
  .layers {
    grid-row: 2 / 4;
    grid-column: 2;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .layers :global {
    canvas {
      max-width: 100%;
      max-height: 100%;
    }
  }
  .buttons {
    grid-row: 1;
    grid-column: 1 / 3;
  }
  .info {
    grid-column: 1 / 3;
    display: flex;
    justify-content: space-between;
  }
  .coordinates {
    display: flex;
  }
  .coordinates div {
    width: 15ch;
  }
  .tool-history-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--lightGrey);
    cursor: pointer;
  }
  .tool-history-tab {
    width: 100%;
    text-align: center;
  }
  .tool-history-tab:nth-child(1) {
    border-right: 1px solid var(--lightGrey);
  }
  .tool-history-tab-selected {
    background-color: var(--lightGrey);
  }
</style>
