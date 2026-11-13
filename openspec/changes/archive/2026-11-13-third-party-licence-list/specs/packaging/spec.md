## ADDED Requirements

### Requirement: Third-party licence list
The repository SHALL list, with name, version and licence, every third-party npm package the frontend ships and every Rust crate compiled into the app (`THIRD_PARTY_LICENSES.md`, from `npm run licenses`), and every package and asset in the Heynote build (`public/heynote/THIRD_PARTY.md`, from `npm run heynote`). The README's License section SHALL be its last section and SHALL link both lists, the fonts' licences and Heynote's licence.

#### Scenario: Regenerate after a dependency change
- **WHEN** a dependency is added and `npm run licenses` runs
- **THEN** `THIRD_PARTY_LICENSES.md` lists the new package with its licence

#### Scenario: Heynote bundle
- **WHEN** `npm run heynote` finishes
- **THEN** `public/heynote/THIRD_PARTY.md` lists the npm packages in the bundle and Heynote's bundled fonts and scripts
