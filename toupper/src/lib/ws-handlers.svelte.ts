import { type Stroke, type Motion, type ImageInsertion } from "$lib/drinfo";
import { FromServer, type Server } from "$lib/tolower";
import { gs } from "$lib/state.svelte";
import { Renderer } from "./render";
import { translateSelection } from "./util";
import { SvelteMap } from "svelte/reactivity";

export function registerWsHandlers(server: Server, username: string): void {
  server.registerEventHandler("init", (data) => {
    gs.drawing = FromServer.drawing(data.drawing);
    gs.renderer = new Renderer(
      gs.canvas!,
      gs.drawing,
      gs.inProgress,
      data.should_snapshot
        ? (layer, data, index) => {
            gs.server?.snapshot(layer, data, index);
          }
        : undefined,
    );
    data.users.forEach((u) => {
      if (u !== username) gs.cursors.set(u, null);
    });
  });

  server.registerEventHandler("cursor", (data) => {
    gs.cursors.set(data.username, data.cursor ? FromServer.cursor(data.cursor) : null);
  });

  server.registerEventHandler("addlayer", (data) => {
    gs.drawing.addLayer(data);
  });

  server.registerEventHandler("layerup", (data) => {
    gs.drawing.layerUp(data);
  });

  server.registerEventHandler("layerdown", (data) => {
    gs.drawing.layerDown(data);
  });

  server.registerEventHandler("setlayervisibility", (data) => {
    gs.drawing.setLayerVisibility(data.layer, data.visible);
  });

  server.registerEventHandler("join", (data) => {
    gs.cursors.set(data, null);
  });

  server.registerEventHandler("sethistoryindex", (data) => {
    gs.renderer?.invalidateFrom(data.layer, data.new_history_index);
    gs.drawing.setHistoryIndex(data.layer, data.new_history_index);
  });

  server.registerEventHandler("moveinstruction", (data) => {
    gs.renderer?.invalidateFrom(
      data.layer,
      Math.min(data.old_instruction_index, data.new_instruction_index),
    );
    gs.drawing.moveInstruction(data.layer, data.old_instruction_index, data.new_instruction_index);
  });

  server.registerEventHandler("snapshot", ({ layer, data, index }) => {
    gs.drawing.snapshot(layer, data, index);
  });

  server.registerEventHandler("assignsnapshotter", () => {
    gs.renderer?.setSnapshotCallback((layer, data, index) => {
      gs.server?.snapshot(layer, data, index);
    });
  });

  server.registerEventHandler("setinstructionvisibility", ({ layer, index, visible }) => {
    gs.renderer?.invalidateFrom(layer, index);
    gs.drawing.setInstructionVisibility(layer, index, visible);
  });

  server.registerEventHandler("instruction", ({ layer, instruction }) => {
    gs.drawing.instruct(layer, FromServer.instructionBox(instruction));
    const inProgress = gs.inProgress.get(layer)?.get(instruction.uuid);
    gs.inProgress.get(layer)?.delete(instruction.uuid);
    if (inProgress && "Motion" in instruction.instruction) {
      const motion = instruction.instruction.Motion as Motion;
      const username = inProgress.username;
      if (username === gs.username) return;
      gs.selections.set(username, {
        points: translateSelection(motion.selection, motion.end, motion.scale, motion.rotate),
        closed: true,
      });
    }
  });

  server.registerEventHandler("removeinstruction", ({ layer, index }) => {
    gs.drawing.removeInstruction(layer, index);
    gs.renderer?.invalidateFrom(layer, index - 1);
  });

  server.registerEventHandler("selection", ({ points, closed, username }) => {
    gs.selections.set(username, { points, closed });
  });

  server.registerEventHandler("unselect", (username) => {
    gs.selections.delete(username);
  });

  server.registerEventHandler("tempdraw", (data) => {
    let ip = gs.inProgress.get(data.layer);
    if (!ip) {
      ip = new SvelteMap();
      gs.inProgress.set(data.layer, ip);
    }
    const brush = FromServer.brush(data.brush);
    const existing = ip.get(data.uuid);
    if (!existing) {
      const selection = gs.selections.get(data.username);
      const stroke: Stroke = {
        points: [data.start, data.end],
        brush,
        ...(selection?.closed && selection.points.length >= 3
          ? { selection: selection.points }
          : {}),
      };
      ip.set(data.uuid, {
        instructionBox: { uuid: data.uuid, applied: true, instruction: stroke },
        layer: data.layer,
        username: data.username,
      });
    } else {
      const stroke = existing.instructionBox.instruction as Stroke;
      ip.set(data.uuid, {
        ...existing,
        instructionBox: {
          ...existing.instructionBox,
          instruction: {
            ...stroke,
            points: [...stroke.points, data.end],
          },
        },
      });
    }
  });

  server.registerEventHandler("tempimagestart", ({ uuid, image_insertion, layer, username }) => {
    let ip = gs.inProgress.get(layer);
    if (!ip) {
      ip = new SvelteMap();
      gs.inProgress.set(layer, ip);
    }
    ip.set(uuid, {
      instructionBox: { uuid, applied: true, instruction: image_insertion as ImageInsertion },
      layer,
      username: username,
    });
  });

  server.registerEventHandler("tempimage", ({ uuid, point, rotate, scale, layer }) => {
    const ip = gs.inProgress.get(layer);
    if (!ip) return;
    const existing = ip.get(uuid);
    if (!existing) return;
    const img = existing.instructionBox.instruction as ImageInsertion;
    ip.set(uuid, {
      ...existing,
      instructionBox: {
        ...existing.instructionBox,
        instruction: { ...img, point, rotate, scale },
      },
    });
  });

  server.registerEventHandler(
    "tempmovestart",
    ({ uuid, username, end, selection, scale, rotate, layer }) => {
      let ip = gs.inProgress.get(layer);
      if (!ip) {
        ip = new SvelteMap();
        gs.inProgress.set(layer, ip);
      }
      ip.set(uuid, {
        instructionBox: {
          uuid,
          applied: true,
          instruction: { end, selection, scale, rotate },
        },
        layer,
        username,
      });
    },
  );

  server.registerEventHandler("tempmove", ({ uuid, end, scale, rotate, layer }) => {
    const ip = gs.inProgress.get(layer);
    if (!ip) return;
    const existing = ip.get(uuid);
    if (!existing) return;
    const motion = existing.instructionBox.instruction as Motion;
    ip.set(uuid, {
      ...existing,
      instructionBox: {
        ...existing.instructionBox,
        instruction: { ...motion, end, scale, rotate },
      },
    });
  });

  server.registerEventHandler("leave", (username) => {
    gs.selections.delete(username);
    gs.cursors.delete(username);
    for (const layer of gs.inProgress.values()) {
      const uuidsToDelete = [];
      for (const [uuid, entry] of layer) {
        if (entry.username === username) {
          uuidsToDelete.push(uuid);
        }
      }
      console.log({ layer, uuidsToDelete });
      for (const uuid of uuidsToDelete) {
        layer.delete(uuid);
      }
    }
  });
}
