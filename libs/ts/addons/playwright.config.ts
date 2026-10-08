import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
});
