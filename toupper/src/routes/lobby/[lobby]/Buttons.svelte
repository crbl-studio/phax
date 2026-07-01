<script lang="ts">
  import { onMount } from "svelte";
  import { gs } from "$lib/state.svelte";
  import { ToolType } from "$lib/types";
  import { SERVER_URL } from "$lib/env";
  import type { ImageInsertion, InstructionBox, Motion } from "$lib/drinfo";
  import { ImageInsertionTool } from "$lib/tools/image-insertion";
  import { StrokeTool } from "$lib/tools/stroke";
  import { EraserTool } from "$lib/tools/eraser";
  import { BucketTool } from "$lib/tools/bucket";
  import { ColorPickerTool } from "$lib/tools/color-picker";
  import { SelectionTool } from "$lib/tools/selection";
  import { PolySelectionTool } from "$lib/tools/poly-selection";
  import { MoveTool } from "$lib/tools/move";
  import { translateSelection } from "$lib/util";
  import { SvelteMap } from "svelte/reactivity";
  import { v4 as uuid } from "uuid";

  let saveUrl = $state("");

  const currentInstructionBox = $derived.by(() => {
    if (!gs.selectedLayer || !gs.currentUuid) return null;
    return gs.inProgress.get(gs.selectedLayer)?.get(gs.currentUuid)?.instructionBox ?? null;
  });

  let files: FileList | undefined = $state(undefined);

  onMount(() => {
    saveUrl = `${location.protocol}//${SERVER_URL}/save`;
  });

  $effect(() => {
    if (gs.selectedLayer && files && files[0]) {
      const fileReader = new FileReader();
      fileReader.addEventListener("load", (e) => {
        if (!e.target) return;
        const base64img = e.target.result as string;
        let image = new Image();
        image.onload = () => {
          if (gs.selectedLayer === null) return;
          const instructionBox: InstructionBox = {
            applied: true,
            instruction: {
              base64: base64img,
              point: {
                x: 0,
                y: 0,
              },
              scale: {
                x: 1,
                y: 1,
              },
              rotate: 0,
            },
            uuid: uuid(),
          };
          let map = gs.inProgress.get(gs.selectedLayer);
          if (!map) {
            map = new SvelteMap();
            gs.inProgress.set(gs.selectedLayer, map);
          }
          gs.currentUuid = instructionBox.uuid;
          map.set(instructionBox.uuid, {
            instructionBox,
            layer: gs.selectedLayer,
            username: gs.username,
          });
          gs.tool = new ImageInsertionTool(null);
          gs.server?.sendTempImageStart(
            instructionBox.uuid,
            gs.selectedLayer!,
            instructionBox.instruction as ImageInsertion,
          );
        };
        image.src = base64img;
        files = undefined;
      });
      fileReader.readAsDataURL(files[0]);
    } else {
      files = undefined;
    }
  });
</script>

{#snippet icon(name: string, enabled: boolean, onclick?: () => void)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={`icon  icon-${enabled ? "enabled" : "disabled"}`}
    onclick={() => {
      if (onclick) onclick();
      if (gs.selectedLayer && gs.currentUuid)
        gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
      gs.currentUuid = null;
      files = undefined;
    }}
  >
    <span class={`${name}-icon`}></span>
  </div>
{/snippet}

<div class="container">
  {@render icon("brush", gs.tool?.getToolType() === ToolType.Stroke, () => {
    gs.tool = new StrokeTool(null);
    gs.brush.erase = false;
  })}
  {@render icon("eraser", gs.tool?.getToolType() === ToolType.Eraser, () => {
    gs.tool = new EraserTool(null);
    gs.brush.erase = true;
  })}
  {@render icon("bucket", gs.tool?.getToolType() === ToolType.Bucket, () => {
    gs.tool = new BucketTool(null);
  })}
  {@render icon("pipette", gs.tool?.getToolType() === ToolType.PickColor, () => {
    gs.tool = new ColorPickerTool(gs.canvas);
  })}
  {@render icon("select", gs.tool?.getToolType() === ToolType.Select, () => {
    gs.tool = new SelectionTool(null);
  })}
  {@render icon("poly-select", gs.tool?.getToolType() === ToolType.PolySelect, () => {
    gs.tool = new PolySelectionTool(null);
  })}
  {@render icon("move", gs.tool?.getToolType() === ToolType.Move, () => {
    gs.tool = new MoveTool(null);
  })}
  {@render icon("zoom", gs.zoom, () => {
    gs.zoom = !gs.zoom;
  })}
  {@render icon("background", gs.bg, () => {
    gs.bg = !gs.bg;
  })}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  {#if !currentInstructionBox}
    <div
      class={`icon  icon-${gs.tool?.getToolType() === ToolType.InsertImage ? "enabled" : "disabled"}`}
      onclick={() => {}}
    >
      <label for="insertion"><span class="insert-icon"></span></label>
      <input
        type="file"
        accept="image/png, image/jpeg"
        id="insertion"
        name="insertion"
        oninput={(f) => {
          if (f.currentTarget.files) {
            files = f.currentTarget.files;
          }
        }}
      />
    </div>
  {:else if "base64" in currentInstructionBox.instruction}
    {@render icon("insert-confirm", false, () => {
      gs.tool = new StrokeTool(null);
      gs.server?.instructionBox(currentInstructionBox!, gs.selectedLayer!);
      if (gs.selectedLayer && gs.currentUuid)
        gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
      gs.currentUuid = null;
    })}
    {@render icon("insert-cancel", false, () => {
      gs.tool = new StrokeTool(null);
      if (gs.selectedLayer && gs.currentUuid) {
        gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
        gs.currentUuid = null;
      }
      files = undefined;
    })}
  {:else if "selection" in currentInstructionBox.instruction}
    {@render icon("insert-confirm", false, () => {
      gs.tool = new StrokeTool(null);
      const motion = currentInstructionBox!.instruction as Motion;
      gs.server?.instructionBox(currentInstructionBox!, gs.selectedLayer!);
      gs.selections.set(gs.username, {
        closed: true,
        points: translateSelection(motion.selection, motion.end, motion.scale, motion.rotate),
      });
      if (gs.selectedLayer && gs.currentUuid)
        gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
      gs.currentUuid = null;
    })}
    {@render icon("insert-cancel", false, () => {
      gs.tool = new StrokeTool(null);
      if (gs.selectedLayer && gs.currentUuid) {
        gs.inProgress.get(gs.selectedLayer)?.delete(gs.currentUuid);
        gs.currentUuid = null;
      }
    })}
  {/if}
  {@render icon("export", false, () => {
    if (gs.renderer) {
      const w = window.open("about:blank")!;
      w.location = gs.renderer.getPNG();
    }
  })}
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <a class="icon icon-disabled" rel="external" href={saveUrl}>
    <span class="save-icon"></span>
  </a>
</div>

<style>
  .container {
    display: flex;
    flex-direction: row;
    gap: 1em;
    padding: 0.5em;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--darkGrey);
  }
  .inner-group {
    display: flex;
    flex-direction: column;
  }
  .input-group {
    display: flex;
    flex-direction: row;
    place-items: center;
  }
  .inner-container {
    display: flex;
    flex-direction: row;
    place-items: center;
    gap: 0.4em;
    justify-content: space-between;
  }
  .brush-container {
    gap: 0.5em;
  }
  .brush-color {
    width: 7ch;
    font-family: monospace;
    font-size: 16px;
    cursor: pointer;
  }
  .button {
    color: var(--white);
    text-decoration: none;
    border: 1px solid var(--lightGrey);
    padding: 0.2em;
    margin: 0.1em;
    border-radius: 0.2em;
    cursor: pointer;
  }
  input[type="file"] {
    display: none;
  }
  .icon {
    cursor: pointer;
    width: 1.75em;
    height: 1.75em;
    color: inherit;
  }
  .icon-enabled {
    border: 2px solid var(--lightGrey);
  }
  .icon-disabled {
    padding: 2px;
  }
  .brush-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m20.71 4.63l-1.34-1.34c-.37-.39-1.02-.39-1.41 0L9 12.25L11.75 15l8.96-8.96c.39-.39.39-1.04 0-1.41M7 14a3 3 0 0 0-3 3c0 1.31-1.16 2-2 2c.92 1.22 2.5 2 4 2a4 4 0 0 0 4-4a3 3 0 0 0-3-3'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .eraser-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.01 4.01 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53l-4.95-4.95z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .bucket-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M8 1.5a.5.5 0 0 0-1 0v.838c-.252.064-.49.195-.687.392L1.337 7.706a1.5 1.5 0 0 0-.026 2.096l3.62 3.8a1.5 1.5 0 0 0 2.147.027l5.068-5.068a1.5 1.5 0 0 0 0-2.122L8.434 2.73Q8.237 2.537 8 2.429zM11.293 8H2.457L7 3.457V4.5a.5.5 0 1 0 1 0v-.79l3.439 3.437a.5.5 0 0 1 0 .707zm1.628 2.222a.56.56 0 0 0-.842 0l-1.15 1.315C9.747 12.887 10.705 15 12.5 15s2.753-2.113 1.572-3.463z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .pipette-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m19.35 11.72l-2.13 2.13l-1.41-1.42l-7.71 7.71L3.5 22L2 20.5l1.86-4.6l7.71-7.71l-1.42-1.41l2.13-2.13zM16.76 3A3 3 0 0 1 21 3a3 3 0 0 1 0 4.24l-1.92 1.92l-4.24-4.24zM5.56 17.03L4.5 19.5l2.47-1.06L14.4 11L13 9.6z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .select-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M3 5v14h18V5H3zm16 12H5V7h14v10z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .move-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M13 6v5h5V7.75L22.25 12 18 16.25V13h-5v5h3.25L12 22.25 7.75 18H11v-5H6v3.25L1.75 12 6 7.75V11h5V6H7.75L12 1.75 16.25 6H13z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .poly-select-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 4l4 16l5-7l7-2l-16-7z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .poly-confirm-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12.18 17c.36-1.5 1.25-2.84 2.5-3.75l-.72-.96l-2.75 3.54l-1.96-2.36L6.5 17zM5 5v14h7.03c.06.7.21 1.38.47 2H5c-.53 0-1.04-.21-1.41-.59C3.21 20.04 3 19.53 3 19V5c0-1.1.9-2 2-2h14c.53 0 1.04.21 1.41.59c.38.37.59.88.59 1.41v7.5c-.62-.26-1.3-.41-2-.47V5zm12.75 17L15 19l1.16-1.16l1.59 1.59l3.59-3.59l1.16 1.41z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .poly-cancel-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M13 19c0 .7.13 1.37.35 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v8.35c-.63-.22-1.3-.35-2-.35V5H5v14zm-1.79-3.17l-1.96-2.36L6.5 17h6.85c.4-1.12 1.12-2.09 2.05-2.79l-1.44-1.92zm11.33 1.05l-1.42-1.41L19 17.59l-2.12-2.12l-1.41 1.41L17.59 19l-2.12 2.12l1.41 1.42L19 20.41l2.12 2.13l1.42-1.42L20.41 19z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .insert-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M13 19c0 .7.13 1.37.35 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v8.35c-.63-.22-1.3-.35-2-.35V5H5v14zm.96-6.71l-2.75 3.54l-1.96-2.36L6.5 17h6.85c.4-1.12 1.12-2.09 2.05-2.79zM20 18v-3h-2v3h-3v2h3v3h2v-3h3v-2z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .insert-confirm-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12.18 17c.36-1.5 1.25-2.84 2.5-3.75l-.72-.96l-2.75 3.54l-1.96-2.36L6.5 17zM5 5v14h7.03c.06.7.21 1.38.47 2H5c-.53 0-1.04-.21-1.41-.59C3.21 20.04 3 19.53 3 19V5c0-1.1.9-2 2-2h14c.53 0 1.04.21 1.41.59c.38.37.59.88.59 1.41v7.5c-.62-.26-1.3-.41-2-.47V5zm12.75 17L15 19l1.16-1.16l1.59 1.59l3.59-3.59l1.16 1.41z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .insert-cancel-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M13 19c0 .7.13 1.37.35 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v8.35c-.63-.22-1.3-.35-2-.35V5H5v14zm-1.79-3.17l-1.96-2.36L6.5 17h6.85c.4-1.12 1.12-2.09 2.05-2.79l-1.44-1.92zm11.33 1.05l-1.42-1.41L19 17.59l-2.12-2.12l-1.41 1.41L17.59 19l-2.12 2.12l1.41 1.42L19 20.41l2.12 2.13l1.42-1.42L20.41 19z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .save-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7zm2 16H5V5h11.17L19 7.83zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3M6 6h9v4H6z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .zoom-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .background-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M2 2v20h20V2zm18 10h-4v4h4v4h-4v-4h-4v4H8v-4H4v-4h4V8H4V4h4v4h4V4h4v4h4zm-4-4v4h-4V8zm-4 4v4H8v-4z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .export-icon {
    display: inline-block;
    width: 1.75em;
    height: 1.75em;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M9 11.5c0 .8-.7 1.5-1.5 1.5h-1v2H5V9h2.5c.8 0 1.5.7 1.5 1.5zm5 3.5h-1.5l-1-2.5V15H10V9h1.5l1 2.5V9H14zm5-4.5h-2.5v3h1V12H19v1.7c0 .7-.5 1.3-1.3 1.3h-1.3c-.8 0-1.3-.7-1.3-1.3v-3.3c-.1-.7.4-1.4 1.2-1.4h1.3c.8 0 1.3.7 1.3 1.3v.2zm-12.5 0h1v1h-1z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
