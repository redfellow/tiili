## Why
The README named tiili's own licence, the fonts and Heynote, but not the rest of the third-party code the app ships: the code bundled inside the Heynote build, the frontend's npm packages and the Rust crates. Each of those licences asks for credit.

## What Changes
- `npm run licenses` writes `THIRD_PARTY_LICENSES.md`, with every npm package the frontend ships and every Rust crate compiled into the app, each with its version and licence.
- `npm run heynote` also writes `public/heynote/THIRD_PARTY.md`. It lists the npm packages Vite actually put into the Heynote bundle, plus Heynote's own bundled assets: Hack, Open Sans, math.js and guesslang-js.
- The README's License section, the last section of the README, lists each group and links these files.
- The README tagline reads "for running many terminals side by side".

## Outcome
- Licences
  - Before: the README credits tiili, the fonts and Heynote
  - After: every bundled third-party package is listed with its licence

## Assumptions
- The lists give each package's name, version and licence, and point to the package's own source for the full licence texts. Shipping every licence text inside the app is out of scope.
- The lists are generated and committed. They are refreshed by hand after dependency changes, not by a check.
