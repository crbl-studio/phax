use drawing::{
    instruction::{Instruction, InstructionBox},
    Color, ImageInsertion, Motion, Point, Stroke,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WebSocketClientMessage {
    KeepAlive,
    Cursor(CursorClientData),
    Instruction(InstructionData),
    SetLayerVisibility(SetLayerVisibilityData),
    AddLayer(String),
    LayerUp(String),
    LayerDown(String),
    SetHistoryIndex(SetHistoryIndexData),
    MoveInstruction(MoveInstructionData),
    RequestInit,
    TempDraw(TempDrawClientData),
    Selection(SelectionClientData),
    Unselect,
    TempImageStart(TempImageStartClientData),
    TempImage(TempImageClientData),
    TempMoveStart(MoveStartClientData),
    TempMove(MoveClientData),
    Snapshot(SnapshotData),
    SetInstructionVisibility(SetInstructionVisibilityData),
    RemoveInstruction(RemoveInstructionData),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WebSocketServerMessage {
    Cursor(CursorServerData),
    Instruction(InstructionData),
    SetLayerVisibility(SetLayerVisibilityData),
    AddLayer(String),
    LayerUp(String),
    LayerDown(String),
    SetHistoryIndex(SetHistoryIndexData),
    MoveInstruction(MoveInstructionData),
    Init(InitData),
    Join(String),
    Leave(String),
    TempDraw(TempDrawServerData),
    Selection(SelectionServerData),
    Unselect(String),
    TempImageStart(TempImageStartServerData),
    TempImage(TempImageServerData),
    TempMoveStart(MoveStartServerData),
    TempMove(MoveServerData),
    Snapshot(SnapshotData),
    SetInstructionVisibility(SetInstructionVisibilityData),
    RemoveInstruction(RemoveInstructionData),
    AssignSnapshotter(String),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstructionData {
    pub layer: String,
    pub instruction: InstructionBox,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetLayerVisibilityData {
    pub layer: String,
    pub visible: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetHistoryIndexData {
    pub layer: String,
    pub new_history_index: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveInstructionData {
    pub layer: String,
    pub old_instruction_index: u64,
    pub new_instruction_index: u64,
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

pub type CursorClientData = Option<Cursor>;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CursorServerData {
    pub cursor: Option<Cursor>,
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InitData {
    pub drawing: drawing::Drawing,
    pub users: Vec<String>,
    pub should_snapshot: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempDrawClientData {
    pub brush: drawing::Brush,
    pub uuid: String,
    pub start: drawing::Point,
    pub end: drawing::Point,
    pub layer: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempDrawServerData {
    pub brush: drawing::Brush,
    pub uuid: String,
    pub start: drawing::Point,
    pub end: drawing::Point,
    pub layer: String,
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SelectionClientData {
    pub points: Vec<Point>,
    pub closed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SelectionServerData {
    pub username: String,
    pub points: Vec<Point>,
    pub closed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempImageStartClientData {
    pub uuid: String,
    pub layer: String,
    pub image_insertion: ImageInsertion,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempImageStartServerData {
    pub username: String,
    pub uuid: String,
    pub layer: String,
    pub image_insertion: ImageInsertion,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempImageClientData {
    pub uuid: String,
    pub layer: String,
    pub point: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TempImageServerData {
    pub username: String,
    pub uuid: String,
    pub layer: String,
    pub point: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveStartClientData {
    pub uuid: String,
    pub layer: String,
    pub selection: Vec<Point>,
    pub end: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveClientData {
    pub uuid: String,
    pub layer: String,
    pub end: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveStartServerData {
    pub username: String,
    pub uuid: String,
    pub layer: String,
    pub selection: Vec<Point>,
    pub end: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MoveServerData {
    pub username: String,
    pub uuid: String,
    pub layer: String,
    pub end: Point,
    pub scale: Point,
    pub rotate: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnapshotData {
    pub layer: String,
    pub data: String,
    pub index: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetInstructionVisibilityData {
    pub layer: String,
    pub index: u64,
    pub visible: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RemoveInstructionData {
    pub layer: String,
    pub index: u64,
}

impl CursorServerData {
    pub fn from_recieved(cursor: CursorClientData, username: String) -> Self {
        CursorServerData { cursor, username }
    }
}
