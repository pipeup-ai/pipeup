import { defineConfig } from "vitest/config";

export default defineConfig({
  // The agents add-on's shell link checksums, as the build puts them in (scripts/build-addon.mjs).
  define: {
    __PIPEUP_SHELL__: JSON.stringify({
      version: "0.0.0-test",
      sha256: { "pipeup-link.sh": "a".repeat(64), "pipeup-link.ps1": "b".repeat(64) },
    }),
  },
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
