// Plain Node ESM with no dependencies of its own: linted with the tooling installed for the add-ons workspace
// (`cd libs/ts/addons && npm ci`), the repo's usual rules plus Node's globals.
import tseslint from "../../libs/ts/addons/node_modules/typescript-eslint/dist/index.js";

const node = Object.fromEntries(
  [
    "console",
    "process",
    "URL",
    "fetch",
    "Response",
    "Buffer",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "AbortController",
    "TextEncoder",
    "TextDecoder",
  ].map((n) => [n, "readonly"]),
);

export default tseslint.config(...tseslint.configs.recommended, {
  languageOptions: { globals: node },
  rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
});
