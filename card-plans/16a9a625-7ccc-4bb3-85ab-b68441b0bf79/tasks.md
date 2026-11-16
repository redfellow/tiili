# Tasks

- [x] 1.1 README install section: say builds are not notarised or certificate-signed, and give the macOS xattr and codesign commands for a damaged-app warning
  - proof: `grep -F 'codesign --force --deep --sign - /Applications/tiili.app' README.md`
  - proof: `grep -F 'xattr -dr com.apple.quarantine /Applications/tiili.app' README.md`
- [x] 1.2 Download page (site/index.html): same wording and commands as the README
  - proof: `grep -F 'codesign --force --deep --sign - /Applications/tiili.app' site/index.html`
  - proof: `npx vitest run src/docs-sync/links.test.ts`
