# On hold: cargo-clippy

This card is a chore: it has no proposal, design or specs.

## Origin

On hold: cargo-clippy fails on tiili's base branch hv/main since 004b58826cd5 "PTY output has no back-pressure: `yes` or a huge cat builds an unbounded backlog and xterm drops data (#202)". Auto merge waits until it is green again.

Output of cargo-clippy (end):
```
    Checking tiili v0.0.0-dev (/Users/red/.local/share/hv-worktrees/tiili-60fa9839/_main/src-tauri)
error: very complex type used. Consider factoring parts into `type` definitions
   --> src/sink.rs:303:22
    |
303 |         let release: [(&str, fn(&FlowGates, &FlowGate)); 4] = [
    |                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#type_complexity
    = note: `-D clippy::type-complexity` implied by `-D warnings`
    = help: to override `-D warnings` add `#[allow(clippy::type_complexity)]`

error: could not compile `tiili` (lib test) due to 1 previous error

[sandbox]
- refused read /Users/red/.local/share/hv-worktrees/tiili-60fa9839/.cargo/config.toml
```
