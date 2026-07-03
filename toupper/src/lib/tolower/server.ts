import type { Tool } from "$lib/types";
import * as DrInFo from "../drinfo";
import type {
  AddLayerMessage,
  InitMessage,
  InstructionMessage,
  JoinMessage,
  LayerDownMessage,
  LayerUpMessage,
  SnapshotMessage,
  TempDrawServerMessage,
  SetInstructionVisibilityMessage,
  SetLayerVisibilityMessage,
  MoveInstructionMessage,
  SetHistoryIndexMessage,
  RemoveInstructionMessage,
  CursorServerMessage,
  SelectionServerMessage,
  TempImageServerMessage,
  TempMoveServerMessage,
  WebSocketServerMessage,
  WebSocketClientMessage,
  CursorClientMessage,
  SelectionClientMessage,
  TempImageClientMessage,
  TempMoveClientMessage,
  TempImageStartClientMessage,
  TempImageStartServerMessage,
  UnselectClientMessage,
  UnselectServerMessage,
  LeaveMessage,
  TempMoveStartServerMessage,
  TempMoveStartClientMessage,
  TempDrawClientMessage,
  AssignSnapshotterMessage,
} from "./server-types";
import * as TypeConverter from "./type-converter";

interface EventMap {
  cursor: CustomEvent<CursorServerMessage["Cursor"]>;
  instruction: CustomEvent<InstructionMessage["Instruction"]>;
  setlayervisibility: CustomEvent<SetLayerVisibilityMessage["SetLayerVisibility"]>;
  setinstructionvisibility: CustomEvent<
    SetInstructionVisibilityMessage["SetInstructionVisibility"]
  >;
  snapshot: CustomEvent<SnapshotMessage["Snapshot"]>;
  addlayer: CustomEvent<AddLayerMessage["AddLayer"]>;
  layerup: CustomEvent<LayerUpMessage["LayerUp"]>;
  layerdown: CustomEvent<LayerDownMessage["LayerDown"]>;
  moveinstruction: CustomEvent<MoveInstructionMessage["MoveInstruction"]>;
  sethistoryindex: CustomEvent<SetHistoryIndexMessage["SetHistoryIndex"]>;
  removeinstruction: CustomEvent<RemoveInstructionMessage["RemoveInstruction"]>;
  init: CustomEvent<InitMessage["Init"]>;
  join: CustomEvent<JoinMessage["Join"]>;
  leave: CustomEvent<LeaveMessage["Leave"]>;
  tempdraw: CustomEvent<TempDrawServerMessage["TempDraw"]>;
  selection: CustomEvent<SelectionServerMessage["Selection"]>;
  unselect: CustomEvent<UnselectServerMessage["Unselect"]>;
  tempimagestart: CustomEvent<TempImageStartServerMessage["TempImageStart"]>;
  tempimage: CustomEvent<TempImageServerMessage["TempImage"]>;
  tempmovestart: CustomEvent<TempMoveStartServerMessage["TempMoveStart"]>;
  tempmove: CustomEvent<TempMoveServerMessage["TempMove"]>;
  assignsnapshotter: CustomEvent<AssignSnapshotterMessage["AssignSnapshotter"]>;
}

interface ServerEventTarget extends EventTarget {
  addEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener<K extends keyof EventMap>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

const typedEventTarget = EventTarget as { new (): ServerEventTarget; prototype: ServerEventTarget };

export class Server extends typedEventTarget {
  private _websocket;
  private waitTime = 1000;

  constructor(url: string, username: string) {
    super();
    this._websocket = new WebSocket(`${url}/ws/${username}`);

    const onopen = () => {
      this.waitTime = 1000;
      const sendKeepalive = () => {
        if (
          this._websocket.readyState === this._websocket.CLOSED ||
          this._websocket.readyState === this._websocket.CLOSING
        ) {
          return;
        }
        this._websocket.send(JSON.stringify("KeepAlive"));
        setTimeout(sendKeepalive, 2000);
      };
      sendKeepalive();
      this._websocket.send(JSON.stringify("RequestInit"));
    };

    const onmessage = (msg: MessageEvent) => {
      const data: WebSocketServerMessage = JSON.parse(msg.data);
      const eventName = Object.keys(data)[0];
      const event = new CustomEvent(eventName.toLowerCase(), { detail: Object.values(data)[0] });
      console.log(eventName, Object.values(data)[0]);
      this.dispatchEvent(event);
    };

    // Hook here something to display an error message in case we fail again.
    const onclose = () => {
      this.waitTime *= 2;
      setTimeout(
        () => {
          this._websocket = new WebSocket(`${url}/ws/${username}`);
          this._websocket.onopen = onopen;
          this._websocket.onclose = onclose;
          this._websocket.onmessage = onmessage;
        },
        Math.min(this.waitTime, 15000),
      );
    };

    this._websocket.onopen = onopen;
    this._websocket.onmessage = onmessage;
    this._websocket.onclose = onclose;
  }

  private send(obj: WebSocketClientMessage) {
    try {
      this._websocket.send(JSON.stringify(obj));
    } catch (e) {
      console.warn("Could not send.", e);
    }
  }

  setHistoryIndex(layer: string, index: number) {
    const message: SetHistoryIndexMessage = {
      SetHistoryIndex: {
        layer,
        new_history_index: index,
      },
    };
    this.send(message);
  }

  moveInstruction(layer: string, oldInstructionIndex: number, newInstructionIndex: number) {
    const message: MoveInstructionMessage = {
      MoveInstruction: {
        layer,
        old_instruction_index: oldInstructionIndex,
        new_instruction_index: newInstructionIndex,
      },
    };
    this.send(message);
  }

  addLayer(layer: string) {
    const message: AddLayerMessage = {
      AddLayer: layer,
    };
    this.send(message);
  }

  cursor(tool: Tool, point: DrInFo.Point | null) {
    if (point === null) {
      const message: CursorClientMessage = {
        Cursor: null,
      };
      this.send(message);
    } else {
      const message: CursorClientMessage = {
        Cursor: {
          tool: TypeConverter.ToServer.tool(tool),
          point,
        },
      };
      this.send(message);
    }
  }

  instructionBox(instructionBox: DrInFo.InstructionBox, layer: string) {
    const message: InstructionMessage = {
      Instruction: {
        instruction: TypeConverter.ToServer.instructionBox(instructionBox),
        layer,
      },
    };
    this.send(message);
  }

  removeInstruction(layer: string, index: number) {
    const message: RemoveInstructionMessage = {
      RemoveInstruction: {
        layer,
        index,
      },
    };
    this.send(message);
  }

  setLayerVisibility(layer: string, visible: boolean) {
    const message: SetLayerVisibilityMessage = {
      SetLayerVisibility: {
        layer,
        visible,
      },
    };
    this.send(message);
  }

  setHistoryElementVisibility(layer: string, index: number, visible: boolean) {
    const message: SetInstructionVisibilityMessage = {
      SetInstructionVisibility: {
        layer,
        index,
        visible,
      },
    };
    this.send(message);
  }

  snapshot(layer: string, data: string, index: number) {
    const message: SnapshotMessage = {
      Snapshot: {
        layer,
        data,
        index,
      },
    };
    this.send(message);
  }

  layerDown(layer: string): void {
    const message: LayerDownMessage = {
      LayerDown: layer,
    };
    this.send(message);
  }

  layerUp(layer: string): void {
    const message: LayerUpMessage = {
      LayerUp: layer,
    };
    this.send(message);
  }

  drawTemp(
    brush: DrInFo.Brush,
    uuid: string,
    start: DrInFo.Point,
    end: DrInFo.Point,
    layer: string,
  ) {
    const message: TempDrawClientMessage = {
      TempDraw: {
        brush: TypeConverter.ToServer.brush(brush),
        uuid,
        start,
        end,
        layer,
      },
    };
    this.send(message);
  }

  sendSelection(points: DrInFo.Point[], closed: boolean) {
    const message: SelectionClientMessage = {
      Selection: {
        points,
        closed,
      },
    };
    this.send(message);
  }

  sendUnselect() {
    const message: UnselectClientMessage = "Unselect";
    this.send(message);
  }

  sendTempImageStart(uuid: string, layer: string, imageInsertion: DrInFo.ImageInsertion) {
    const message: TempImageStartClientMessage = {
      TempImageStart: {
        uuid,
        layer,
        image_insertion: imageInsertion,
      },
    };
    this.send(message);
  }

  sendTempImage(uuid: string, layer: string, imageInsertion: DrInFo.ImageInsertion) {
    const message: TempImageClientMessage = {
      TempImage: {
        uuid,
        layer,
        point: imageInsertion.point,
        scale: imageInsertion.scale,
        rotate: imageInsertion.rotate,
      },
    };
    this.send(message);
  }

  sendMoveStart(
    uuid: string,
    layer: string,
    selection: DrInFo.Point[],
    end: DrInFo.Point,
    scale: DrInFo.Point,
    rotate: number,
  ) {
    const message: TempMoveStartClientMessage = {
      TempMoveStart: {
        uuid,
        layer,
        end,
        selection,
        scale,
        rotate,
      },
    };
    this.send(message);
  }

  sendMove(uuid: string, layer: string, end: DrInFo.Point, scale: DrInFo.Point, rotate: number) {
    const message: TempMoveClientMessage = {
      TempMove: {
        uuid,
        layer,
        end,
        scale,
        rotate,
      },
    };
    this.send(message);
  }

  registerEventHandler<K extends keyof EventMap>(
    eventName: K,
    fn: (data: EventMap[K]["detail"]) => void,
  ) {
    this.addEventListener(eventName, (event: EventMap[K]) => fn(event.detail));
  }

  close() {
    this._websocket.close();
  }
}
