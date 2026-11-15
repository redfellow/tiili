/**
 * The `brand/tokens` rule: colours and token-sized lengths must come from docs/brand/tiili.css.
 *
 * CSS (the `@eslint/css` language): every colour literal in a declaration value is reported, and a size that exactly
 * equals a token of its property's family (radius, spacing, font size). JS/TS: a string literal or template part is
 * checked when its whole value is a colour or a CSS value holding one. An exact match is fixed to `var(--token)`;
 * any other colour gets a suggestion naming the nearest token by OKLab ΔE. A `tokens-allow: <reason>` comment on the
 * literal's line or the line before it allows it; so do the files and theme ids given as options.
 *
 * The `html-style` processor hands the `<style>` blocks of an HTML page to the CSS language as one virtual `.css`
 * file, with everything outside them blanked so lines and offsets stay the page's own.
 */
import { readFileSync } from "node:fs";

const TOKENS_FILE = new URL("../docs/brand/tiili.css", import.meta.url);

// CSS named colours (CSS Color 4), as name and hex.
const NAMED = new Map(
  (
    "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 " +
    "black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 " +
    "chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff " +
    "darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 " +
    "darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 " +
    "darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f " +
    "darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 " +
    "dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc " +
    "ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 " +
    "honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa " +
    "lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff " +
    "lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 " +
    "lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 " +
    "lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 " +
    "mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 " +
    "mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 " +
    "midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 " +
    "oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa " +
    "palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f " +
    "pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f " +
    "royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee " +
    "sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa " +
    "springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 " +
    "violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
  )
    .split(" ")
    .reduce((pairs, word, i, words) => (i % 2 ? pairs : [...pairs, [word, `#${words[i + 1]}`]]), []),
);

/** A colour literal as `{ r, g, b, a }` (0–255 channels, alpha 0–1), or null when `text` is not one. */
export function parseColour(text) {
  const value = text.trim().toLowerCase();
  if (NAMED.has(value)) return parseColour(NAMED.get(value));
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
    const [r, g, b, a = 255] = digits.match(/../g).map((pair) => parseInt(pair, 16));
    return { r, g, b, a: a / 255 };
  }
  const fn = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(value);
  if (!fn) return null;
  const parts = fn[2].trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const number = (part, scale) => {
    const n = parseFloat(part);
    if (Number.isNaN(n)) return NaN;
    return part.endsWith("%") ? (n / 100) * scale : n;
  };
  const a = parts[3] === undefined ? 1 : number(parts[3], 1);
  let rgb;
  if (fn[1].startsWith("rgb")) {
    rgb = parts.slice(0, 3).map((part) => number(part, 255));
  } else {
    const h = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360;
    const s = number(parts[1], 1);
    const l = number(parts[2], 1);
    const k = (n) => (n + h * 12) % 12;
    const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    rgb = [f(0), f(8), f(4)].map((c) => c * 255);
  }
  if ([...rgb, a].some(Number.isNaN)) return null;
  const [r, g, b] = rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))));
  return { r, g, b, a: Math.min(1, Math.max(0, a)) };
}

const hex6 = ({ r, g, b }) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/** A colour in OKLab. */
function oklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The ΔE between two colours in OKLab, ×100 so a just-noticeable difference is about 2. */
export function deltaE(a, b) {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
}

/** The custom properties of tiili.css's light `:root` block, in source order. */
function rootTokens(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const root = /(?:^|\})\s*:root\s*\{([^{}]*)\}/.exec(text);
  if (!root) throw new Error("brand/tokens: tiili.css has no :root block");
  return [...root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]);
}

/** Semantic tokens first, then the project tints, then the core palette. */
const rank = (name) => (name.startsWith("--tiili-") ? 2 : name.startsWith("--tint-") ? 1 : 0);

/** The colour and size indexes, built from tiili.css's light values. */
export function buildIndex(css) {
  const tokens = rootTokens(css);
  const colours = tokens
    .map(([name, value]) => ({ name, colour: parseColour(value) }))
    .filter((entry) => entry.colour && entry.colour.a === 1)
    .map((entry, order) => ({ ...entry, hex: hex6(entry.colour), order }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.order - b.order);
  const sizes = (pattern) =>
    tokens.filter(([name, value]) => pattern.test(name) && /^\d*\.?\d+px$/.test(value)).map(([name, value]) => ({ name, px: parseFloat(value) }));
  return {
    colours,
    families: {
      radius: sizes(/^--radius-/),
      space: sizes(/^--space-\d+$/),
      text: sizes(/^--text-/),
    },
  };
}

let defaultIndex;
const loadIndex = () => (defaultIndex ??= buildIndex(readFileSync(TOKENS_FILE, "utf8")));

/** The family of size tokens a CSS property takes, if any. */
function familyOf(property) {
  const name = property.toLowerCase();
  if (/^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/.test(name)) return "radius";
  if (/^(padding|margin)(-[a-z-]+)?$/.test(name) || /^(row-|column-)?gap$/.test(name)) return "space";
  if (name === "font-size" || name === "font") return "text";
  return null;
}

const SCAN = new RegExp(
  [
    /(?<skip>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\burl\([^)]*\))/.source,
    /(?<hex>#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-]))/.source,
    /(?<fn>\b(?:rgba?|hsla?)\([^()]*\))/.source,
    /(?<ident>-{0,2}[a-zA-Z_][\w-]*)/.source,
    /(?<num>[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?(?<unit>[a-zA-Z%]+)?)/.source,
  ].join("|"),
  "gi",
);

/** The colour and px-size literals in a CSS value, with their offsets in `text`. */
export function scan(text) {
  const found = [];
  for (const match of text.matchAll(SCAN)) {
    const { hex, fn, ident, num, unit } = match.groups;
    const start = match.index;
    const raw = match[0];
    if (hex || fn) {
      const colour = parseColour(raw);
      if (colour) found.push({ kind: "colour", start, end: start + raw.length, raw, colour });
    } else if (ident) {
      const next = text[start + raw.length];
      if (!ident.startsWith("-") && next !== "(" && NAMED.has(ident.toLowerCase())) {
        found.push({ kind: "colour", start, end: start + raw.length, raw, colour: parseColour(ident) });
      }
    } else if (num && unit && unit.toLowerCase() === "px") {
      found.push({ kind: "size", start, end: start + raw.length, raw, px: parseFloat(raw) });
    }
  }
  return found;
}

/** Whether a JS string is a colour, or a CSS value that holds one: only these strings are checked. */
function isCssValue(text, literals) {
  const value = text.trim();
  if (!value || value.length > 400) return false;
  if (parseColour(value)) return true;
  if (!/^[\w\s#.,()%/+*-]*$/.test(value)) return false;
  const colours = literals.filter((literal) => literal.kind === "colour");
  if (colours.length === 0) return false;
  // A named colour among plain words is likelier prose than CSS: count it only beside a number or a colour function.
  return colours.some((literal) => literal.raw.startsWith("#") || literal.raw.includes("(")) || /\d/.test(value);
}

/** The exact token replacement for a colour, or null. A translucent colour mixes the token with transparent. */
function exactColour(index, colour) {
  const hex = hex6(colour);
  const token = index.colours.find((entry) => entry.hex === hex);
  if (!token) return null;
  if (colour.a === 0) return null;
  return tokenWithAlpha(token.name, colour.a);
}

/** `var(--token)`, mixed with transparent to keep a translucent colour's alpha. */
function tokenWithAlpha(name, alpha) {
  if (alpha === 1) return `var(${name})`;
  return `color-mix(in srgb, var(${name}) ${+(alpha * 100).toFixed(1)}%, transparent)`;
}

function nearestColour(index, colour) {
  let best = null;
  for (const entry of index.colours) {
    const delta = deltaE(colour, entry.colour);
    if (!best || delta < best.delta - 1e-9) best = { name: entry.name, delta };
  }
  return best;
}

function exactSize(index, family, px) {
  const token = index.families[family].find((entry) => entry.px === Math.abs(px));
  if (!token || px === 0) return null;
  return px < 0 ? `calc(-1 * var(${token.name}))` : `var(${token.name})`;
}

const isAllowedLine = (lines, line) => [line, line - 1].some((n) => n >= 1 && /tokens-allow:/.test(lines[n - 1] ?? ""));

const brandTokens = {
  meta: {
    type: "problem",
    fixable: "code",
    hasSuggestions: true,
    docs: { description: "Use the brand tokens from docs/brand/tiili.css instead of colour and size literals" },
    schema: [
      {
        type: "object",
        properties: {
          allowFiles: { type: "array", items: { type: "string" } },
          allowThemeIds: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      exact: "Use {{replacement}} instead of {{literal}}",
      near: "{{literal}} is not a brand token; the nearest is var({{token}}) (ΔE {{delta}})",
      useNearest: "Use {{replacement}} instead of {{literal}}",
    },
  },
  create(context) {
    const { allowFiles = [], allowThemeIds = [] } = context.options[0] ?? {};
    const filename = context.filename.replaceAll("\\", "/");
    if (allowFiles.some((file) => filename === file || filename.endsWith(`/${file}`))) return {};
    const themeIds = allowThemeIds.map((pattern) => new RegExp(pattern));
    const sourceCode = context.sourceCode;
    const index = loadIndex();

    /**
     * Reports the literals at `base` + their offsets; `family` names the size family the value takes, if any. In the
     * `font` shorthand (`isFont`) a size after a `/` is the line height, which no token covers.
     */
    function check(literals, base, family, isFont) {
      for (const literal of literals) {
        if (literal.kind === "size") {
          if (!family) continue;
          if (isFont && sourceCode.text.slice(0, base + literal.start).trimEnd().endsWith("/")) continue;
        }
        const range = [base + literal.start, base + literal.end];
        const loc = { start: sourceCode.getLocFromIndex(range[0]), end: sourceCode.getLocFromIndex(range[1]) };
        if (isAllowedLine(sourceCode.lines, loc.start.line)) continue;
        if (literal.kind === "size") {
          const replacement = exactSize(index, family, literal.px);
          if (replacement) {
            context.report({ loc, messageId: "exact", data: { replacement, literal: literal.raw }, fix: (fixer) => fixer.replaceTextRange(range, replacement) });
          }
          continue;
        }
        const replacement = exactColour(index, literal.colour);
        if (replacement) {
          context.report({ loc, messageId: "exact", data: { replacement, literal: literal.raw }, fix: (fixer) => fixer.replaceTextRange(range, replacement) });
          continue;
        }
        const nearest = nearestColour(index, literal.colour);
        const suggestion = tokenWithAlpha(nearest.name, literal.colour.a);
        context.report({
          loc,
          messageId: "near",
          data: { literal: literal.raw, token: nearest.name, delta: nearest.delta.toFixed(1) },
          suggest: [
            {
              messageId: "useNearest",
              data: { replacement: suggestion, literal: literal.raw },
              fix: (fixer) => fixer.replaceTextRange(range, suggestion),
            },
          ],
        });
      }
    }

    function inAllowedTheme(node) {
      if (themeIds.length === 0) return false;
      return sourceCode.getAncestors(node).some(
        (ancestor) =>
          ancestor.type === "ObjectExpression" &&
          ancestor.properties.some(
            (property) =>
              property.type === "Property" &&
              ((property.key.type === "Identifier" && property.key.name === "id") || property.key.value === "id") &&
              property.value.type === "Literal" &&
              typeof property.value.value === "string" &&
              themeIds.some((pattern) => pattern.test(property.value.value)),
          ),
      );
    }

    /** A JS string's raw text between its delimiters, at `start` in the source. */
    function checkString(node, inner, start) {
      const literals = scan(inner);
      if (!isCssValue(inner, literals) || inAllowedTheme(node)) return;
      check(literals.filter((literal) => literal.kind === "colour"), start, null, false);
    }

    return {
      // CSS
      Declaration(node) {
        if (sourceCode.getAncestors(node).some((a) => a.type === "Atrule" && a.name.toLowerCase() === "font-face")) return;
        const [start, end] = sourceCode.getRange(node.value);
        const family = familyOf(node.property);
        check(scan(sourceCode.text.slice(start, end)), start, family, node.property.toLowerCase() === "font");
      },
      // JS and TS
      Literal(node) {
        if (typeof node.value !== "string") return;
        const [start, end] = node.range;
        checkString(node, sourceCode.text.slice(start + 1, end - 1), start + 1);
      },
      TemplateElement(node) {
        const [start, end] = node.range;
        const raw = sourceCode.text.slice(start, end);
        const tail = raw.endsWith("${") ? 2 : 1;
        checkString(node, raw.slice(1, raw.length - tail), start + 1);
      },
    };
  },
};

/** Blanks everything outside an HTML page's `<style>` blocks, keeping newlines so lines and offsets stay put. */
export function styleBlocks(html) {
  let css = "";
  let last = 0;
  const blank = (text) => text.replace(/[^\n]/g, " ");
  for (const match of html.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style>/gi)) {
    const bodyStart = match.index + match[1].length;
    css += blank(html.slice(last, bodyStart)) + match[2];
    last = bodyStart + match[2].length;
  }
  if (last === 0) return null;
  return css + blank(html.slice(last));
}

const htmlStyle = {
  meta: { name: "brand/html-style" },
  preprocess(text) {
    const css = styleBlocks(text);
    return css === null ? [] : [{ text: css, filename: "style.css" }];
  },
  postprocess: (messages) => messages.flat(),
  supportsAutofix: true,
};

export default {
  meta: { name: "brand" },
  rules: { tokens: brandTokens },
  processors: { "html-style": htmlStyle },
};
