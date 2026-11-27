# A card that edits a host-only Rust test must run that test on the host as a proof

## Why

Card 1e34b7c8 (#259) changed the pane records in `tiili list --json` and edited `src-tauri/tests/control_cli.rs`,
but the test that checks that JSON (`listener::open_and_list_reach_the_app_and_print_its_answer`) is
`#[ignore = "host: ..."]`: it binds a Unix socket, which the sandbox refuses. Proofs always run in the sandbox, so
the card's `cargo test --test control_cli` only compiled it and reported it ignored. Only the `cargo-test-host`
release check runs it, so the stale expected JSON merged and `hv/main` at 3de784a failed at release (fixed by
#260). A written rule alone can't close this, because a proof can't leave the sandbox. Reijo chose a host card
check plus written rules, covering every host-tier test target.

## What Changes

- `.harvaaja/checks.yaml`: a new check `cargo-test-host-card`, `stage: every`, `sandbox: none`. härvääjä lets an
  every-round check leave the sandbox only with a `tests` block, which runs just the affected test files. Its
  `affected` listing names every test target holding a `#[ignore = "host: ..."]` test when the card changed
  anything under `src-tauri/` since the last run, and nothing otherwise. Its `only` command turns those files
  into `--test <name>` flags and runs them with `--include-ignored`. The targets are found by that attribute, so a
  new host test is picked up without editing the check. Today that is `control_cli`, `control_server`,
  `dev_bridge`, `pty_registry`, `pty_resize_panes`, `pty_session` and `repo_tracking` (`dev_bridge` is tagged
  `integration` on its first line, but one of its tests is a host test). Its `run` line runs the same set whole,
  for main's batch. The comments on `cargo-test-host` stop saying no card check runs the host tests.
  `cargo-test-host` stays at release for the whole suite.
- `.harvaaja/instructions/plan.md`: a rule for planners. A task that edits a host-tier test file, or the code one
  covers, names `cargo test --manifest-path src-tauri/Cargo.toml --test <name>` as its proof. That proof compiles
  the target in the sandbox, and `cargo-test-host-card` runs it on the host before merge. The plan never names
  `-- --include-ignored` as a proof, since that fails in the sandbox.
- `.harvaaja/instructions/build.md`: the old line "Card checks don't run the Rust tests: only `cargo-test-host`
  at release does" is replaced. Builders learn that `cargo-test-host-card` runs the host tests on the card, that a
  host test needs its `#[ignore = "host: ..."]` attribute so the check finds it, and that a failure there is theirs to fix on
  the card.
- `.harvaaja/review.md`: a "Tests" section. Every test file the change edits is run by a task's proof, and
  host-tier files are run by `cargo-test-host-card` too. A new test that binds a socket or opens a PTY carries
  the `#[ignore = "host: ..."]` attribute and the host tag.

These are all human-only paths, so each is a (triage) task that Reijo allows in Triage.

## Acceptance

- `cargo-test-host-card` is in `.harvaaja/checks.yaml` at `stage: every` with `sandbox: none` and a `tests`
  block, and härvääjä's own checks parser accepts the file (tried during planning).
- Its `affected` listing prints the seven host targets when `src-tauri/` changed and nothing when it didn't, and
  its `only` and `run` commands expand to `cargo test ... --test control_cli ... --test repo_tracking --
  --include-ignored`. Both were tried during planning.
- plan.md, build.md and review.md state the rule where planners, builders and reviewers read it.

## Manual checks after merge (The user)

- On the next card after the merge that changes `src-tauri/`, `cargo-test-host-card` shows in the card's checks, runs the seven host targets
  with their ignored tests (the listener test in `control_cli` among them) and passes. Note its time per card.
- Change an expected string in an ignored host test on a throwaway card and check that `cargo-test-host-card`
  fails on the card, before merge.

## Citations

- `.harvaaja/checks.yaml` (`cargo-test-host`: `stage: release`, `sandbox: none`)
- härvääjä's check schema: `sandbox: none` on a `stage: every` check needs a `tests` block (`report`, `affected` with `{since}`, `only` with `{files}`)
- `.harvaaja/instructions/build.md` ("Card checks don't run the Rust tests: only `cargo-test-host` at release does")
- `.harvaaja/instructions/plan.md` (Proofs)
- `src-tauri/tests/control_cli.rs:284` (`#[ignore = "host: binds a Unix socket, ..."]`)
- `#[ignore = "host: ..."]` in `control_cli.rs`, `control_server.rs`, `dev_bridge.rs:123`, `pty_registry.rs`,
  `pty_resize_panes.rs`, `pty_session.rs`, `repo_tracking.rs`

## Assumptions

- The check finds the host targets with `grep` for the `#[ignore = "host:` attribute, so the list can't go stale.
  The other options were a fixed list of `--test` flags that someone would have to update for each new host
  test, or the first-line tier tag, which misses `dev_bridge`.
- A card that changes anything under `src-tauri/` runs all seven host targets, since which Rust code a target
  covers can't be told from file names. The alternative was to run only the host test files the card edited,
  which would have missed this card's very case: a change in `src/` behind an unedited test.
- `cargo test` writes no JUnit report, so `$HV_REPORT` stays unwritten and a failure counts against the whole
  check rather than one file. The alternative was a converter such as `cargo2junit`, a new tool to install.
- The check is named `cargo-test-host-card`, its timeout is 1200 s like `cargo-test-host`, and it gets no
  `network:`, because `install` already fetched the crates. The alternative would have been to rename or reuse
  `cargo-test-host`.
- `cargo-test-host` stays at release for the whole suite, including the `--lib` and `--bins` tests. The other
  option was to remove it now that the host targets run on cards.
- The `#[ignore = "host: ..."]` reasons in the test files still say "the cargo-test-host release check runs it",
  and they are left as they are: the release check still runs them. Rewording them would have meant editing seven
  test files for wording only.
