## 1. Windows installer as .exe

- [ ] 1.1 Change the Windows bundle target from `msi` to `nsis` in `src-tauri/tauri.conf.json` and `--bundles nsis` in `scripts/bundle.mjs` (and its header comment)
  - proof: `grep -E '"nsis"' src-tauri/tauri.conf.json`
  - proof: `npx eslint scripts/bundle.mjs`

## 2. Release command

- [ ] 2.1 Add `scripts/release.mjs` (+ `scripts/release.d.mts`) exporting `bumpVersion(version, kind)`, `setJsonVersion(text, version)` and `setCargoVersion(text, version)` (only the `[package]` version line), and a CLI that refuses a missing/unknown kind or a dirty tree, rewrites `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, syncs `package-lock.json` (`npm install --package-lock-only`) and `src-tauri/Cargo.lock`, commits `Release vX.Y.Z`, tags `vX.Y.Z` and runs `git push --follow-tags`; add `"release": "node scripts/release.mjs"` to `package.json`
  - proof: `npx eslint scripts/release.mjs`
- [ ] 2.2 Add `scripts/release.test.ts` (`@harvaaja-test-tier: fast`), one table-driven test for `bumpVersion` (patch/minor/major, unknown kind throws) and one for the rewriters (Cargo dependency `version =` lines untouched)
  - proof: `npx vitest run scripts/release.test.ts`
  - proof: `npx eslint scripts/release.mjs scripts/release.test.ts`
  - proof: `npm run typecheck`

## 3. Docs and spec

- [ ] 3.1 Update `docs/packaging.md`: `.exe` instead of `.msi`, a "Releasing" section (`npm run release <kind>`, what CI does, publishing the draft), and point the CI section at `.github/workflows/release.yml` instead of the sample
  - proof: `grep -E 'npm run release' docs/packaging.md`
  - proof: `openspec validate design-release-pipeline-interview-me-win --strict`

## 4. Release workflow

- [ ] 4.1 (triage) Add the tag-triggered release workflow
  - file: .github/workflows/release.yml
  - content:
  ```yaml
  name: release
  on:
    push:
      tags: ["v*"]

  permissions:
    contents: write

  jobs:
    draft:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Tag matches package.json
          run: |
            version=$(node -p "require('./package.json').version")
            if [ "v$version" != "$GITHUB_REF_NAME" ]; then
              echo "Tag $GITHUB_REF_NAME does not match package.json version $version"
              exit 1
            fi
        - name: Create draft release
          env:
            GH_TOKEN: ${{ github.token }}
          run: gh release view "$GITHUB_REF_NAME" >/dev/null 2>&1 || gh release create "$GITHUB_REF_NAME" --draft --generate-notes --title "tiili $GITHUB_REF_NAME"

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
          with:
            targets: ${{ matrix.os == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
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
        - run: npm run bundle
        - name: Upload installers
          shell: bash
          env:
            GH_TOKEN: ${{ github.token }}
          run: |
            shopt -s globstar nullglob
            files=(src-tauri/target/**/bundle/dmg/*.dmg src-tauri/target/**/bundle/nsis/*.exe src-tauri/target/**/bundle/appimage/*.AppImage src-tauri/target/**/bundle/deb/*.deb)
            if [ ${#files[@]} -eq 0 ]; then
              echo "No installers found"
              exit 1
            fi
            gh release upload "$GITHUB_REF_NAME" "${files[@]}" --clobber
  ```

## Manual checks after merge (The user)

- Run `npm run release patch` on a clean checkout and confirm the tag is pushed and the four version files agree.
- On GitHub, confirm the draft release for that tag holds the universal `.dmg`, the `-setup.exe`, the `.AppImage` and the `.deb`, then publish it.
- Install the `.exe` on Windows and the `.dmg` on an Intel and an Apple Silicon Mac, and confirm tiili starts.
