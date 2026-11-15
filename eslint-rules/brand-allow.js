/** What `brand/tokens` lets through: palettes tiili didn't make, and grounds that must match another app. */
export const BRAND_ALLOW = {
  // The third-party themes keep their published palettes; the tiili-made themes are checked against tiili.css by
  // src/brandTokens.test.ts, and hold hex because they are applied inline and measured for contrast.
  allowThemeIds: ["^solarized-", "^gruvbox-", "^nord$", "^dracula$", "^tiili-(light|dark)$", "^(savi|muratti|koski|laasti)$"],
  // Heynote's own grounds, which the pane matches so it doesn't flash.
  allowFiles: ["src/heynotePane.ts", "scripts/heynote.mjs"],
};
