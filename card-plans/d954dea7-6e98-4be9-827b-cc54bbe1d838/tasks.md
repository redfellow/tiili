## 1. Security review

- [x] 1.1 Scan tracked files and git history for committed secrets, private keys and key/certificate files; remove any found (none found)
  - proof: `! git grep -nIE 'BEGIN (RSA |EC |OPENSSH |PRIVATE)|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20}' -- . ':!card-plans'`
  - proof: `test -z "$(git log --all --name-only --format= | grep -iE '\.(p12|pfx|p8|pem|key)$|id_rsa|(^|/)\.env')"`
- [x] 1.2 Review scripts, CI workflows, Rust commands, dev bridge and the vendored Heynote build for hidden or suspicious behaviour; remove any found (none found: dev bridge listens on 127.0.0.1 behind a token, note paths are confined to the notes folder, bundle has no eval, beacon or extra sockets; open points captured as a finding)
  - proof: `! git grep -nIE 'sendBeacon|new WebSocket|XMLHttpRequest' -- heynote scripts src-tauri/src public/heynote/assets/index-CFDoj-62.js`
- [x] 1.3 Check dependency sources: every npm package resolves from registry.npmjs.org and every crate from crates.io
  - proof: `test -z "$(grep '"resolved"' package-lock.json | grep -v 'registry.npmjs.org')"`
  - proof: `test -z "$(grep '^source' src-tauri/Cargo.lock | grep -v 'registry+https://github.com/rust-lang/crates.io-index')"`
