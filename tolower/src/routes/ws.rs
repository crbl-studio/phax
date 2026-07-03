use std::{sync::Arc, time::Duration};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures::{SinkExt as _, StreamExt as _};
use log::*;
use tokio::{sync::Mutex, time::timeout};

use crate::{
    AppData, ws::messages::{WebSocketClientMessage, WebSocketServerMessage}
};

fn to_msg(msg: &WebSocketServerMessage) -> Message {
    Message::text(serde_json::to_string(msg).unwrap())
}

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
        let join_msg = to_msg(&WebSocketServerMessage::Join(username.clone()));
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
                WebSocketClientMessage::Instruction { layer, instruction } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .instruct(&layer, instruction.clone())
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::Instruction { layer, instruction });
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Cursor(cursor) => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::Cursor {
                            cursor,
                            username: username.clone(),
                        });

                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetHistoryIndex { layer, new_history_index } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_history_index(&layer, new_history_index)
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::SetHistoryIndex { layer, new_history_index });
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::MoveInstruction { layer, old_instruction_index, new_instruction_index } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .move_instruction(
                            &layer,
                            old_instruction_index,
                            new_instruction_index,
                        )
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::MoveInstruction { layer, old_instruction_index, new_instruction_index });
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
                        let msg = to_msg(&WebSocketServerMessage::AddLayer(layer_name));
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::LayerUp(layer_name) => {
                    if app_data.drawing.lock().await.layer_up(&layer_name).is_ok() {
                        let msg = to_msg(&WebSocketServerMessage::LayerUp(layer_name));
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
                        let msg = to_msg(&WebSocketServerMessage::LayerDown(layer_name));
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetLayerVisibility { layer, visible } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_visibility(&layer, visible)
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::SetLayerVisibility { layer, visible });
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
                        .send(to_msg(&WebSocketServerMessage::Init {
                                drawing: app_data.drawing.lock().await.clone(),
                                users: app_data.users.lock().await.keys().cloned().collect(),
                                should_snapshot,
                            }))
                        .await;
                }
                WebSocketClientMessage::TempDraw { brush, uuid, start, end, layer } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::TempDraw {
                            brush,
                            uuid,
                            start,
                            end,
                            layer,
                            username: username.clone(),
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Selection { points, closed } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::Selection {
                            username: username.clone(),
                            points,
                            closed,
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Unselect => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::Unselect(username.clone()));
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempImage { uuid, layer, point, scale, rotate } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::TempImage {
                            username: username.clone(),
                            uuid,
                            layer,
                            point,
                            scale,
                            rotate,
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempImageStart { uuid, layer, image_insertion } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::TempImageStart {
                            username: username.clone(),
                            uuid,
                            layer,
                            image_insertion,
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempMoveStart { uuid, layer, selection, end, scale, rotate } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::TempMoveStart {
                            username: username.clone(),
                            uuid,
                            layer,
                            selection,
                            end,
                            scale,
                            rotate,
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::TempMove { uuid, layer, end, scale, rotate } => {
                    let mut users = app_data.users.lock().await;
                    let msg = to_msg(&WebSocketServerMessage::TempMove {
                            username: username.clone(),
                            uuid,
                            layer,
                            end,
                            scale,
                            rotate,
                        });
                    for (name, user) in users.iter_mut() {
                        if name != &username {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::Snapshot { layer, data, index } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .snapshot(&layer, index, data.clone())
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::Snapshot { layer, data, index });
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::SetInstructionVisibility { layer, index, visible } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .set_instruction_visibility(&layer, index, visible)
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::SetInstructionVisibility { layer, index, visible });
                        let mut users = app_data.users.lock().await;
                        for user in users.values_mut() {
                            user.lock().await.send(msg.clone()).await;
                        }
                    }
                }
                WebSocketClientMessage::RemoveInstruction { layer, index } => {
                    if app_data
                        .drawing
                        .lock()
                        .await
                        .remove_instruction(&layer, index)
                        .is_ok()
                    {
                        let msg = to_msg(&WebSocketServerMessage::RemoveInstruction { layer, index });
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

        let leave_msg = to_msg(&WebSocketServerMessage::Leave(username.clone()));
        for user in users.values() {
            user.lock().await.send(leave_msg.clone()).await;
        }

        let mut snapshotter = app_data.snapshotter.lock().await;
        if snapshotter.as_ref() == Some(&username) {
            let new_snapshotter = users.keys().next().cloned();
            *snapshotter = new_snapshotter.clone();
            if let Some(new_name) = new_snapshotter {
                if let Some(new_sender) = users.get(&new_name) {
                    let assign_msg = to_msg(&WebSocketServerMessage::AssignSnapshotter(
                            new_name,
                        ));
                    drop(snapshotter);
                    new_sender.lock().await.send(assign_msg).await;
                }
            }
        }
    }
}
