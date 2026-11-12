# Building this workspace

Rules for implementers and fixers, on top of härvääjä's own. Keep them about this workspace: the commands that
run one test file, lint or type check, and conventions the code must follow.

## Current state

- As of commit 006e836 the repository has no code, test runner, linter, type checker or build. Its only checked
  artifacts are OpenSpec changes and specs. Run `openspec validate --all --strict` after editing them.
- Do not invent a command to run a test, lint or type check. If the change needs one that does not exist yet,
  say so in your report rather than adding a stub.

## Proofs

- Run only the test files that cover what you changed, with this workspace's test runner.
- A new test gets a first-line comment `@harvaaja-test-tier: fast`, `integration` or `host`: fast for
  isolated logic, integration for anything that needs real processes, files or services, host for what can't
  run in the sandbox.
