import { expect, PAGES, panel, tabOf, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Comment mode, a click on the paragraph, the words, and Comment: as a reviewer writes one. */
async function writeComment(page: Page, text: string): Promise<void> {
  await page.bringToFront();
  // Pipeup has started in the tab: its control is in the corner.
  await expect(page.locator(".launch .mode")).toBeVisible();
  await page.keyboard.press("Shift+Alt+KeyC");
  // Comment mode's layer takes the click, as on any page: press where the paragraph is.
  const at = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  const box = page.locator(".draft textarea");
  await box.fill(text);
  await page.locator(".draft").getByRole("button", { name: "Comment" }).click();
  await expect(page.locator(".th", { hasText: text }).first()).toBeAttached();
}

test("Comment on this page adds Pipeup to the tab, and Turn off takes it away", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#where")).toHaveText("localhost:4931/plain.html");
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await expect(page.locator(".launch .mode")).toBeVisible();
  await expect(p.getByRole("button", { name: "Turn off on this page" })).toBeVisible();
  await expect(p.locator("#count")).toHaveText("No open comments on this page.");
  await p.getByRole("button", { name: "Turn off on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeVisible();
});

test("comments are kept by the extension, not the site, and come back after a reload", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Which beta, Ada's or the public one?");

  // The site's own storage has nothing of Pipeup's: no database, no saved choices.
  const site = await page.evaluate(async () => ({
    databases: (await indexedDB.databases()).map((d) => d.name),
    keys: Object.keys(localStorage),
  }));
  expect(site.databases.filter((n) => n?.includes("pipeup"))).toEqual([]);
  expect(site.keys.filter((k) => k.includes("pipeup"))).toEqual([]);
  // The extension has the comment and one identity for every site.
  const kept = await worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return {
      docs: Object.keys(all).filter((k) => k.startsWith("doc:")),
      profile: !!all.profile,
    };
  });
  expect(kept.docs).toHaveLength(1);
  expect(kept.profile).toBe(true);

  // The toolbar button counts the page's open comments.
  const tab = await tabOf(worker, page);
  await expect.poll(() => worker.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), tab)).toBe("1");

  await page.reload();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator(".th", { hasText: "Which beta" }).first()).toBeAttached();
  await expect(p.locator("#count")).toHaveText("1 open comment on this page.");
});

test("Comments you've made lists the pages commented on", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Say which week in May.");
  const list = await context.newPage();
  await list.goto(`chrome-extension://${id}/comments.html`);
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list.locator("li a")).toHaveText("Lumen launch plan");
  await expect(list.locator("li span")).toContainText("1 comment");
});

test("a page with Pipeup built in keeps its own; the extension steps aside and says so", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}built-in.html`);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#built-in")).toBeVisible();
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeHidden();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
});

test("on a browser page it says Pipeup can't run there", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto("chrome://version");
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#blocked")).toBeVisible();
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeHidden();
});
