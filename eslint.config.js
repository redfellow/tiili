import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "node_modules/", "docs/", "heynote/", "public/heynote/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["scripts/**/*.{mjs,ts}"],
    languageOptions: { globals: { ...globals.node } },
  },
);
