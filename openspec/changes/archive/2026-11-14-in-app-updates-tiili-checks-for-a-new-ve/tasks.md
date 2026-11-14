# Tasks

## 1. Rust and config

- [x] 1.1 Add `tauri-plugin-updater` and `tauri-plugin-process` to `src-tauri/Cargo.toml`, register both in `src-tauri/src/lib.rs`, add `updater:default` and `process:allow-restart` to `src-tauri/capabilities/default.json`, and add the `update_install_kind` command with a pure `install_kind(os, appimage_set)` helper and a table-driven unit test (linux+no APPIMAGE → deb; linux+APPIMAGE, macos, windows → bundle).
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib install_kind`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [x] 1.2 In `src-tauri/tauri.conf.json` set `bundle.createUpdaterArtifacts: true` and `plugins.updater` with endpoint `https://github.com/redfellow/tiili/releases/latest/download/latest.json` and pubkey `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDc3RTYwRDNFQjg1Mjk0OUUKUldTZWxGSzRQZzNtZDd1MVk2UHVrNTArTkd6c2lsZGZQK2lNMmkxcndZUTl5TitsbEhXWGx5cjUK`. In `scripts/bundle.mjs` add `--config` turning `createUpdaterArtifacts` off when `TAURI_SIGNING_PRIVATE_KEY` is unset (export the argument builder and test it).
  - proof: `node -e "const c=require('./src-tauri/tauri.conf.json');if(!c.bundle.createUpdaterArtifacts||!c.plugins.updater.pubkey)process.exit(1)"`
  - proof: `npx vitest run scripts/bundle.test.ts`
  - proof: `npx eslint scripts/bundle.mjs scripts/bundle.test.ts`

## 2. Frontend

- [x] 2.1 Add `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`; add `updates: { autoCheck: boolean }` to `Settings` (default true, invalid → true) in `src/settings.ts` with a case in the existing normalise test table.
  - proof: `npx vitest run src/settings.test.ts`
- [x] 2.2 Add `src/updates.ts` (pure `shouldAutoCheck`, `isSkipped`, localStorage last-check and skipped version, check/install/relaunch flow, deb branch via `update_install_kind`) with `src/updates.test.ts` (fast tier, table-driven for the 24 h rule and skip rule); add `src/updateDialog.ts` for the in-app dialog (versions, preformatted notes, Install now / Later / Skip this version, progress, error, deb variant with Open release page) and start the check from the main window in `src/main.ts`.
  - proof: `npx vitest run src/updates.test.ts`
  - proof: `npx eslint src/updates.ts src/updates.test.ts src/updateDialog.ts src/main.ts`
- [x] 2.3 Add the Updates section to the Behaviour tab in `src/settingsDialog.ts` (checkbox bound to `updates.autoCheck`, Check for updates button with inline result `tiili is up to date.` / `Couldn't check for updates.` or the dialog), styles in `src/styles.css`.
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## 3. Release

- [x] 3.1 Add `scripts/updater-manifest.mjs` (+ `.d.mts`) that, given the tag, a folder of `.sig` files and a notes file, prints `latest.json` (version without `v`, notes, `pub_date`, platforms darwin-aarch64 / windows-x86_64 / linux-x86_64 each with url `https://github.com/redfellow/tiili/releases/download/<tag>/<file>` and the signature text), failing when a platform's signature is missing; test in `scripts/updater-manifest.test.ts` (fast tier).
  - proof: `npx vitest run scripts/updater-manifest.test.ts`
  - proof: `npx eslint scripts/updater-manifest.mjs scripts/updater-manifest.test.ts`
- [x] 3.2 (triage) Sign updater bundles, upload them with their signatures, and add the manifest job.
  - file: .github/workflows/release.yml
  - content:
  ```yaml
  name: release
  on:
    push:
      tags: ["v*"]

  permissions:
    contents: write
    # The release notes read the promotion pull requests' bodies.
    pull-requests: read

  jobs:
    draft:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
          with:
            # The notes need the earlier tags and main's history since the previous release.
            fetch-depth: 0
        # The version comes from the tag, not from package.json: releases do not commit version bumps.
        - name: Tag is a version
          run: |
            if ! [[ "$GITHUB_REF_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              echo "Tag $GITHUB_REF_NAME is not a vX.Y.Z version"
              exit 1
            fi
        - name: Create draft release
          env:
            GH_TOKEN: ${{ github.token }}
          run: |
            if gh release view "$GITHUB_REF_NAME" >/dev/null 2>&1; then exit 0; fi
            # Notes from the promotions since the previous tag; GitHub's generated notes if that fails.
            if node scripts/release-notes.mjs "$GITHUB_REF_NAME" > "$RUNNER_TEMP/notes.md"; then
              gh release create "$GITHUB_REF_NAME" --draft --notes-file "$RUNNER_TEMP/notes.md" --title "tiili $GITHUB_REF_NAME"
            else
              gh release create "$GITHUB_REF_NAME" --draft --generate-notes --title "tiili $GITHUB_REF_NAME"
            fi

    bundle:
      needs: draft
      strategy:
        fail-fast: false
        matrix:
          os: [macos-latest, windows-latest, ubuntu-22.04]
      runs-on: ${{ matrix.os }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: lts/*
            cache: npm
        - uses: dtolnay/rust-toolchain@stable
        - name: Linux dependencies
          if: matrix.os == 'ubuntu-22.04'
          run: |
            sudo apt-get update
            sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev \
              libssl-dev libayatana-appindicator3-dev librsvg2-dev
        - name: Signing variables from secrets that are set
          if: matrix.os == 'macos-latest'
          shell: bash
          env:
            APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
            APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
            APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
            APPLE_ID: ${{ secrets.APPLE_ID }}
            APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
            APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          run: |
            for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
              value="${!name}"
              if [ -n "$value" ]; then
                {
                  echo "$name<<__END__"
                  echo "$value"
                  echo "__END__"
                } >> "$GITHUB_ENV"
              fi
            done
        - run: npm ci
        - name: Stamp the version from the tag
          shell: bash
          run: node scripts/stamp-version.mjs "$GITHUB_REF_NAME"
        - name: Updater signing key
          shell: bash
          env:
            TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
            TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          run: |
            if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
              echo "::warning::TAURI_SIGNING_PRIVATE_KEY is not set: building installers without updater bundles"
              exit 0
            fi
            for name in TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD; do
              {
                echo "$name<<__END__"
                echo "${!name}"
                echo "__END__"
              } >> "$GITHUB_ENV"
            done
        - run: npm run bundle
        - name: Upload installers
          shell: bash
          env:
            GH_TOKEN: ${{ github.token }}
          run: |
            # find, not globstar: the macOS runner's /bin/bash is 3.2, which has no globstar.
            files=()
            while IFS= read -r file; do files+=("$file"); done < <(find src-tauri/target -type f \( \
              -path '*/bundle/dmg/*.dmg' -o -path '*/bundle/nsis/*.exe' -o \
              -path '*/bundle/appimage/*.AppImage' -o -path '*/bundle/deb/*.deb' -o \
              -path '*/bundle/macos/*.app.tar.gz' -o -path '*/bundle/*/*.sig' \))
            if [ ${#files[@]} -eq 0 ]; then
              echo "No installers found"
              exit 1
            fi
            gh release upload "$GITHUB_REF_NAME" "${files[@]}" --clobber

    manifest:
      needs: bundle
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: lts/*
        - name: Assemble and upload latest.json
          env:
            GH_TOKEN: ${{ github.token }}
            HAS_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}
          run: |
            if [ "$HAS_KEY" != "true" ]; then
              echo "::warning::TAURI_SIGNING_PRIVATE_KEY is not set: skipping latest.json, so installed apps will not see this release"
              exit 0
            fi
            mkdir -p "$RUNNER_TEMP/sigs"
            gh release download "$GITHUB_REF_NAME" --pattern '*.sig' --dir "$RUNNER_TEMP/sigs"
            gh release view "$GITHUB_REF_NAME" --json body --jq .body > "$RUNNER_TEMP/notes.md"
            node scripts/updater-manifest.mjs "$GITHUB_REF_NAME" "$RUNNER_TEMP/sigs" "$RUNNER_TEMP/notes.md" > "$RUNNER_TEMP/latest.json"
            gh release upload "$GITHUB_REF_NAME" "$RUNNER_TEMP/latest.json" --clobber
  ```

## 4. Docs

- [x] 4.1 Update README.md, site/index.html (both "no telemetry" lines), docs/concept.md and docs/packaging.md: the update check is one anonymous request to GitHub once a day, off in Settings; packaging docs explain the updater secrets, the skip-with-warning, and that `.deb` installs are pointed at the release page. Say nothing promising macOS signing.
  - proof: `grep -n "anonymous request" README.md site/index.html docs/packaging.md`
  - proof: `openspec validate in-app-updates-tiili-checks-for-a-new-ve --strict`

## Manual checks after merge (The user)

- Release a version with the secrets set and confirm `latest.json` is on the release with three platforms.
- On an installed older build, start tiili: "Install update?" shows the notes; Install now updates and restarts (macOS, Windows, AppImage).
- On a `.deb` install, the dialog offers Open release page instead.
- Skip this version, restart next day: no dialog. Settings → Behaviour → Check for updates still finds it.
- Turn automatic checks off: no request at startup.
