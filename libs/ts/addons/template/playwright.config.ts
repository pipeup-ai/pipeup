import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4173" },
  webServer: { command: "node serve.mjs", url: "http://localhost:4173/page/", reuseExistingServer: true },
});
