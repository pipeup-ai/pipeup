import { expect, PAGES, panel, sidePanel, tabOf, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Comment mode, a click on the paragraph, then the words and Comment in the side panel: as a reviewer writes one with
 * the extension. `side` is the side panel, open beside the page.
 */
async function writeComment(page: Page, side: Page, text: string): Promise<void> {
  await page.bringToFront();
  // Pipeup has started in the tab; Comment on this page turned comment mode on, and the shortcut does if it's off.
  await expect(page.locator(".launch")).toBeAttached();
  if ((await page.locator(".launch .mode.on").count()) === 0) await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  // Comment mode's layer takes the click, as on any page: press where the paragraph is.
  const at = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  // No comment box on the page: it opens in the side panel, saying what it's on.
  await expect(page.locator(".draft")).toHaveCount(0);
  await expect(side.locator("#draft-on")).toContainText("We launch in the second week of May");
  await side.locator("#draft-words").fill(text);
  await side.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(side.locator(".card", { hasText: text })).toBeVisible();
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
  const side = await sidePanel(context, worker, id, page);
  await writeComment(page, side, "Which beta, Ada's or the public one?");

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
  await expect(p.locator("#count")).toHaveText("1");
  await side.reload();
  await expect(side.locator(".card", { hasText: "Which beta" })).toBeVisible();
});

test("Comments you've made lists the pages commented on", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, await sidePanel(context, worker, id, page), "Say which week in May.");
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

test("the toolbar panel is Pipeup's menu: name, copy, theme, Hide comments and comment mode", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  await expect(p.locator("#status")).toHaveText("Comments stay in this browser until you send them");

  // Who you are: the row becomes a name field in place.
  await p.getByRole("button", { name: /Add your name/ }).click();
  await p.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await p.keyboard.press("Enter");
  await expect(p.getByRole("button", { name: /Sam/ })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  // Theme: each press moves on, and the page's Pipeup follows.
  await p.getByRole("button", { name: /Theme/ }).click();
  await expect(p.locator("#theme-now")).toHaveText("Light");
  await p.getByRole("button", { name: /Theme/ }).click();
  await expect(p.locator("#theme-now")).toHaveText("Dark");
  await expect(page.locator(".layer")).toHaveClass(/dark/);

  // Hide comments.
  await p.getByRole("switch", { name: "Hide comments" }).check();
  await expect
    .poll(() => p.evaluate(() => (document.getElementById("hide") as HTMLInputElement).checked))
    .toBe(true);

  // Copy comments, as Markdown for an AI (what goes to the clipboard is caught here).
  await p.evaluate(() => {
    const w = window as unknown as { copied: string };
    navigator.clipboard.writeText = async (t: string) => void (w.copied = t);
  });
  await p.getByRole("button", { name: /Copy comments/ }).click();
  await p.getByRole("button", { name: /As Markdown/ }).click();
  await expect(p.locator("#copied")).toHaveText("Copied 0 threads");
  expect(await p.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
    "# Comments on Lumen launch plan",
  );

  // Start commenting turns comment mode off and on.
  await p.getByRole("switch", { name: /Start commenting/ }).click();
  await expect(page.locator(".launch .mode.on")).toHaveCount(0);
});

test("the side panel shows a thread when its highlight is clicked, and replies and resolves there", async ({
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
  const side = await sidePanel(context, worker, id, page);
  await writeComment(page, side, "Which beta?");
  // The new thread is open; closed, its marker on the page opens it again in the side panel.
  await side.getByRole("button", { name: /On “We launch/ }).click();
  await expect(side.locator(".card.open")).toHaveCount(0);
  await page.bringToFront();
  await page.keyboard.press("Escape");
  await page.locator(".bub").first().click();
  const card = side.locator(".card.open");
  await expect(card).toContainText("Which beta?");
  await card.getByRole("textbox", { name: "Reply" }).fill("Ours. I'll say so.");
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(side.locator(".card", { hasText: "Which beta?" })).toContainText("Ours. I'll say so.");
  await expect(side.locator(".card.open").getByRole("textbox", { name: "Reply" })).toHaveValue("");
  await side.locator(".card.open").getByRole("button", { name: "✓ Resolve" }).click();
  await expect(side.locator(".card", { hasText: "Which beta?" })).toHaveCount(0);
  await side.getByRole("button", { name: "✓ Resolved" }).click();
  await expect(side.locator(".card.resolved", { hasText: "Which beta?" })).toBeVisible();
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
