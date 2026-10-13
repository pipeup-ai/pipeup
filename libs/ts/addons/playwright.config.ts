import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // The tests run real WebRTC, timers and servers: fewer at once keeps their timing honest.
  workers: 3,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
});
