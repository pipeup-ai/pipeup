import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    // Safari's engine, for what has gone wrong only there (tests tagged @safari): a clicked button isn't focused,
    // taking focus away drops the selection, and a pointer's moves say no distance. WEBKIT=all runs every test in it
    // (npm run e2e:safari); the ones that fail there for the test browser's own reasons are listed in
    // docs/testing/extension-checklist.md.
    {
      name: "webkit",
      grep: process.env.WEBKIT === "all" ? /./ : /@safari/,
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
