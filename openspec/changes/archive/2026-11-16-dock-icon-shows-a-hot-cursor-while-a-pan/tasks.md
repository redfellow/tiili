## 1. Frames

- [x] 1.1 Add exported `workingSvg(svg, variant, frame)` and the frame tables (`LIGHT_BLOOM`, `DARK_MIX`) to `scripts/app-icon.mjs` (with types in `scripts/app-icon.d.mts`), and render `app-{light,dark}-working-{0..7}.png` at 512 px in `scripts/icons.mjs`; run `npm run icons` and commit the PNGs. Add the 16 files to the "Run time" list in `scripts/icons.test.ts`, plus one table-driven test that `workingSvg` gives the expected cursor fill and bloom opacity per variant and frame and leaves the brick and chevron unchanged.
  Tests to update: scripts/icons.test.ts
  - proof: `npx vitest run scripts/icons.test.ts`
  - proof: `npx eslint scripts/app-icon.mjs scripts/icons.mjs scripts/icons.test.ts`

## 2. Working state

- [x] 2.1 Add `src-tauri/src/working.rs` with a pure registry (`output(id, now)`, `foreground(id, is_shell)`, `remove(id)`, `any_working(now)`, 3 s window) and a table-driven unit test covering: shell foreground with output (idle), non-shell with recent output (working), non-shell quiet for over 3 s (idle), closed pane (idle). Feed it from the PTY output and foreground reporting in `src-tauri/src/lib.rs`.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib working`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`

## 3. Icon

- [x] 3.1 In `src-tauri/src/app_icon.rs` embed the working frames, add a pure `frame_at(tick, reduce_motion)` (cycles 0..7, holds 0 when reduced), a ticker started on output that swaps frames every 333 ms while `any_working` and shows the normal icon and stops when idle, make `apply` respect the working state, and read the OS reduce-motion preference per platform. Extend `both_icons_are_pngs` to the frames and add a table test for `frame_at`.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib app_icon`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 4. Spec

- [x] 4.1 Keep the packaging delta valid.
  - proof: `openspec validate dock-icon-shows-a-hot-cursor-while-a-pan --strict`

## Manual checks after merge (The user)

- Run `yes | head -c 50M | pv -q -L 10k` in a pane: the Dock icon's cursor glows and breathes; it returns to normal about 3 s after it ends.
- Open vim, or leave an agent waiting for an answer: the icon goes back to normal.
- Switch macOS light/dark and the pinned `appIcon` choice while working: the frames follow the variant.
- Turn on Reduce motion: a working pane shows the still hot frame.
- While working, trigger attention from another pane with tiili in the background: badge and bounce still appear.
- Check the icon at 32 px (small Dock) and on Windows and Linux taskbars.
