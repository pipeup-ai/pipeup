import { chromium, test as base, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The test build: the published one, plus access to the test pages' server (npm run check builds it).
const extension = fileURLToPath(new URL("../dist/chromium-test", import.meta.url));

/** A Chromium of its own with the unpacked extension loaded, its service worker, and its id. */
export const test = base.extend<{
  context: BrowserContext;
  worker: Worker;
  id: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    const [worker] = context.serviceWorkers();
    await use(worker ?? (await context.waitForEvent("serviceworker")));
  },
  id: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});
export const expect = test.expect;

export const PAGES = "http://localhost:4931/";

/** The tab's id, as the extension knows it: the active tab, once `page` is in front (the extension can't read tabs' addresses). */
export async function tabOf(worker: Worker, page: Page): Promise<number> {
  await page.bringToFront();
  const url = page.url();
  return worker.evaluate(
    async (u) =>
      (await chrome.tabs.query({})).find((t) => t.url === u || (u.startsWith("chrome:") && t.active))!.id!,
    url,
  );
}

/** The toolbar panel for `page`, opened in a tab of its own (the tests can't press the toolbar button). */
export async function panel(context: BrowserContext, worker: Worker, id: string, page: Page): Promise<Page> {
  const tab = await tabOf(worker, page);
  const p = await context.newPage();
  await p.goto(`chrome-extension://${id}/popup.html?tab=${tab}`);
  return p;
}
