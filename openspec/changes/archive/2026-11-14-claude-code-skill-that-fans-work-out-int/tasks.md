## 1. Skill

- [x] 1.1 Write `integrations/claude/skills/tiili-tiles/SKILL.md` (frontmatter, preflight, generic recipe, PR-review recipe with worktree + `gh pr checkout` + `tiili open --cwd`)
  - proof: `grep -E "tiili open --cwd" integrations/claude/skills/tiili-tiles/SKILL.md`

## 2. Install command

- [x] 2.1 Add `src-tauri/src/claude_skill.rs` (embedded skill, `install(home)`) with a unit test writing into a temp home (fresh and overwrite), and dispatch `install-claude-skill` in `main.rs` before the GUI starts
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib claude_skill`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Docs

- [x] 3.1 Add a short "Coding agents" section to README.md (needs gh, claude; install via command or copy)
  - proof: `grep -E "^## Coding agents" README.md`
  - proof: `openspec validate claude-code-skill-that-fans-work-out-int --strict`

## Manual checks after merge (The user)

- Run `tiili install-claude-skill`, then in a repo with open PRs ask Claude Code to review PRs with the skill; three tiles open with the repo tint and each chip shows its PR branch.
- Run the skill with `gh` signed out and check it says so.
