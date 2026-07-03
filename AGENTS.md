# AGENTS.md

`fax` is a collaborative online drawing platform made of three **independent** projects (no shared workspace config, no build orchestrator — each is built and run from its own directory):

- `drinfo/` — Rust library implementing the DrInFo drawing format. **Crate name is `drawing`, not `drinfo`** (folder ≠ crate name).
- `tolower/` — Rust axum WebSocket server (the backend). Depends on `drawing` via `path = "../drinfo"`.
- `toupper/` — SvelteKit + Svelte 5 frontend (the client).

The names are a play on case: "lower"/"upper" = server/client side. `pnpm-workspace.yaml` at the repo root is **not** a multi-package workspace — it only allows esbuild to build and only lists `toupper` as a package.

## Development commands

From `tolower/`: `cargo run --release` (compiles `drinfo` too via the path dep). Default port `8079`; CLI flags via clap: `-p/--port`, `-f/--file <path>` (load a saved drawing), `-H/--height`, `-w/--width`.

From `toupper/`: `pnpm i && pnpm run dev`. Frontend connects to `PUBLIC_SERVER_URL` (SvelteKit public env), default `localhost:8079` — see `toupper/src/lib/env.ts`.

Toolchain in use: nightly Rust, Node 26, pnpm 11.

## Verification

**There are no tests in this repo** (no `#[test]`, no JS test runner). Verify by building/typechecking:

- Rust: `cargo check` (or `cargo clippy`) — run inside `tolower/` to typecheck both crates at once. No `rustfmt.toml`/`clippy.toml`; uses nightly defaults. Note: `tolower/src/main.rs:1` has `#![allow(unused)]`, so unused-code warnings are suppressed there.
- Frontend: `pnpm check` (runs `svelte-kit sync` then `svelte-check`) and `pnpm lint` (`prettier --check . && eslint .`). **Always run `pnpm check`, not raw `svelte-check`** — the sync step regenerates `.svelte-kit/tsconfig.json` and `$app/*` types that tsconfig extends.
- Format frontend: `pnpm format` (prettier `--write`). Prettier config: 2-space indent, double quotes, `trailingComma: "all"`, `printWidth: 100`, `prettier-plugin-svelte`.

## Architecture notes

### WebSocket protocol

Source of truth is the `WebSocketMessage` enum in `tolower/src/ws/messages.rs`. Each message is a JSON **single-key envelope**: `{"Instruction": {...}}`, `{"CursorIn": null}`, `{"AddLayer": "name"}`, etc.

When changing messages, update **all three** in lockstep:
1. `tolower/src/ws/messages.rs` (Rust enum + handler in `tolower/src/routes/ws.rs`).
2. `toupper/src/lib/tolower/server-types.ts` (TS mirror types).
3. `toupper/src/lib/tolower/type-converter/{to,from}-server.ts` (`ToServer` / `FromServer` converter classes bridge Rust `snake_case` + PascalCase enum variants ↔ TS `camelCase`).

Gotchas:
- `Cursor`, `Init`, and `Join` are server-only (they exist only in `WebSocketServerMessage`, not in `WebSocketClientMessage`); `KeepAlive` is client-only and handled as a no-op in `tolower/src/routes/ws.rs`.
- `RequestInit` is sent as the **bare JSON string** `"RequestInit"`, not a wrapped object (see `toupper/src/lib/tolower/server.ts`).

### History indexing is 1-based

Both `drinfo/src/layer.rs` and `toupper/src/lib/drinfo/drawing.svelte.ts` use 1-based instruction indices (`history.get_mut(index - 1)`, `index > 0 && index <= history.len()`). Off-by-one hazard when editing either side — keep them consistent.

### Drawing files

Drawings persist as **CBOR** via `ciborium` (extension `.drinfo`). Saved via `GET /save` (`tolower/src/routes/pages.rs`, downloads `drawing.drinfo`); loaded via `tolower --file <path>`. `mountain_drawing.drinfo` at the repo root is a binary sample.

### Renderer (`toupper/src/lib/render/renderer.ts`)

The `Renderer` class is the core rendering engine. It owns the real `<canvas>` element (the one the user sees) and renders everything onto it.

**Two-canvas architecture:** The real canvas is sized to viewport dimensions (literal screen pixels). All drawing content is first rendered onto `OffscreenCanvas` elements sized to the drawing's logical dimensions (`drawing.width × drawing.height`), then painted onto the real canvas at the camera's offset and zoom ratio. The background checkerboard pattern (`squaresCanvas`) is an `OffscreenCanvas` rendered once and reused.

**Per-layer, per-history-index caching:** Each layer's history state at each instruction index is cached as an `OffscreenCanvas` in `layerHistoryCanvases` (a `Map<layerName, Map<historyIndex, {canvas, renderID}>>`). When the renderer needs state at index N, it finds the closest cached index ≤ N (`findClosestContext`), then replays instructions one-by-one from there (`replayInstructions`), creating new offscreen canvases at each step. Snapshots (full-layer data URLs saved every 20 instructions) are used to skip large ranges when available.

**Scratch canvases for in-progress strokes:** Each layer's final output is a "scratch" canvas (`scratchCanvases`, one per layer) that composites the current history canvas + any in-progress strokes. The scratch is invalidated/rebuilt when its size changes, the source history `renderID` changes, or in-progress stroke data regresses (point count decreases, meaning a stroke was restarted). Rebuilding copies the history canvas then applies in-progress instructions on top.

**In-progress stroke optimization:** Stroke instructions (`"points" in instruction`) are drawn incrementally via `resumeStroke`, which tracks per-stroke state (`strokeResumeStates`: per-layer, per-uuid maps of `{pointCount, segmentIndex, …}`). Only new points since the last render are drawn — the full stroke is not redrawn from scratch each frame. Non-stroke in-progress instructions always trigger a scratch rebuild.

**Render guard:** Before doing any work, `render()` checks if anything actually changed since the last frame: missing history indices, layer visibility/order metadata hash, camera zoom/position, viewport dimensions, background toggle, or in-progress instruction data (checked via `inProgressChanged` which compares instruction hashes). If nothing changed, it returns immediately without touching the canvas.

**Invalidation:** `invalidateFrom(layer, index)` drops all cached history canvases from `index` onward for a given layer, plus clears its scratch canvas and stroke resume states. This is called when the drawing model changes (undo, instruction removal, etc.).

### Frontend specifics (Svelte 5)

- Uses Svelte 5 **runes** throughout (`$state`, `$props`, `$page`, `SvelteMap`/`SvelteSet` from `svelte/reactivity`). Do **not** use Svelte 4 stores or `export let` reactive patterns.
- Reactive TypeScript modules use the `.svelte.ts` extension (e.g. `drawing.svelte.ts`, `layer.svelte.ts`, `state.svelte.ts`).
- Global client state is a singleton `gs` in `toupper/src/lib/state.svelte.ts`.
- Instruction dispatch in `toupper/src/lib/render/instruction.ts` is duck-typed (`"points" in instruction`, `"selection" in instruction`, `"point" in instruction && "base64" in instruction`, `"point" in instruction && "brush" in instruction`) — not an enum match.

## Conventions

- Conventional commits, optionally scoped by project name: `feat(toupper):`, `chore(tolower):`, `fix(drinfo):`, or unscoped (`feat:`, `chore:`). Branch is `main`.
- `TODO.md` at repo root tracks planned work (selection tool, custom brushes, rooms, masks, global history, messaging rework with nonces/confirmation).
