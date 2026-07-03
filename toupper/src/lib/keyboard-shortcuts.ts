import Mousetrap from "mousetrap";
import { gs } from "./state.svelte";

const switchBrush = () => {
  const temp = gs.secondaryBrush;
  gs.secondaryBrush = gs.brush;
  gs.brush = temp;
};

const undo = () => {
  if (!gs.selectedLayer) return;
  const layer = gs.drawing.layers.get(gs.selectedLayer);
  if (!layer) return;
  if (layer.historyIndex <= 0) return;
  gs.server?.setHistoryIndex(gs.selectedLayer, layer.historyIndex - 1);
  console.log(`sent undo for layer ${gs.selectedLayer}`);
};

const redo = () => {
  if (!gs.selectedLayer) return;
  const layer = gs.drawing.layers.get(gs.selectedLayer);
  if (!layer) return;
  if (layer.historyIndex >= layer.history.length) return;
  gs.server?.setHistoryIndex(gs.selectedLayer, layer.historyIndex + 1);
  console.log(`sent redo for layer ${gs.selectedLayer}`);
};

export const setupKeyboardShortcuts = () => {
  Mousetrap.bind("x", switchBrush);
  Mousetrap.bind("ctrl+z", undo);
  Mousetrap.bind(["ctrl+y", "ctrl+shift+z"], redo);
};
