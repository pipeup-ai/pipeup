import { defineConfig } from "@playwright/test";

// The extension loads in a browser of its own: Chromium (e2e/fixtures.ts) and Firefox (e2e/firefox-fixtures.ts). Safari
// can't be driven with an extension, so it's tried by hand. Pages come from a local server, since extensions can't
// reach file:// pages unless the reviewer allows it.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  projects: [
    { name: "chromium", testIgnore: /firefox\.spec/ },
    { name: "firefox", testMatch: /firefox\.spec/ },
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    port: 4931,
    reuseExistingServer: !process.env.CI,
  },
});
