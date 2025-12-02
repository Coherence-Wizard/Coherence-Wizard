// CommonJS ESLint flat config to avoid ESM warning without setting package type.
const tsparser = require("@typescript-eslint/parser");
const { defineConfig } = require("eslint/config");
const obsidianmd = require("eslint-plugin-obsidianmd").default || require("eslint-plugin-obsidianmd");
const globals = require("globals");

module.exports = defineConfig([
  {
    ignores: [
      "node_modules/**",
      "Releases/**",
      "main.js",
      "eslint.config.*"
    ]
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      // Obsidian plugins run in an Electron environment with both
      // browser and Node globals available. Declare them so ESLint
      // recognizes identifiers like `console`, `window`, and `process`.
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "obsidianmd/sample-names": "off"
      // Removed invalid rule obsidianmd/prefer-file-manager-trash (not present in plugin v0.1.9)
    },
  },
  {
    // Disable TS-only rule on plain JS files
    files: ["**/*.js","**/*.cjs","**/*.mjs"],
    rules: {
      "@typescript-eslint/no-deprecated": "off"
    }
  },
  {
    // Ignore legacy config file from linting to avoid type info requirement
    ignores: [".eslintrc.js"]
  }
]);
