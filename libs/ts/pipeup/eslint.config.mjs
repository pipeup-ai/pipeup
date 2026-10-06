import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
  // Browser tests reach into `window`.
  { files: ["e2e/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
);
