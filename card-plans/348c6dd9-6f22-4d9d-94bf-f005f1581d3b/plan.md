# Paste sanitising and pane lifecycle fixes

## Why
Clipboard text containing `ESC[201~` ends bracketed paste early so the shell runs the rest at once (security). Pop Out leaks shells of panes still opening and focuses the wrong pane; `Panes.report()` wipes every tab when the focused pane has no terminal; a Zen edge drag saves the Settings window's unsaved preview.

## What Changes
- `src/clipboard.ts`: exported `sanitizePaste` strips `ESC[200~`/`ESC[201~` and C0 (except \t \n \r), DEL and C1 controls; `run()` calls it before `term.paste`.
- `src/panes.ts` `popOutTab`: skipped panes are `close()`d after the move succeeds; only moved panes are removed/detached; `focused` is the payload index of the focused pane (0 if skipped).
- `src/panes.ts` `report`: replaces root only when no panes exist; else writes to the focused pane's terminal, the first pane with a terminal, or console.error.
- `src/panes.ts`/`src/main.ts`: the `saveSettings` hook becomes `saveZenWidth(columns)`; main.ts saves `{ ...saved, zen: { ...saved.zen, width } }`, adopts it, and re-applies the live preview with the new width. No alias for the old hook.

## Outcome
- Pasting `echo a␛[201~echo PWNED⏎`
  - Now: `echo PWNED` runs immediately
  - After: nothing runs until Enter

## Acceptance
`npx vitest run src/clipboard.test.ts`, `npm run typecheck`, lint of touched files; manual checks below.

## Citations
- openspec/specs/clipboard/spec.md (Platform copy and paste shortcuts)
- openspec/specs/settings/spec.md, openspec/specs/pane-tiling/spec.md

## Assumptions
- Stripped control characters are dropped silently, not shown or warned about (ruled out a warning prompt).
- No spec change: behaviour matches existing intent (ruled out a new clipboard requirement).
