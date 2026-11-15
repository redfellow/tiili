"""Make src/assets/fonts/SymbolsNerdFontMono-Cell.woff2 from the unchanged Symbols Nerd Font Mono.

The upstream icons are drawn in a 1em square, but a terminal cell is about 0.6em wide, so xterm's DOM renderer lets
each icon spill 40% into the next cell, where that cell's background paints over it. This scales every icon to one
0.6em cell and centres it on the text's cap-height middle (0.355em above the baseline, Geist Mono). The powerline
glyphs (U+E0A0-E0D7) stay as they are, so separators still fill the row.

The result is a Modified Version under the SIL OFL 1.1 (see src/assets/fonts/LICENSES.md), so it gets its own name.

Run once when the upstream font changes (needs `pip install fonttools brotli`):
    python3 scripts/fit-symbols.py
"""

from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts"
SOURCE = FONTS / "SymbolsNerdFontMono-Regular.woff2"
TARGET = FONTS / "SymbolsNerdFontMono-Cell.woff2"
CELL_EM = 0.6
CENTRE_EM = 0.355
FAMILY = "Tiili Symbols Cell"


def is_powerline(codepoint: int) -> bool:
    return 0xE0A0 <= codepoint <= 0xE0D7


def main() -> None:
    font = TTFont(SOURCE)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    glyf, hmtx = font["glyf"], font["hmtx"]

    keep = {g for cp, g in cmap.items() if is_powerline(cp)}
    shared = keep & {g for cp, g in cmap.items() if not is_powerline(cp)}
    assert not shared, f"glyphs both powerline and icon: {shared}"

    # The icons' square has its middle halfway between hhea ascent and descent (0.3em above the baseline).
    old_middle = (font["hhea"].ascent + font["hhea"].descent) / 2
    shift = CENTRE_EM * upm - CELL_EM * old_middle
    advance = round(CELL_EM * upm)

    # Record every glyph decomposed before changing any, so composites are not transformed twice.
    recorded = {}
    for name in font.getGlyphOrder():
        if name in keep or name == ".notdef":
            continue
        pen = DecomposingRecordingPen(glyphs)
        glyphs[name].draw(pen)
        recorded[name] = pen
    for name, pen in recorded.items():
        out = TTGlyphPen(None)
        pen.replay(TransformPen(out, (CELL_EM, 0, 0, CELL_EM, 0, shift)))
        glyph = out.glyph()
        glyph.recalcBounds(glyf)
        glyf[name] = glyph
        old_advance, _ = hmtx[name]
        hmtx[name] = (advance if old_advance else 0, glyph.xMin if glyph.numberOfContours else 0)
    font["hhea"].advanceWidthMax = max(a for a, _ in hmtx.metrics.values())

    # OFL 1.1: a Modified Version is renamed so it is not mistaken for the upstream font.
    names = {
        1: FAMILY,
        3: f"{FAMILY} (from {font['name'].getDebugName(3)})",
        4: FAMILY,
        5: f"{font['name'].getDebugName(5)}; rescaled by tiili scripts/fit-symbols.py",
        6: "TiiliSymbolsCell",
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID]
    for table in ("hdmx", "LTSH", "VDMX"):
        if table in font:
            del font[table]

    font.flavor = "woff2"
    font.save(TARGET)
    print(f"{TARGET.name}: {len(recorded)} glyphs scaled by {CELL_EM}, shifted {shift:.0f} units, "
          f"advance {advance}; {len(keep)} powerline glyphs kept")


if __name__ == "__main__":
    main()
