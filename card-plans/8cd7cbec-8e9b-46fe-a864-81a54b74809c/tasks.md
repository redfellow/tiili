## 1. Harden plainNotes

- [ ] 1.1 Loop the tag removal in `plainNotes` (src/updates.ts) until the text is stable, then strip leftover `<` and `>`; add a comment that the output is shown as text, not HTML. Add a table-driven test to src/updates.test.ts for `<scr<b>ipt>alert(1)</script>`, `<<b>b>` and a stray `<`.
  Tests to update: src/updates.test.ts
  - proof: `npx vitest run src/updates.test.ts`
  - proof: `npx eslint src/updates.ts src/updates.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Check that code scanning alert 1 (https://github.com/redfellow/tiili/security/code-scanning/1) closes after the next CodeQL run on main.
