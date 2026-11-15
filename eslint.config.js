import css from "@eslint/css";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import brand from "./eslint-rules/brand-tokens.js";

/** What `brand/tokens` lets through: palettes tiili didn't make, and grounds that must match another app. */
const BRAND_ALLOW = {
  // The third-party themes keep their published palettes; the tiili-made themes are checked against tiili.css by
  // src/brandTokens.test.ts, and hold hex because they are applied inline and measured for contrast.
  allowThemeIds: ["^solarized-", "^gruvbox-", "^nord$", "^dracula$", "^tiili-(light|dark)$", "^(savi|muratti|koski|laasti)$"],
  // Heynote's own grounds, which the pane matches so it doesn't flash.
  allowFiles: ["src/heynotePane.ts", "scripts/heynote.mjs"],
};

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "node_modules/", "docs/", "site/brand/", "heynote/", "public/heynote/"] },
  {
    files: ["**/*.{ts,js,mjs,cjs}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["scripts/**/*.{mjs,ts}", "eslint-rules/**/*.{js,ts}", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    plugins: { brand },
    rules: { "brand/tokens": ["error", BRAND_ALLOW] },
  },
  {
    files: ["src/**/*.css", "site/**/*.css", "site/*.html/*.css"],
    language: "css/css",
    plugins: { css, brand },
    rules: { "brand/tokens": ["error", BRAND_ALLOW] },
  },
  {
    files: ["site/*.html"],
    plugins: { brand },
    processor: "brand/html-style",
  },
);
