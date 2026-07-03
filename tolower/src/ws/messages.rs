use drawing::{
    instruction::{Instruction, InstructionBox},
    Color, ImageInsertion, Motion, Point, Stroke,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WebSocketClientMessage {
    KeepAlive,
    Cursor(Option<Cursor>),
    Instruction {
        layer: String,
        instruction: InstructionBox,
    },
    SetLayerVisibility {
        layer: String,
        visible: bool,
    },
    AddLayer(String),
    LayerUp(String),
    LayerDown(String),
    SetHistoryIndex {
        layer: String,
        new_history_index: u64,
    },
    MoveInstruction {
        layer: String,
        old_instruction_index: u64,
        new_instruction_index: u64,
    },
    RequestInit,
    TempDraw {
        brush: drawing::Brush,
        uuid: String,
        start: drawing::Point,
        end: drawing::Point,
        layer: String,
    },
    Selection {
        points: Vec<Point>,
        closed: bool,
    },
    Unselect,
    TempImageStart {
        uuid: String,
        layer: String,
        image_insertion: ImageInsertion,
    },
    TempImage {
        uuid: String,
        layer: String,
        point: Point,
        scale: Point,
        rotate: u32,
    },
    TempMoveStart {
        uuid: String,
        layer: String,
        selection: Vec<Point>,
        end: Point,
        scale: Point,
        rotate: u32,
    },
    TempMove {
        uuid: String,
        layer: String,
        end: Point,
        scale: Point,
        rotate: u32,
    },
    Snapshot {
        layer: String,
        data: String,
        index: u64,
    },
    SetInstructionVisibility {
        layer: String,
        index: u64,
        visible: bool,
    },
    RemoveInstruction {
        layer: String,
        index: u64,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WebSocketServerMessage {
    Cursor {
        cursor: Option<Cursor>,
        username: String,
    },
    Instruction {
        layer: String,
        instruction: InstructionBox,
    },
    SetLayerVisibility {
        layer: String,
        visible: bool,
    },
    AddLayer(String),
    LayerUp(String),
    LayerDown(String),
    SetHistoryIndex {
        layer: String,
        new_history_index: u64,
    },
    MoveInstruction {
        layer: String,
        old_instruction_index: u64,
        new_instruction_index: u64,
    },
    Init {
        drawing: drawing::Drawing,
        users: Vec<String>,
        should_snapshot: bool,
    },
    Join(String),
    Leave(String),
    TempDraw {
        brush: drawing::Brush,
        uuid: String,
        start: drawing::Point,
        end: drawing::Point,
        layer: String,
        username: String,
    },
    Selection {
        username: String,
        points: Vec<Point>,
        closed: bool,
    },
    Unselect(String),
    TempImageStart {
        username: String,
        uuid: String,
        layer: String,
        image_insertion: ImageInsertion,
    },
    TempImage {
        username: String,
        uuid: String,
        layer: String,
        point: Point,
        scale: Point,
        rotate: u32,
    },
    TempMoveStart {
        username: String,
        uuid: String,
        layer: String,
        selection: Vec<Point>,
        end: Point,
        scale: Point,
        rotate: u32,
    },
    TempMove {
        username: String,
        uuid: String,
        layer: String,
        end: Point,
        scale: Point,
        rotate: u32,
    },
    Snapshot {
        layer: String,
        data: String,
        index: u64,
    },
    SetInstructionVisibility {
        layer: String,
        index: u64,
        visible: bool,
    },
    RemoveInstruction {
        layer: String,
        index: u64,
    },
    AssignSnapshotter(String),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Tool {
    Brush(drawing::Brush),
    Selection,
    Bucket(drawing::Brush),
    Eraser(drawing::Brush),
    ColorPicker,
    Move,
    ImageInsertion,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Cursor {
    pub point: Point,
    pub tool: Tool,
}
