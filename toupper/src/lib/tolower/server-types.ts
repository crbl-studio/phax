import * as DrInFo from "../drinfo";

export type Point = DrInFo.Point;

export type Color = {
  r: number;
  g: number;
  b: number;
};

export type BrushShape =
  | "Circle"
  | "Square"
  | {
      Custom: {
        points: Point[][];
      };
    };

export type Brush = {
  brush_shape: BrushShape;
  color: Color;
  width: number;
  hardness: number;
  opacity: number;
  erase: boolean;
  repeat: number;
};

export type Stroke = {
  Stroke: {
    points: Point[];
    brush: Brush;
    selection?: Point[];
  };
};

export type Motion = {
  Motion: DrInFo.Motion;
};

export type ImageInsertion = {
  ImageInsertion: DrInFo.ImageInsertion;
};

export type Bucket = {
  Bucket: {
    point: Point;
    brush: Brush;
    tolerance: number;
  };
};

export type Instruction = Stroke | Motion | ImageInsertion | Bucket;

export type InstructionBox = {
  instruction: Instruction;
  uuid: string;
  applied: boolean;
};

export type InstructionMessage = {
  Instruction: {
    layer: string;
    instruction: InstructionBox;
  };
};

export type RemoveInstructionMessage = {
  RemoveInstruction: {
    layer: string;
    index: number;
  };
};

export type Layer = {
  snapshots: {
    [n: number]: string;
  };
  history: InstructionBox[];
  history_index: number;
  visible: boolean;
};

export type RequestInitMessage = "RequestInit";

export type Drawing = {
  height: number;
  width: number;
  layers: {
    [index: string]: Layer;
  };
  layer_order: string[];
};

export type InitMessage = {
  Init: {
    drawing: Drawing;
    users: string[];
    should_snapshot: boolean;
  };
};

// Brush(drawing::Brush),
// Selection,
// Bucket,
// Eraser,
// ColorPicker,
// Move,

export type BrushTool = {
  Brush: Brush;
};
export type SelectionTool = "Selection";
export type BucketTool = {
  Bucket: Brush;
};
export type EraserTool = {
  Eraser: Brush;
};
export type ColorPickerTool = "ColorPicker";
export type MoveTool = "Move";
export type ImageInsertionTool = "ImageInsertion";
export type Tool =
  | BrushTool
  | SelectionTool
  | BucketTool
  | EraserTool
  | ColorPickerTool
  | MoveTool
  | ImageInsertionTool;

export type Cursor = {
  point: Point;
  tool: Tool;
};

export type CursorClientMessage = {
  Cursor: Cursor | null;
};

export type CursorServerMessage = {
  Cursor: {
    cursor: Cursor | null;
    username: string;
  };
};

export type TempDrawClientMessage = {
  TempDraw: {
    brush: Brush;
    uuid: string;
    start: Point;
    end: Point;
    layer: string;
  };
};

export type TempDrawServerMessage = {
  TempDraw: {
    brush: Brush;
    uuid: string;
    start: Point;
    end: Point;
    layer: string;
    username: string;
  };
};
export type SelectionClientMessage = {
  Selection: {
    points: Point[];
    closed: boolean;
  };
};

export type SelectionServerMessage = {
  Selection: {
    username: string;
    points: Point[];
    closed: boolean;
  };
};

export type UnselectClientMessage = "Unselect";

export type UnselectServerMessage = {
  Unselect: string;
};

export type TempImageStartClientMessage = {
  TempImageStart: {
    uuid: string;
    layer: string;
    image_insertion: DrInFo.ImageInsertion;
  };
};

export type TempImageStartServerMessage = {
  TempImageStart: {
    username: string;
    uuid: string;
    layer: string;
    image_insertion: DrInFo.ImageInsertion;
  };
};

export type TempImageClientMessage = {
  TempImage: {
    uuid: string;
    layer: string;
    point: Point;
    scale: Point;
    rotate: number;
  };
};

export type TempImageServerMessage = {
  TempImage: {
    username: string;
    uuid: string;
    layer: string;
    point: Point;
    scale: Point;
    rotate: number;
  };
};

export type TempMoveStartClientMessage = {
  TempMoveStart: {
    uuid: string;
    layer: string;
    selection: Point[];
    end: Point;
    scale: Point;
    rotate: number;
  };
};

export type TempMoveClientMessage = {
  TempMove: {
    uuid: string;
    layer: string;
    end: Point;
    scale: Point;
    rotate: number;
  };
};

export type TempMoveStartServerMessage = {
  TempMoveStart: {
    username: string;
    uuid: string;
    layer: string;
    selection: Point[];
    end: Point;
    scale: Point;
    rotate: number;
  };
};

export type TempMoveServerMessage = {
  TempMove: {
    username: string;
    uuid: string;
    layer: string;
    end: Point;
    scale: Point;
    rotate: number;
  };
};

export type SetLayerVisibilityMessage = {
  SetLayerVisibility: {
    layer: string;
    visible: boolean;
  };
};

export type SetInstructionVisibilityMessage = {
  SetInstructionVisibility: {
    layer: string;
    index: number;
    visible: boolean;
  };
};

export type SnapshotMessage = {
  Snapshot: {
    layer: string;
    data: string;
    index: number;
  };
};

export type SetHistoryIndexMessage = {
  SetHistoryIndex: {
    layer: string;
    new_history_index: number;
  };
};

export type MoveInstructionMessage = {
  MoveInstruction: {
    layer: string;
    old_instruction_index: number;
    new_instruction_index: number;
  };
};

export type AddLayerMessage = {
  AddLayer: string;
};

export type LayerUpMessage = {
  LayerUp: string;
};

export type LayerDownMessage = {
  LayerDown: string;
};

export type JoinMessage = {
  Join: string;
};

export type LeaveMessage = {
  Leave: string;
};

export type AssignSnapshotterMessage = {
  AssignSnapshotter: string;
};

export type WebSocketClientMessage =
  | CursorClientMessage
  | InstructionMessage
  | SetLayerVisibilityMessage
  | AddLayerMessage
  | LayerUpMessage
  | LayerDownMessage
  | SetHistoryIndexMessage
  | MoveInstructionMessage
  | RequestInitMessage
  | TempDrawClientMessage
  | SelectionClientMessage
  | UnselectClientMessage
  | TempImageStartClientMessage
  | TempImageClientMessage
  | TempMoveStartClientMessage
  | TempMoveClientMessage
  | SnapshotMessage
  | SetInstructionVisibilityMessage
  | RemoveInstructionMessage;

export type WebSocketServerMessage =
  | CursorServerMessage
  | InstructionMessage
  | SetLayerVisibilityMessage
  | AddLayerMessage
  | LayerUpMessage
  | LayerDownMessage
  | SetHistoryIndexMessage
  | MoveInstructionMessage
  | InitMessage
  | JoinMessage
  | LeaveMessage
  | TempDrawServerMessage
  | SelectionServerMessage
  | UnselectServerMessage
  | TempImageStartServerMessage
  | TempImageServerMessage
  | TempMoveStartServerMessage
  | TempMoveServerMessage
  | SnapshotMessage
  | SetInstructionVisibilityMessage
  | RemoveInstructionMessage
  | AssignSnapshotterMessage;
