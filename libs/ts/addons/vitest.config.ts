import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["*/test/**/*.test.ts", "examples/send-to-git/test/*.test.mjs"],
    environment: "node",
    testTimeout: 20000,
  },
});
