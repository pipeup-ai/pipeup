import { defineConfig } from "@playwright/test";

// The extension loads only in Chromium, in a browser of its own (see e2e/fixtures.ts). Pages come from a local server,
// since extensions can't reach file:// pages unless the reviewer allows it.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  webServer: {
    command: "node e2e/serve.mjs",
    port: 4931,
    reuseExistingServer: !process.env.CI,
  },
});
