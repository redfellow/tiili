# Bundled fonts

All are under the SIL Open Font License 1.1 (see OFL.txt for the text; each family has its own copyright holder). The
Nerd Fonts symbols font is under the OFL 1.1 too, by Nerd Fonts' own licence (NerdFonts-LICENSE.txt: patched fonts OFL
1.1, their scripts MIT), with each icon set in it under its own licence (below).

| Family | Source | Notes |
| --- | --- | --- |
| Geist Mono | Vercel, npm `geist` | variable, 100-900 |
| Victor Mono | Rune Bjørnerås, `rubjo/victor-mono` VictorMonoVariable | variable, axis remapped to 300-700 |
| Commit Mono | Eigil Nikolajsen, `eigilnikolajsen/commit-mono` v1.143 | static 400 and 700 only |
| Recursive Mono | Arrow Type, `arrowtype/recursive` v1.085 | variable, instanced with MONO=1, CASL=0, 300-1000 |
| Cascadia Code | Microsoft, `microsoft/cascadia-code` v2407.24 | variable, 200-700 |
| Symbols Nerd Font Mono | Ryan L McIntyre, `ryanoasis/nerd-fonts` v3.5.1 NerdFontsSymbolsOnly | `SymbolsNerdFontMono-Regular.woff2`: converted to woff2 unchanged; the source for the file below, not loaded by the app |
| Tiili Symbols Cell | Modified Version of Symbols Nerd Font Mono, made by `scripts/fit-symbols.py` | `SymbolsNerdFontMono-Cell.woff2`, the icon fallback: every icon except the powerline glyphs (U+E0A0-E0D7) scaled to 60% (one 0.6em cell) and moved up to centre on the text; renamed, still OFL 1.1 |

## Icon sets in the symbols fonts

As listed by Nerd Fonts v3.5.1 (`src/glyphs/README.md`). In Tiili Symbols Cell every icon below except the powerline
ones is changed: scaled to 60% and moved up 359 units (of 2048), with its hinting dropped. Nothing else is changed.

| Icon set | Upstream | Licence |
| --- | --- | --- |
| Codicons | `microsoft/vscode-codicons` 0.0.45 | CC BY 4.0 |
| Devicons | `devicons/devicon` 2.17.0 | MIT |
| Hack extra glyphs | `source-foundry/Hack` | MIT |
| Font Awesome | `FortAwesome/Font-Awesome` 6.5.1 | CC BY 4.0 (icons) |
| Font Awesome Extension | `AndreLZGava/font-awesome-extension` 0.0.3 | MIT |
| Font Logos | `lukas-w/font-logos` 1.3.0 | Unlicense |
| Material Design Icons | `Templarian/MaterialDesign-Font` (Oct 2022) | Apache 2.0 |
| Octicons | `primer/octicons` 18.3.0 | MIT |
| Seti-UI and Nerd Fonts originals | `jesseweed/seti-ui` 0.8.1 | MIT |
| Pomicons | `gabrielelana/pomicons` 1.001 | OFL 1.1 with Reserved Font Name (not used by either font's name) |
| Powerline Extra Symbols | `ryanoasis/powerline-extra-symbols` 1.200 | MIT |
| Powerline Symbols | `powerline/powerline` | MIT |
| IEC Power Symbols | `jloughry/Unicode` | MIT |
| Weather Icons | `erikflowers/weather-icons` 2.0.10 | OFL 1.1 |

Berkeley Mono and Cartograph CF are commercial and not bundled; they show under OS when installed.
