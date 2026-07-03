use std::{sync::Arc, time::Duration};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use drawing::Drawing;
use futures::{SinkExt as _, StreamExt as _};
use log::*;
use tokio::{sync::Mutex, time::timeout};

use crate::{
    AppData, ws::messages::{
        CursorServerData, InitData, MoveServerData, MoveStartServerData, SelectionServerData, TempDrawServerData, TempImageServerData, TempImageStartServerData, WebSocketClientMessage, WebSocketServerMessage
    }
};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(username): Path<String>,
    State(data): State<Arc<AppData>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, username, data))
}

pub async fn handle_socket(socket: WebSocket, username: String, app_data: Arc<AppData>) {
    info!("{username} joined");

    let (mut sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));

    {
        let mut users = app_data
            .users
            .lock()
            .await;
        let join_msg = Message::text(
            serde_json::to_string(&WebSocketServerMessage::Join(username.clone()))
                .unwrap(),
        );
        for user in users.values() {
            user.lock().await.send(join_msg.clone()).await;
        }
        users.insert(username.clone(), sender.clone());

        let mut snapshotter = app_data.snapshotter.lock().await;
        if snapshotter.is_none() {
            *snapshotter = Some(username.clone());
        }
    }

    while let Ok(Some(Ok(msg))) = timeout(Duration::from_secs(3), receiver.next()).await {
        let Ok(text) = msg.to_text() else {
            return;
        };
        debug!("Incomming websocket message from {username}: {text}");
        if let Ok(m) = serde_json::from_str::<WebSocketClientMessage>(text) {
            match m {
                WebSocketClientMessage::Instruction(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .instruct(&data.layer, data.instruction.clone())
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::Instruction(data))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Cursor(cursor) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::Cursor(CursorServerData {
                            cursor,
                            username: username.clone(),
                        }))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetHistoryIndex(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_history_index(&data.layer, data.new_history_index)
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::SetHistoryIndex(data))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::MoveInstruction(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .move_instruction(
                            &data.layer,
                            data.old_instruction_index,
                            data.new_instruction_index,
                        )
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::MoveInstruction(data))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::AddLayer(layer_name) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .add_layer(layer_name.clone())
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::AddLayer(layer_name))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::LayerUp(layer_name) => {
                    if app_data.drawing.lock().await.layer_up(&layer_name).is_ok() {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::LayerUp(layer_name))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::LayerDown(layer_name) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .layer_down(&layer_name)
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::LayerDown(layer_name))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetLayerVisibility(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_visibility(&data.layer, data.visible)
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::SetLayerVisibility(
                                data,
                            ))
                            .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::RequestInit => {
                    let should_snapshot =
                        app_data.snapshotter.lock().await.as_ref() == Some(&username);
                    sender
                        .lock()
                        .await
                        .send(Message::text(
                            serde_json::to_string(&WebSocketServerMessage::Init(InitData {
                                drawing: app_data.drawing.lock().await.clone(),
                                users: app_data.users.lock().await.keys().cloned().collect(),
                                should_snapshot,
                            }))
                            .unwrap(),
                        ))
                        .await;
                }
                WebSocketClientMessage::TempDraw(data) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::TempDraw(TempDrawServerData {
                            brush: data.brush,
                            uuid: data.uuid,
                            start: data.start,
                            end: data.end,
                            layer: data.layer,
                            username: username.clone(),
                        })).unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Selection(selection) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::Selection(
                            SelectionServerData {
                                username: username.clone(),
                                points: selection.points,
                                closed: selection.closed,
                            },
                        ))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Unselect => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::Unselect(username.clone()))
                            .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempImage(data) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::TempImage(TempImageServerData {
                            username: username.clone(),
                            uuid: data.uuid,
                            layer: data.layer,
                            point: data.point,
                            scale: data.scale,
                            rotate: data.rotate,

                        }))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempImageStart(data) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::TempImageStart(TempImageStartServerData {
                            username: username.clone(),
                            uuid: data.uuid,
                            layer: data.layer,
                            image_insertion: data.image_insertion,
                        }))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempMoveStart(data) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::TempMoveStart(MoveStartServerData {
                            username: username.clone(),
                            uuid: data.uuid,
                            layer: data.layer,
                            selection: data.selection,
                            end: data.end,
                            scale: data.scale,
                            rotate: data.rotate,
                        }))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempMove(data) => {
                    let mut users = app_data.users.lock().await;
                    let msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::TempMove(MoveServerData {
                            username: username.clone(),
                            uuid: data.uuid,
                            layer: data.layer,
                            end: data.end,
                            scale: data.scale,
                            rotate: data.rotate,
                        }))
                        .unwrap(),
                    );
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Snapshot(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .snapshot(&data.layer, data.index, data.data.clone())
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::Snapshot(data)).unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetInstructionVisibility(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_instruction_visibility(&data.layer, data.index, data.visible)
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(
                                &WebSocketServerMessage::SetInstructionVisibility(data),
                            )
                            .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::RemoveInstruction(data) => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .remove_instruction(&data.layer, data.index)
                        .is_ok()
                    {
                        let msg = Message::text(
                            serde_json::to_string(&WebSocketServerMessage::RemoveInstruction(data))
                                .unwrap(),
                        );
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::KeepAlive => {},
            }
        } else {
            error!("Could not parse message: {msg:?}");
        };
    }

    info!("{username} left");

    {
        let mut users = app_data
            .users
            .lock()
            .await;

        users.remove(&username);

        let leave_msg = Message::text(
            serde_json::to_string(&WebSocketServerMessage::Leave(username.clone()))
                .unwrap(),
        );
        for user in users.values() {
            user.lock().await.send(leave_msg.clone()).await;
        }

        let mut snapshotter = app_data.snapshotter.lock().await;
        if snapshotter.as_ref() == Some(&username) {
            let new_snapshotter = users.keys().next().cloned();
            *snapshotter = new_snapshotter.clone();
            if let Some(new_name) = new_snapshotter {
                if let Some(new_sender) = users.get(&new_name) {
                    let assign_msg = Message::text(
                        serde_json::to_string(&WebSocketServerMessage::AssignSnapshotter(
                            new_name,
                        ))
                        .unwrap(),
                    );
                    drop(snapshotter);
                    new_sender.lock().await.send(assign_msg).await;
                }
            }
        }
    }
}
