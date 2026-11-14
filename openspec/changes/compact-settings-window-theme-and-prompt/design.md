## Approach
Keep `createSettingsForm`'s draft/apply/show/read/lock/adopt structure and swap only how each value is presented.

- **Card grid**: generalise `pickList` into a `cardGrid` helper: same listbox semantics (role, aria-activedescendant, aria-selected, apply on select unless locked, aria-disabled while saving), plus Up/Down by column count read from `getComputedStyle(grid).gridTemplateColumns` track count, clamped without wrapping. Used for theme, prompt and tiling. The font list stays a `pickList`.
- **Segmented**: one helper returning `{ el, value, set(v), setDisabled(b) }`; radiogroup with roving tabindex and wrapping arrows. Used for cursor style, Dock icon and the Remote shells switch. `read()` takes cursor style and Dock icon from it.
- **Info button**: helper building the ⓘ button + `span[role=tooltip]` with an id and `aria-describedby`; CSS shows the tooltip on `:hover` and `:focus-visible`.
- **Preview**: `renderPreview(draft)` builds the two panes from the draft (theme vars are already applied to the window, so panes use `--term-*`/`--ansi-*`; prompt lines from PROMPT_STYLES with promptPreview's ANSI slots; cursor shape/blink; font family/size≤18/weights/line height/letter spacing/ligatures; inactive opacity/desaturate). Called from every change handler path that applies the draft and from `show()`, so Reset, Cancel and adopt follow.
- **Layout**: form is a flex column: tabs, preview (hidden on Behaviour), `.settings-body` (`flex:1; min-height:0; overflow-y:auto`), footer. `.settings-page`/`body.settings-window` get `height:100vh; overflow:hidden`.
- **lock()**: extend its list to every new control (grids via aria-disabled, segmented buttons, Copy, Check now).
- **reset() focus**: focus the theme grid and `scrollIntoView({block:"nearest"})` the selected card.

Why: the existing form logic is proven; only the controls and CSS change, which keeps the risk in presentation.
