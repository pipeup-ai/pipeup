import { getInstalledBrowsers, Browser as Kind } from "@puppeteer/browsers";
import { test as base } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// The Firefox test build: the published one, plus access to the test pages' server (npm run check builds it).
const extension = fileURLToPath(new URL("../dist/firefox-test", import.meta.url));
/** The extension's address in these tests: Firefox makes one up per profile unless it's told which. */
const UUID = "5b0e4c1a-2d3f-4e5a-8b6c-7d8e9f0a1b2c";
export const BASE = `moz-extension://${UUID}/`;
export const PAGES = "http://localhost:4931/";

/** Firefox as released, kept for the tests by `npm run firefox` (Playwright's own Firefox can't open tabs over BiDi). */
const CACHE = fileURLToPath(new URL("../node_modules/.cache/firefox", import.meta.url));
async function firefoxPath(): Promise<string> {
  const found = (await getInstalledBrowsers({ cacheDir: CACHE })).find((b) => b.browser === Kind.FIREFOX);
  if (!found) throw new Error("Firefox for the tests isn't installed: run npm run firefox in apps/extension");
  return found.executablePath;
}

/**
 * Firefox, driven over WebDriver BiDi with Puppeteer (Playwright can't add extensions to Firefox; BiDi can). The
 * extension's pages are privileged, so BiDi reaches them only with system access allowed.
 */
export const test = base.extend<{ fresh: void }, { browser: Browser }>({
  // One Firefox for the run (macOS hands a second one started in a hurry to the first, which isn't then a fresh browser).
  browser: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const profile = mkdtempSync(join(tmpdir(), "pipeup-firefox-"));
      const browser = await puppeteer.launch({
        browser: "firefox",
        executablePath: await firefoxPath(),
        headless: true,
        userDataDir: profile,
        env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
        extraPrefsFirefox: {
          "extensions.webextensions.uuids": JSON.stringify({ "extension@pipeup.ai": UUID }),
        },
      });
      await browser.installExtension(extension);
      await use(browser);
      await browser.close();
      rmSync(profile, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],
  // Each test starts with the extension's storage empty and no tabs but one.
  fresh: [
    async ({ browser }, use) => {
      const keep = await open(browser, `${BASE}comments.html`);
      await keep.evaluate(() => chrome.storage.local.clear());
      for (const p of await browser.pages()) if (p !== keep) await p.close();
      await use();
    },
    { auto: true },
  ],
});
export { expect } from "@playwright/test";

/** Waits until `check` holds, as Playwright's expect.poll does, for Puppeteer's pages. */
export async function until(check: () => Promise<boolean>, what: string, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    if (await check().catch(() => false)) return;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Opens `url` in a new tab; BiDi doesn't report loads of the extension's own pages, so it waits for the page itself. */
export async function open(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(url, { timeout: 1500 }).catch(() => {});
  await until(
    () => page.evaluate((u) => location.href === u && document.readyState === "complete", url),
    `${url} to load`,
  );
  return page;
}

/** The tab's id, as the extension knows it, asked from one of the extension's own pages. */
async function tabOf(browser: Browser, page: Page): Promise<number> {
  const url = await page.evaluate(() => location.href);
  const helper = await open(browser, `${BASE}comments.html`);
  const id = await helper.evaluate(
    async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)!.id!,
    url,
  );
  await helper.close();
  await page.bringToFront();
  return id;
}

/** The toolbar panel for `page`, opened in a tab of its own. */
export async function panel(browser: Browser, page: Page): Promise<Page> {
  return open(browser, `${BASE}popup.html?tab=${await tabOf(browser, page)}`);
}

/** The sidebar for `page`, opened in a tab of its own. */
export async function sidePanel(browser: Browser, page: Page): Promise<Page> {
  return open(browser, `${BASE}panel.html?tab=${await tabOf(browser, page)}`);
}
