<script lang="ts">
  import { type InstructionBox } from "$lib/drinfo";
  import LayersPaneLayer from "./LayersPaneLayer.svelte";
  import { gs } from "$lib/state.svelte";
  import { v4 as uuid } from "uuid";

  const getNextLayerName = () => {
    let possible = `New layer ${gs.drawing.layerOrder.length + 1}`;
    for (let i = 1; gs.drawing.layerOrder.includes(possible); i++) {
      possible = `New layer ${gs.drawing.layerOrder.length + 1 + i}`;
    }
    return possible;
  };

  let newLayerName = $state(getNextLayerName());

  $effect(() => {
    for (
      let i = 0;
      newLayerName === `New layer ${gs.drawing.layerOrder.length}` ||
      gs.drawing.layerOrder.includes(newLayerName);
      i++
    ) {
      newLayerName = `New layer ${gs.drawing.layerOrder.length + 1 + i}`;
    }
  });

  const getLayer = (name: string) => gs.drawing.layers.get(name)!;
</script>

<div class="container">
  <div class="layer-name">
    <input type="text" placeholder="layer name" bind:value={newLayerName} />
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
      onclick={() => {
        gs.server?.addLayer(newLayerName);
      }}><span class="plus-icon"></span></button
    >
  </div>
  <div class="layers">
    {#each gs.drawing.layerOrder.toReversed() as layer (layer)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        ondrop={() => {
          if (gs.selectedLayer !== null && gs.draggedInstruction !== null) {
            const instruction = gs.drawing.layers.get(gs.selectedLayer)!.history[
              gs.draggedInstruction - 1
            ];
            const instructionCopy: InstructionBox = {
              instruction: instruction.instruction,
              uuid: uuid(),
              applied: instruction.applied,
            };
            gs.server?.instructionBox(instructionCopy, layer);
            gs.server?.removeInstruction(gs.selectedLayer!, gs.draggedInstruction!);
          }
        }}
        ondragover={(e) => {
          e.preventDefault();
        }}
      >
        <LayersPaneLayer name={layer} visible={getLayer(layer).visible} />
      </div>
    {/each}
  </div>
</div>

<style>
  .container {
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .layers {
    display: flex;
    flex-direction: column;
    overflow: scroll;
    max-height: calc(100% - 4px);
    border-top: 2px solid var(--darkGrey);
    border-bottom: 2px solid var(--darkGrey);
  }
  .layer-name {
    display: grid;
    grid-template-columns: 1fr auto;
  }
  .layer-name input {
    border: none;
    border-right: 1px solid var(--lightGrey);
    min-width: 10ch;
    font-size: 1em;
  }
  .layer-name button {
    display: grid;
    place-items: center;
    width: 3em;
  }
  .plus-icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M20 14h-6v6h-4v-6H4v-4h6V4h4v6h6z'/%3E%3C/svg%3E");
    background-color: currentColor;
    -webkit-mask-image: var(--svg);
    mask-image: var(--svg);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
</style>
