// Source patches scripts/heynote.mjs applies to Heynote before it builds it for tiili's Heynote pane.

/** Heynote's math-block result widget, relative to the root of a Heynote checkout. */
export const MATH_RESULT_FILE = "src/editor/block/math.js";

/**
 * Makes Heynote's math-block result widget (`MATH_RESULT_FILE`) show its result as text. Upstream sets the result,
 * which can be any string a math line evaluates to or a custom `format()` returns, with `innerHTML`, so a note could
 * run markup and script in the Heynote frame, which reaches tiili's Tauri `invoke`. Both the result and the "Copied!"
 * label are set with `textContent` instead. Throws when the source no longer has the result's `innerHTML`
 * assignment, or when any `innerHTML` assignment is left after patching, so a changed Heynote fails the build.
 */
export function patchMathResult(source) {
  const result = /\.innerHTML(\s*=\s*this\.displayResult\b)/g;
  if (!source.match(result)) {
    throw new Error(`Heynote's ${MATH_RESULT_FILE} no longer sets innerHTML = this.displayResult: update scripts/heynote-patches.mjs`);
  }
  const patched = source
    .replace(result, ".textContent$1")
    .replace(/\.innerHTML(\s*=\s*(["'`])Copied!\2)/g, ".textContent$1");
  if (/\binnerHTML\s*\+?=(?!=)/.test(patched)) {
    throw new Error(`Heynote's ${MATH_RESULT_FILE} still sets innerHTML after patching: update scripts/heynote-patches.mjs`);
  }
  return patched;
}
