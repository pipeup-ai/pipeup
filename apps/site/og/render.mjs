// Renders og/og.html to og.png (1200×630), the site's link-preview image, with the Playwright the
// library already has as a dev dependency. The PNG is committed; build.sh only copies it.
//
//   node apps/site/og/render.mjs        (from the repository root; needs `npm install` in libs/ts/pipeup)
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.resolve(here, "../../../libs/ts/pipeup/package.json");
const { chromium } = createRequire(lib)("playwright");

const out = path.resolve(here, "../og.png");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" });
  await page.goto(pathToFileURL(path.join(here, "og.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: "png" });
} finally {
  await browser.close();
}
console.log(`Wrote ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
