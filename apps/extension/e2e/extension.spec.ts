import { expect, PAGES, panel, tabOf, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Comment mode, a click on the paragraph, the words, and Comment: as a reviewer writes one. */
async function writeComment(page: Page, text: string): Promise<void> {
  await page.bringToFront();
  // Pipeup has started in the tab; Comment on this page turned comment mode on, and the shortcut does if it's off.
  await expect(page.locator(".launch")).toBeAttached();
  if ((await page.locator(".launch .mode.on").count()) === 0) await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  // Comment mode's layer takes the click, as on any page: press where the paragraph is.
  const at = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  const box = page.locator(".draft textarea");
  await box.fill(text);
  await page.locator(".draft").getByRole("button", { name: "Comment" }).click();
  await expect(page.locator(".th", { hasText: text }).first()).toBeAttached();
}

test("Comment on this page adds Pipeup and starts comment mode, with no button on the page; Turn off takes it away", async ({
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
  // The toolbar is the way in: Pipeup's corner button steps aside, and comment mode is on.
  await expect(page.locator(".launch.off")).toBeAttached();
  await expect(page.locator(".launch .mode")).toBeHidden();
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  await expect(p.getByRole("button", { name: "Turn off on this page" })).toBeVisible();
  await expect(p.getByRole("switch", { name: /Start commenting/ })).toBeChecked();
  await expect(p.locator("#count")).toHaveText("0");
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
  await expect(p.locator("#count")).toHaveText("1");
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

test("the panel's rows stop and start comment mode, open All comments and open Pipeup's menu", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  await p.getByRole("switch", { name: /Start commenting/ }).click();
  await expect(page.locator(".launch .mode.on")).toHaveCount(0);
  await expect(p.getByRole("switch", { name: /Start commenting/ })).not.toBeChecked();
  await p.getByRole("button", { name: /All comments/ }).click();
  await expect(page.locator(".all.show")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await p.getByRole("button", { name: /Pipeup's menu/ }).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
});

test("the toolbar button shows comment mode: green, saying on when there are no comments", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const tab = await tabOf(worker, page);
  const badge = () =>
    worker.evaluate(
      async (t) => ({
        text: await chrome.action.getBadgeText({ tabId: t }),
        colour: (await chrome.action.getBadgeBackgroundColor({ tabId: t })).slice(0, 3).join(","),
      }),
      tab,
    );
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await expect.poll(badge).toEqual({ text: "on", colour: "47,125,74" });
  await page.bringToFront();
  await page.keyboard.press("Escape");
  await expect.poll(badge).toEqual({ text: "", colour: "83,74,183" });
});

test("Show Pipeup's button on pages brings the corner button back", async ({ context, worker, id }) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await settings.getByRole("switch", { name: /Show Pipeup's button on pages/ }).check();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get("settings")).settings))
    .toEqual({
      showButton: true,
    });
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await expect(page.locator(".launch .mode")).toBeVisible();
});
