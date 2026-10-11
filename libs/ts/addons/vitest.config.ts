import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "*/test/**/*.test.ts",
      "examples/send-to-git/test/*.test.mjs",
      "examples/save-to-github/test/*.test.ts",
    ],
    environment: "node",
    testTimeout: 20000,
  },
});
