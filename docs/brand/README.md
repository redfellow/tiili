# tiili brand

The brand is drawn from the red-brick mill district of Tampere (Finlayson, Tampella, the Tammerkoski rapids): fired
brick, lime mortar, granite bases, iron railings, arched windows. Type is Geist for everything people read and
Geist Mono for anything that belongs to the terminal.

Open [`brand-book.html`](brand-book.html) in a browser for the full, live reference (light and dark). The
explorations that led to it are in [`explorations/`](explorations/).

## The system

Four parts, each with one job.

| Part | Job | Where |
| --- | --- | --- |
| **Running bond** mark | App icon, favicon, lockup with the wordmark | `logo/` |
| **Brick dots** wordmark | The name wherever it is written | Geist Bold, see below |
| **Brick cursor** | Cursor, focus and accent inside the app | App UI |
| **Maker's stamp** | About window, release notes, stickers, first-run screen | `TIILI` / `TRE · Nº 1` pressed into a brick |

### Running bond mark

Seven bricks in running bond (each course offset by half a brick). The centre brick is the pane that has focus and
carries a `>_` prompt.

| | Light | Dark |
| --- | --- | --- |
| Bricks | tiili `#A4472B` | tiili `#A4472B` |
| Focus brick | klinkkeri `#6B2A1E` | savi `#C9764F` |
| `>_` prompt | white `#FFFFFF` | near-black `#111617` |
| App icon tile | kalkki `#F6F1E9` | koski `#182023` |

- Below 64 px the `>_` is left off (`*-small.svg`); the brick is too small to hold it.
- The app icon tile has a 22.5% corner radius; the mark fills 70% of its width.
- Next to the wordmark the mark stands free, at 0.82× the wordmark's font size, 0.32 em apart.

Files in `logo/`: `mark-{light,dark}[-small].svg` (free-standing) and `icon-{light,dark}[-small].svg` (on the tile).
The prompt is drawn as shapes, so the SVGs do not depend on any font.

### Brick dots wordmark

`tiili` in Geist Bold (700), tracking −0.035 em, all lowercase. The three dots of the i's are small bricks: draw the
word with dotless i's (`ı`, U+0131) and place a brick 0.175 em wide and 0.095 em tall, 0.1 em below the top of the
em box, centred over each stem. Dots are tiili `#A4472B` on light grounds and savi `#C9764F` on dark ones.

### Brick cursor

The terminal's block cursor is a single brick in the accent colour. Focused pane: solid. Other panes: outlined in
the dim text colour. The title bar shows a small brick glyph before the app name.

### Maker's stamp

`TIILI` in Geist Mono Bold, tracked +0.24 em, with `TRE · Nº 1` beneath, pressed into the hollow (the "frog") of a
brick face that runs from `#BA5A33` through tiili to `#8A3820`. The pressed lettering is `#74301C`.

## Palette

Core colours, named after the materials. All values also live in [`tiili.css`](tiili.css).

| Name | Hex | Role |
| --- | --- | --- |
| tiili | `#A4472B` | Brand accent, buttons, cursor |
| klinkkeri | `#6B2A1E` | Pressed states, focus brick on light |
| savi | `#C9764F` | Accent on dark, focus brick on dark |
| laasti | `#E8DECD` | Mortar, light surfaces |
| kalkki | `#F6F1E9` | Light background, icon tile |
| graniitti | `#8D877D` | Muted marks |
| koski | `#182023` | Terminal background, dark surface |
| rauta | `#3A3F45` | Iron, dark project tint |
| ikkuna | `#8FA6A4` | Window glass, cyan |
| muratti | `#861B22` | Ivy, errors |
| koivu | `#D9A43A` | Birch, warnings |
| sammal | `#6E7F4E` | Moss, success |
| taivas | `#6F97B3` | Sky, project tint |

**Project tints**, assigned in this order as new repositories appear: tiili, savi, ikkuna, koivu, sammal, muratti,
taivas, rauta, havu, kaisla, kanerva, kuura, järvi, jäkälä, puolukka, turve. Once all sixteen are in use, a new
repository gets the tint with the fewest open panes (ties go to the lowest number). Labels on dark tints are white; on
light tints they are dark. Tints 9–16 keep their labels above 5:1; sammal sits just under 4.5:1 with white.

| Token | Name | Tint | Label (`-on`) | Contrast |
| --- | --- | --- | --- | --- |
| `--tint-1` | tiili | `#A4472B` | `#FFFFFF` | 6.0:1 |
| `--tint-2` | savi | `#C9764F` | `#2A2321` | 4.5:1 |
| `--tint-3` | ikkuna | `#8FA6A4` | `#1B2224` | 6.3:1 |
| `--tint-4` | koivu | `#D9A43A` | `#2A2321` | 6.8:1 |
| `--tint-5` | sammal | `#6E7F4E` | `#FFFFFF` | 4.4:1 |
| `--tint-6` | muratti | `#861B22` | `#FFFFFF` | 9.6:1 |
| `--tint-7` | taivas | `#6F97B3` | `#16222B` | 5.2:1 |
| `--tint-8` | rauta | `#3A3F45` | `#FFFFFF` | 10.6:1 |
| `--tint-9` | havu (spruce) | `#2F5D4A` | `#FFFFFF` | 7.5:1 |
| `--tint-10` | kaisla (reed) | `#C8B98A` | `#2A2321` | 7.9:1 |
| `--tint-11` | kanerva (heather) | `#8A5A83` | `#FFFFFF` | 5.4:1 |
| `--tint-12` | kuura (frost) | `#B7C7D3` | `#2A2321` | 8.9:1 |
| `--tint-13` | järvi (lake) | `#2E4F6E` | `#FFFFFF` | 8.5:1 |
| `--tint-14` | jäkälä (lichen) | `#A9B48A` | `#2A2321` | 7.0:1 |
| `--tint-15` | puolukka (lingonberry) | `#B23A50` | `#FFFFFF` | 5.8:1 |
| `--tint-16` | turve (peat) | `#5A4632` | `#FFFFFF` | 8.9:1 |

**Contrast.** tiili is too dark to be text on koski (2.7:1), so dark mode uses `#D3865F` for accent text and focus
rings. Buttons keep the tiili fill in both themes with white labels (6.0:1). All text tokens pass 4.5:1 against
their theme's background.

## Type

| Style | Spec |
| --- | --- |
| Display | Geist 700, 56/1.0, −0.04 em |
| Heading 1 | Geist 600, 36/1.1, −0.035 em |
| Heading 2 | Geist 600, 24/1.2, −0.025 em |
| Body | Geist 400, 16/1.6 |
| Small | Geist 400, 13.5/1.5 |
| Label | Geist Mono 500, 11.5, uppercase, +0.08 em |
| Terminal | Geist Mono 400, 13/1.6 |

## Website

- One primary action per screen: tiili fill, white label. Hover darkens (`--accent-hover`), press darkens further.
- Secondary: outlined with `--line`, text in `--fg`. Tertiary: text only, in `--accent-text`.
- Every button gets a 2 px focus ring in `--focus`, offset 2 px from the fill.
- The download button names the platform and file: "Download for macOS · .dmg · 9 MB".

## App visual basis

- Panes sit on `--term-gap`, so the 3 px gaps between them read as mortar joints.
- Focused pane: 2 px tiili line on its top edge and a solid brick cursor. No glow, no border around the pane.
- Inactive panes: outlined cursor, 82% opacity; output keeps streaming.
- With grouping by repository on, the project tint colours the pane's title chip.
- Radii stay small, like bricks: 3 px for brick elements, 6 px for controls, 10 px for windows.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Terminal colours (ANSI 0–15) for both themes are in `tiili.css`.

## Theme variants

Besides tiili Light and tiili Dark, the app's settings offer four variants built from the core palette. Their full
token and ANSI sets live in `src/themes.ts`; this is the first pass, to be revised once they can be seen side by side
(contrast has not been tuned yet).

| Variant | Kind | Ground (window / pane / gap) | Text / muted | Accent (cursor) | Character |
| --- | --- | --- | --- | --- | --- |
| Savi | light | `#F3EEE7` / `#F3EEE7` / `#DDD3C8` | `#2A2321` / `#6F6560` | savi `#C9764F` | Warm light grounds; savi and sammal brighten red and green |
| Muratti | dark | `#151112` / `#1E1919` / `#0E0B0B` | `#F3E7DC` / `#A0948C` | muratti `#861B22` | Warm dark grounds; muratti reds, koivu yellow |
| Koski | dark | `#0F1516` / `#182023` / `#0B0F10` | `#C9CFCD` / `#8A9492` | savi `#C9764F` | Rapids at night; tiili red, ok green `#8FB59A`, ikkuna cyan |
| Laasti | light | `#E8DECD` / `#E8DECD` / `#CFC2AC` | `#2A2321` / `#5E5650` | tiili `#A4472B` | The mortar grid: tiili, klinkkeri, savi and rauta on laasti |

The app also ships Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula with their published palettes.

## Voice

Plain and specific. Say what happened and what can be done. A little Tampere where it fits ("Fired in Tampere"),
never at the cost of clarity.
