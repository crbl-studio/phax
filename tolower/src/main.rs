#![allow(unused)]
use axum::extract::ws::WebSocket;
use axum::routing::{any, get};
use axum::Router;
use clap::Parser;
use futures::stream::SplitSink;
use log::*;
use std::collections::HashMap;
use std::io::Write;
use std::sync::Arc;
use tokio::sync::Mutex;

use drawing::Drawing;

mod args;
mod routes;
mod ws;

pub struct AppData {
    pub drawing: Mutex<Drawing>,
    pub users: Mutex<HashMap<String, Arc<Mutex<SplitSink<WebSocket, axum::extract::ws::Message>>>>>,
    pub snapshotter: Mutex<Option<String>>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    let args = args::Args::parse();
    let port = args.port;
    let drawing = if let Some(file) = args.file.clone() {
        let f = std::fs::File::open(file).expect("File not found.");
        ciborium::de::from_reader(f).unwrap()
    } else {
        Drawing::new(args.height, args.width)
    };
    let drawing = Mutex::new(drawing);
    let app_data = Arc::new(AppData {
        drawing,
        users: Default::default(),
        snapshotter: Default::default(),
    });
    info!("Starting server on port {port}");
    let app = Router::new()
        .route("/ws/{username}", any(routes::ws::ws_handler))
        .route("/save", get(routes::pages::save))
        .with_state(app_data);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
    info!("Server stopped");
    Ok(())
}
