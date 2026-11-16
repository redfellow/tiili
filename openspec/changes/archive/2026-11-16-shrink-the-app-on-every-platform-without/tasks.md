## 1. Release profile
- [x] 1.1 Confirm `panic = "abort"` is safe (no `catch_unwind` or unwinding-dependent panic hook in src-tauri/src). Measure PTY throughput with opt-level "s" against 3, both with LTO and strip. Add `[profile.release]` to src-tauri/Cargo.toml with the chosen settings, and record the sizes and timings in the PR.
  - proof: `grep -rn "catch_unwind" src-tauri/src || echo none`
  - proof: `grep -n -A6 "profile.release" src-tauri/Cargo.toml`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [x] 1.2 Confirm the brotli compression of the embedded frontend is active (the `brotli` crate comes in through tauri-codegen's compression feature, and default features are not turned off) and note it in design.md.
  - proof: `grep -n "name = \"brotli\"" src-tauri/Cargo.lock`

## 2. Heynote fonts
- [x] 2.1 In scripts/heynote.mjs, after the vite build, drop the `format("woff")` sources from the CSS and delete the `.woff` files. Fail loudly if the woff and woff2 pairs are missing or if any woff reference is left. Re-run `npm run heynote` to regenerate public/heynote/.
  - proof: `npx eslint scripts/heynote.mjs`
  - proof: `test -z "$(find public/heynote -name '*.woff')" && ! grep -rq 'format("woff")' public/heynote/assets`

## 3. DMG compression
- [x] 3.1 In scripts/bundle.mjs, export a pure helper for the macOS post-build steps (`hdiutil convert -format ULMO` into a temporary file, replace the original, then `codesign --force --sign` only when APPLE_SIGNING_IDENTITY is set, from a temporary keychain of its own when APPLE_CERTIFICATE is set, since Tauri deletes its keychain after the build). Run the steps after a successful darwin build. Add a table-driven case for the signed and unsigned paths in scripts/bundle.test.ts, and declare the helper in scripts/bundle.d.mts.
  Tests to update: scripts/bundle.test.ts
  - proof: `npx vitest run scripts/bundle.test.ts`
  - proof: `npx eslint scripts/bundle.mjs scripts/bundle.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Run `npm run bundle` on macOS and compare the .app, .dmg and .app.tar.gz sizes with 27 MB, 9.4 MB and 11.2 MB.
- Open the DMG, install, and launch: terminals work, the Heynote pane renders Open Sans and Hack, and language auto-detect and math blocks work.
- After the next tagged release, check that the signed DMG passes Gatekeeper (`spctl -a -t open --context context:primary-signature -v <dmg>`).
