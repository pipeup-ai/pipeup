import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // jsdom has no canvas; the code that would use one falls back, so its notice is only noise.
    onConsoleLog: (log) => (log.includes("Not implemented: HTMLCanvasElement") ? false : undefined),
  },
});
