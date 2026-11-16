## Approach
- **Release profile**: measured at -11.3 MB on the main binary. `panic = "abort"` is safe only if nothing catches unwinds. Grep `src-tauri/src` for `catch_unwind` and for a panic hook that relies on unwinding, and record the result in the PR. To choose the opt-level, build both variants and time `yes | head -c 500M` (or `cat` of a large file) through a pane's PTY path. Pick `"s"` unless `3` is clearly faster (more than about 5%). Note the CI build time.
- **Heynote fonts**: WebKit, WebView2 and WebKitGTK all take the woff2 that main.css lists first. After `vite build`, find `assets/*.woff` and remove each `url(...) format("woff")` entry together with its comma from every CSS file in `assets/`. Throw if no `.woff` was found, if any `.woff` URL remains, or if a removed font has no `.woff2` sibling. Then delete the files.
- **DMG**: after `tauri build` succeeds on darwin, `hdiutil convert <dmg> -format ULMO -o <tmp>`. Replace the original, then `codesign --force --sign "$APPLE_SIGNING_IDENTITY" <dmg>` when that variable is set. When `APPLE_CERTIFICATE` is set too, the signing goes through a temporary keychain the steps import it into, since Tauri deletes its own when its build ends. A pure helper, `dmgPostSteps(env, dmgPath, scratch)` (`scratch` is `{ dir, password }` for the converted file and that keychain), returns `{ steps, cleanup }`: the commands to run in order, and the ones that delete the keychain afterwards even when a step failed, so the unit test can check them.
- **Brotli**: confirm that `tauri` in Cargo.lock pulls in `brotli` through `tauri-codegen`'s `compression` feature, and that nothing turns off default features.

## Findings
- **panic = "abort"**: `src-tauri/src` has no `catch_unwind`, `resume_unwind` or `std::panic` hook, so nothing relies on unwinding.
- **Opt-level**: measured on an M-series Mac (arm64), `--release --no-default-features`. The PTY path's per-chunk work
  (CwdTracker and CommandTracker `feed_output`, CommandLineScanner `feed`, OutputSink `write`, FlowGate) over 2 GB of
  `yes` output in 8 KiB chunks, five runs each. The pseudo-terminal itself was left out, because the build sandbox
  refuses `openpty`; the per-byte work is the part the opt-level changes.

  | Build | tiili | tiili-cli | Throughput (5 runs) | Cold build |
  |---|---|---|---|---|
  | Untuned release (opt 3, no LTO) | 19.4 MB | 887 KB | 4.49–4.80 GB/s | not measured |
  | LTO + strip, opt-level 3 | 7.8 MB | 469 KB | 4.51–4.75 GB/s | 6m30s |
  | LTO + strip, opt-level "s" | 6.1 MB | 420 KB | 4.61–4.95 GB/s | 4m31s |

  Opt-level 3 is not faster (the work is memcpy-bound), so `"s"` is chosen: -13.3 MB on the main binary. The cold
  build times are local; CI's will differ by machine.
- **Brotli**: active. `src-tauri/Cargo.toml` adds only `image-png` to `tauri` and never sets `default-features = false`,
  so tauri's default `compression` feature (`tauri-macros/compression`, `tauri-utils/compression`) is on, and
  Cargo.lock has `brotli` as a dependency of `tauri-codegen` and `tauri-utils`.
