## 1. Network allowlist

- [ ] 1.1 (triage) Allow the package registries and GitHub release downloads
  - file: .harvaaja/network.yaml
  - content:
  ```yaml
  # Hosts the workspace's agents may reach: npm and crates.io registries for npm ci and cargo,
  # and GitHub release downloads for the vendored Geist Mono font.
  allow: [registry.npmjs.org, index.crates.io, static.crates.io, crates.io, github.com, release-assets.githubusercontent.com, objects.githubusercontent.com]
  ```

## Manual checks after merge (The user)

- Rebuild the scaffold card and confirm `npm ci` and `cargo fetch` get past the proxy.
- Confirm the Geist Mono release download from the scaffold card's task 3.2 gets past the proxy.
