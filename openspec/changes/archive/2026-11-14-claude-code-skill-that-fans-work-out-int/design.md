## Approach

- Skill: plain Markdown with YAML frontmatter (`name: tiili-tiles`, `description`) under `integrations/claude/skills/tiili-tiles/`. Body: preflight (PATH + `gh auth status`), a generic "one tile per task" procedure, then the PR-review recipe (pick PRs, `git worktree add` + `gh pr checkout` per PR, `tiili open --cwd`). The review prompt asks Claude to review the checked-out PR against its base with `gh pr diff`.
- Install command: `main.rs` checks `std::env::args()` for `install-claude-skill` before `tiili_lib::run()`, alongside however the `tiili open` CLI card dispatches subcommands (follow its pattern if merged first). A new `src-tauri/src/claude_skill.rs` embeds the file with `include_str!` and has `install(home: &Path) -> io::Result<PathBuf>` creating the directory and writing the file, so it can be tested against a temp home.
- Why embed: the command works from any installed build without locating resources on disk.
