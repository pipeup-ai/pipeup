import { expect, test, type Page } from "@playwright/test";
import { focusInPipeup, open, seedText, selectWords, showComments, stubClipboard } from "./helpers";

test("the comment icon goes as soon as the selection does", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await selectWords(page, "#p1", "pricing changes");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  // The page clears the selection itself: no mouse or key event follows.
  await page.evaluate(() => getSelection()!.removeAllRanges());
  await expect(page.locator(".selbar.show")).toHaveCount(0);
});

test("the menu works from the keyboard and keeps focus while toggling", async ({ page }) => {
  await stubClipboard(page);
  await open(page, "doc.html");
  await page.locator(".launch .mode").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  // Focus starts on Start commenting, the item nearest the button, at the bottom of the menu.
  await expect.poll(async () => (await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toContain("All comments");
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toContain("Copy as Text");
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toMatch(/^Copy as Markdown/);
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toContain("Add name");
  await page.keyboard.press("Home");
  expect((await focusInPipeup(page)).text).toContain("Add name");
  await page.keyboard.press("End");
  expect((await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("ArrowDown");
  expect((await focusInPipeup(page)).text).toContain("Add name");
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mode");
});

test("an item that closes the menu gives focus back to the control", async ({ page }) => {
  await stubClipboard(page);
  await open(page, "doc.html");
  await page.locator(".launch .mode").focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toMatch(/^Copy as Markdown/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mode");
});

test("toggling the menu with the control keeps focus on the control", async ({ page }) => {
  await open(page, "doc.html");
  const count = page.locator(".launch .mode");
  await count.click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await count.click();
  await expect(page.locator(".menu.show")).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mode");
});

test("after editing the name, focus returns to the identity row", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await page.locator(".launch .mode").focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("Home");
  expect((await focusInPipeup(page)).text).toContain("Sam");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).tag).toBe("INPUT");
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  expect((await focusInPipeup(page)).text).toContain("Sam");
});

const T0 = Date.UTC(2026, 0, 1);

test("choosing Your name from the keyboard puts focus in the name field at once", async ({ page }) => {
  // Timers only run when the test says so: the field must have focus without waiting for one.
  await page.clock.install({ time: T0 });
  await open(page, "doc.html", { name: "Sam" });
  await page.clock.pauseAt(T0 + 60_000);
  await page.locator(".launch .mode").focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("Home");
  expect((await focusInPipeup(page)).text).toContain("Sam");
  await page.keyboard.press("Enter");
  await page.keyboard.type(" Lee");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "INPUT", value: "Sam Lee" });
});

/**
 * Tabs through the page and Pipeup `presses` times, noting every stop inside UI that is hidden right then
 * (`hidden` is a selector for it). Wherever it lands in a hidden text field, it types a reply and presses Enter.
 */
async function tabThrough(page: Page, hidden: string, presses = 40): Promise<string[]> {
  const hits: string[] = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate((hidden) => {
      const a = document.querySelector("pipeup-root")!.shadowRoot!.activeElement as HTMLElement | null;
      return a?.closest(hidden) ? `${a.tagName.toLowerCase()} in ${a.closest(hidden)!.className}` : null;
    }, hidden);
    if (!hit) continue;
    hits.push(hit);
    if (!hit.startsWith("textarea")) continue;
    await page.keyboard.type("sneaky");
    await page.keyboard.press("Enter");
  }
  return hits;
}
const replies = (page: Page) =>
  page.evaluate(() =>
    ((window as any).pu.document.threads() as { root: { replies: unknown[] } }[]).reduce(
      (n, t) => n + t.root.replies.length,
      0,
    ),
  );

test("hidden UI takes no focus: Tab never reaches a closed popover, menu or preview, and typing posts nothing", async ({
  page,
}) => {
  await open(page, "site.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line, see https://example.test/a");
  // The menu, opened and closed.
  const count = page.locator(".launch .mode");
  await count.click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await count.click();
  await expect(page.locator(".menu.show")).toHaveCount(0);
  // All comments, opened and closed.
  await count.click();
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(page.locator(".all.show")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".all.show")).toHaveCount(0);
  // The preview, shown and gone.
  const q = await page.evaluate(() => {
    const r = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(q.x, q.y, { steps: 4 });
  await expect(page.locator(".tip.show a")).toHaveCount(1);
  await page.mouse.move(640, 700, { steps: 4 });
  await expect(page.locator(".tip.show")).toHaveCount(0);
  // The popover, opened and closed.
  await page.mouse.click(q.x, q.y);
  await expect(page.locator(".pop.show textarea")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.mouse.click(5, 790);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  const hits = await tabThrough(page, ".pop:not(.show), .menu:not(.show), .all:not(.show), .tip:not(.show)");
  await page.keyboard.type("sneaky");
  await page.keyboard.press("Enter");
  expect.soft(hits).toEqual([]);
  expect.soft(await replies(page)).toBe(0);
});

test("in the column, a closed thread's reply line takes no focus, and typing posts nothing", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Then what?");
  await expect(page.locator(".th")).toHaveCount(2);
  // One opened and closed again, one never opened.
  await page.locator(".th .tx", { hasText: "Then what?" }).click();
  await expect(page.locator(".th.on")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".th.on")).toHaveCount(0);
  await page.mouse.click(5, 790);
  const hits = await tabThrough(page, ".th:not(.on) .more");
  await page.keyboard.type("sneaky");
  await page.keyboard.press("Enter");
  expect.soft(hits).toEqual([]);
  expect.soft(await replies(page)).toBe(0);
});
