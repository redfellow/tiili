## 1. Release script

- [x] 1.1 Add and export `tagPlan(existing, commit)` in `scripts/release.mjs` and use it in `tagMain`: read `git rev-parse --verify --quiet refs/tags/${tag}^{commit}`; create with `git tag -a` when absent, push as is when it equals `commit`, else run `git tag -f -a ${tag} ${commit} -m "Release ${tag}"` before pushing. Add a table-driven "Stale local tag: tagPlan" test to `scripts/release.test.ts`, and rename the "Minor release: rewrites %s" test to "Stamped version: rewrites %s" (the Minor release scenario no longer rewrites files).
  Tests to update: scripts/release.test.ts
  - proof: `npx vitest run scripts/release.test.ts`
  - proof: `npx eslint scripts/release.mjs scripts/release.test.ts`

## 2. Bundle script

- [x] 2.1 In `scripts/bundle.mjs` `main`, spawn `process.execPath` with `[resolve(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args.slice(1)]`, `cwd: root`, `stdio: "inherit"` and no `shell` option. Keep `bundleArgs` unchanged.
  Tests to update: scripts/bundle.test.ts
  - proof: `npx vitest run scripts/bundle.test.ts`
  - proof: `npx eslint scripts/bundle.mjs`
  - proof: `test -f node_modules/@tauri-apps/cli/tauri.js`

## 3. Spec

- [x] 3.1 Keep the packaging delta of this change valid.
  - proof: `openspec validate release-pipeline-secrets-exposure-stale --strict`

## 4. Workflow

- [x] 4.1 (triage) Harden the release workflow: Apple signing step after `npm ci` and the version stamp, `persist-credentials: false` on all three checkouts, rust-toolchain pinned to a commit.
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
            persist-credentials: false
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
          with:
            persist-credentials: false
        - uses: actions/setup-node@v4
          with:
            node-version: lts/*
            cache: npm
        - uses: dtolnay/rust-toolchain@df2a88e9fe4098bad09cb42c3dec7187f15861fc # stable
          with:
            toolchain: stable
        - name: Linux dependencies
          if: matrix.os == 'ubuntu-22.04'
          run: |
            sudo apt-get update
            sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev \
              libssl-dev libayatana-appindicator3-dev librsvg2-dev
        - run: npm ci
        - name: Stamp the version from the tag
          shell: bash
          run: node scripts/stamp-version.mjs "$GITHUB_REF_NAME"
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
          with:
            persist-credentials: false
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

## Manual checks after merge (The user)

- Push the next release tag and check the workflow run: all three bundle jobs pass, and the macOS installer is signed when the Apple secrets are set.
- On Windows, run `npm run bundle` without `TAURI_SIGNING_PRIVATE_KEY` and check the installer is built.
