# Building tiili from source

Needs Node.js and Rust (via rustup), plus the [platform prerequisites](packaging.md#prerequisites).

```sh
npm ci
npm run tauri dev     # run the app
npm test              # unit tests
npm run bundle        # installers for this OS, under src-tauri/target/**/bundle/
```

Signing, notarisation, icons and releases are covered in [`packaging.md`](packaging.md).
