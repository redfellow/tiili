import css from "@eslint/css";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { BRAND_ALLOW } from "./eslint-rules/brand-allow.js";
import brand from "./eslint-rules/brand-tokens.js";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "node_modules/", "docs/", "site/brand/", "heynote/", "public/heynote/"] },
  {
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["scripts/**/*.{mjs,ts}", "eslint-rules/**/*.{js,ts}", "integrations/**/*.{mjs,ts}", "eslint.config.js"],
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
