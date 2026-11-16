## 1. Rust flow gate

- [x] 1.1 In `src-tauri/src/sink.rs` add `pub const FLOW_HIGH: usize = 1 << 20;`, `pub struct FlowGate { unacked: Mutex<usize>, closed: AtomicBool, cv: Condvar }` with `new() -> Arc<Self>`, `sent(n)`, `wait()` (blocks while unacked >= FLOW_HIGH and not closed), `ack(n)` (saturating subtract, notify_all), `close()` (set closed, notify_all); and `#[derive(Default)] pub struct FlowGates(Mutex<HashMap<SessionId, Arc<FlowGate>>>)` with `add`, `get`, `remove` (closes the removed gate). Unit tests: wait returns at once below FLOW_HIGH; a waiter blocked at FLOW_HIGH wakes after ack, and after close.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib sink`
- [x] 1.2 In `src-tauri/src/lib.rs` `pty_spawn`: create the gate next to the sink; wrap the output callback as `gate.wait(); if let Ok(mut sink) = output_sink.lock() { sink.write(data); } gate.sent(data.len());` with the wait outside the sink lock; register with `app.state::<FlowGates>().add(id, gate)` next to `SessionSinks::add`; `.manage(FlowGates::default())` beside SessionSinks. Add `#[tauri::command] fn pty_ack(gates: State<'_, FlowGates>, id: SessionId, bytes: usize)` (no-op for unknown id), registered next to `pty_close`. Call `app.state::<FlowGates>().remove(id)` in `forget_session` and in `window_destroyed`'s per-id loop.
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`

## 2. Frontend acks

- [x] 2.1 Add `ack?(id: SessionId, bytes: number): void` to `Backend` in `src/backend.ts`; implement it in `src/backend-tauri.ts` as fire-and-forget `invoke("pty_ack", { id, bytes })` with errors ignored. `backend-ws.ts` does not implement it.
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts`
- [x] 2.2 In `src/terminal.ts` add `output(bytes: Uint8Array): void` to `PaneTerminal` and its returned object: `term.write(bytes, cb)` where cb adds `bytes.length` to a local `pendingAck` and, when it is >= 65536 and `session` is defined, calls `backend.ack?.(session, pendingAck)` and resets it. Use it for the spawn `write` closure and take's `moves.attach` callback. In `src/panes.ts` replace both `(bytes) => terminal.term.write(bytes)` attach callbacks with `(bytes) => terminal.output(bytes)`. Update any test fakes of `PaneTerminal` that the new method breaks.
  - proof: `npx eslint src/terminal.ts src/panes.ts`
  - proof: `npm run typecheck`

## 3. Spec

- [x] 3.1 Keep this change's delta valid.
  - proof: `openspec validate pty-output-has-no-back-pressure-yes-or-a --strict`

## Manual checks after merge (The user)

- In `npm run tauri dev`, run `yes` in a pane for 60 s: tiili's memory in Activity Monitor stays within +100 MB, Ctrl+C stops it within a second, and the devtools console shows no "write data discarded" error.
- Close a pane while `yes` runs: it closes promptly and no `yes` process remains.
