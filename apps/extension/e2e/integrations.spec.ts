import { expect, PAGES, panel, sidePanel, tabOf, test } from "./fixtures";
import type { Page, Worker } from "@playwright/test";
import { readFileSync } from "node:fs";

/** Asks Pipeup in `page`'s tab, as the side panel and the right-click menu do. */
const askPage = (worker: Worker, tab: number, message: Record<string, unknown>) =>
  worker.evaluate(([t, m]) => chrome.tabs.sendMessage(t as number, { to: "page", ...(m as object) }), [
    tab,
    message,
  ] as const);

async function started(
  context: import("@playwright/test").BrowserContext,
  worker: Worker,
  id: string,
  page: Page,
) {
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  return p;
}

test("Comment with Pipeup on selected words or a picture opens the box on them", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  await page.evaluate(() => {
    const t = document.querySelector("#p1")!.firstChild!;
    const r = document.createRange();
    r.setStart(t, 3);
    r.setEnd(t, 9);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  });
  await askPage(worker, tab, { type: "commentOn", selection: true });
  await expect(page.locator(".pop.show .draft")).toContainText("launch");
  await page.keyboard.press("Escape");
  const src = await page.locator("#logo").evaluate((i) => (i as HTMLImageElement).src);
  await askPage(worker, tab, { type: "commentOn", src });
  await expect(page.locator(".pop.show .draft textarea")).toBeVisible();
});

test("unpinned, Comments opens Pipeup's own panel on the page", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await p.getByRole("button", { name: /^Comments/ }).click();
  await expect(page.locator(".all.show")).toHaveCount(1);
});

test("on a single-page app, Pipeup follows the page: each address has its own comments", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}app.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const doc = async () =>
    ((await askPage(worker, tab, { type: "agentSend" })) as { result: { doc: string } }).result.doc;
  const before = await doc();
  // Comment mode is on (it takes clicks on the page), so the app changes page as its own code would.
  await page.evaluate(() => history.pushState({}, "", "/settings"));
  await expect.poll(doc).not.toBe(before);
});

test("on a page from this computer, the menu offers Always on for local pages", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await expect(p.getByRole("switch", { name: /Always on for local pages/ })).toBeVisible();
  await expect(p.locator("#always-row")).toBeHidden();
});

test("a picture of where a new comment was is kept, and shown when the comment's place is gone", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  await page.bringToFront();
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  await page.keyboard.type("Is June firm?");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () =>
      worker.evaluate(
        async () =>
          Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith("shot:")).length,
      ),
    )
    .toBe(1);
  // The paragraph goes: the comment is lost, and the side panel shows how it looked.
  await page.evaluate(() => document.querySelector("#p2")!.remove());
  const side = await sidePanel(context, worker, id, page);
  const card = side.locator(".card", { hasText: "Is June firm?" });
  await expect(card).toContainText("No longer on the page");
  await expect(card.locator("img")).toBeVisible();
  // Deleting the comment deletes its picture.
  await card.click();
  await side.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(side.locator(".card", { hasText: "Is June firm?" })).toHaveCount(0);
  await expect
    .poll(async () =>
      worker.evaluate(
        async () =>
          Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith("shot:")).length,
      ),
    )
    .toBe(0);
});

test("Save comments gives a Markdown file and a Pipeup file", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await p.getByRole("button", { name: /Save comments/ }).click();
  const [md] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: /As a Markdown file/ }).click(),
  ]);
  expect(md.suggestedFilename()).toBe("Lumen launch plan.md");
  expect(await md.path().then((f) => readFileSync(f, "utf8"))).toContain("# Comments on Lumen launch plan");
  await md.delete();
  await p.getByRole("button", { name: /Save comments/ }).click();
  const [file] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: /As a Pipeup file/ }).click(),
  ]);
  expect(file.suggestedFilename()).toBe("Lumen launch plan.pipeup.json");
  await file.delete();
});

test("Send to my agent says how to set it up when this computer isn't set up yet", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await p.getByRole("button", { name: /Send to my agent/ }).click();
  // From the release this extension is, for this browser (Chromium: Chrome's host file).
  const version = await worker.evaluate(() => chrome.runtime.getManifest().version);
  await expect(p.locator("#agent-cmd")).toHaveText(
    `npx --yes pipeup@${version} browser install --extension-id ${id}`,
  );
});

test("add-ons: Emoji is on by default, and the others are turned on in the extension's settings", async ({
  context,
  worker,
  id,
}) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await expect(settings.getByRole("switch", { name: /^Emoji/ })).toBeChecked();
  await settings.getByRole("switch", { name: /^Save to GitHub/ }).check();
  await settings.getByRole("textbox", { name: /Repository for issues/ }).fill("lumen/plans");
  await settings.getByRole("textbox", { name: /Repository for issues/ }).blur();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get("settings")).settings))
    .toMatchObject({ addons: { github: true }, githubRepo: "lumen/plans" });
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const states = await worker.evaluate(
    async (t) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId: t },
          func: () =>
            (
              globalThis as unknown as { Pipeup: { addons(): { id: string; state: string }[] } }
            ).Pipeup.addons().map((a) => `${a.id}:${a.state}`),
        })
      )[0]!.result,
    tab,
  );
  expect(states).toEqual(expect.arrayContaining(["emoji:on", "github:on"]));
});

test("a page can't say where comments go: Share stays off without the reviewer's own sharing address", async ({
  context,
  worker,
  id,
}) => {
  await worker.evaluate(() => chrome.storage.local.set({ settings: { addons: { share: true } } }));
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-pipeup-share", "https://mailbox.example/lumen"),
  );
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const share = await worker.evaluate(
    async (t) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId: t },
          func: () =>
            (
              globalThis as unknown as { Pipeup: { addons(): { id: string; state: string }[] } }
            ).Pipeup.addons().find((a) => a.id === "share")?.state,
        })
      )[0]!.result,
    tab,
  );
  expect(share).toBe("off");
});
