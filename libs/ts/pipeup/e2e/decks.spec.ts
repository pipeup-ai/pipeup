import { expect, test, type Page } from "@playwright/test";
import {
  control,
  open,
  openAll,
  openMenu,
  copyAs,
  leaveReply,
  savedViews,
  seedView,
  selectWords,
  settled,
  stubClipboard,
  toggleCommenting,
} from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Rect> =>
  (await page.locator(selector).first().boundingBox())!;
const meets = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const draft = (page: Page) => page.locator(".pop.show .draft");

test("a reveal.js deck's own arrows, progress bar and slide number keep working in comment mode", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  await page.evaluate(() => (window as any).Reveal.slide(1));
  await toggleCommenting(page);
  const at = () => page.evaluate(() => (window as any).Reveal.getIndices().h as number);
  // Pointed at, the deck's arrow is not offered as a block: no outline, no name.
  await page.locator(".navigate-left").hover();
  await expect(page.locator(".pick.show:not(.kf)")).toHaveCount(0);
  await page.locator(".navigate-left").click();
  expect(await at()).toBe(0);
  await page.locator(".navigate-right").click();
  expect(await at()).toBe(1);
  await page.locator(".progress").click({ position: { x: 20, y: 1 } });
  expect(await at()).toBe(2);
  await page.locator(".slide-number").click();
  // Nothing of Pipeup's opened over the deck: no comment box and no naming bar.
  await expect(draft(page)).toHaveCount(0);
  await expect(page.locator(".namebar.show")).toHaveCount(0);
});

test("on a deck with controls in the bottom-right corner, the comment control and its messages sit just above them", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  await settled(page.locator(".launch"));
  const mode = await box(page, ".launch");
  const arrows = await box(page, ".controls");
  const number = await box(page, ".slide-number");
  expect(meets(mode, number)).toBe(false);
  expect(meets(mode, arrows)).toBe(false);
  expect(mode.y + mode.height).toBeLessThanOrEqual(arrows.y + 1);
  // Comment mode's hint sits beside the control, clear of the deck's arrows.
  await page.keyboard.press("Shift+Alt+KeyC");
  const hint = page.locator(".toast.show");
  await expect(hint).toHaveCount(1);
  await settled(hint);
  expect(meets((await hint.boundingBox())!, arrows)).toBe(false);
});

test("a reveal.js deck refits beside All comments, and takes the space back when it closes", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  const slides = () => box(page, ".slides");
  const before = await slides();
  await openAll(page);
  await settled(page.locator(".all"));
  await expect
    .poll(async () => {
      const s = await slides();
      return s.x >= 0 && s.x + s.width <= 1280 - 320 + 1;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Close" }).click();
  await expect.poll(async () => Math.round((await slides()).width)).toBe(Math.round(before.width));
});

test("the example deck refits beside All comments on a 1024-wide window", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(new URL("../examples/review-deck.html", import.meta.url).href);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await openAll(page);
  await settled(page.locator(".all"));
  await expect
    .poll(async () => {
      const d = await box(page, ".deck");
      return d.x >= 0 && d.x + d.width <= 1024 - 320 + 1;
    })
    .toBe(true);
});

test("on a deck that scrolls, a slide scrolled into view can be commented on, and the block cursor starts there", async ({
  page,
}) => {
  await open(page, "scroll-deck.html");
  await page.evaluate(() => scrollTo(0, 300));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // The shortcut's block cursor starts on the first block in view, and the page stays where it is.
  await page.keyboard.press("Shift+Alt+KeyC");
  const two = await box(page, "h2");
  await expect.poll(async () => meets(await box(page, ".pick.show"), two)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(300);
  await page.keyboard.press("Escape");
  await toggleCommenting(page);
  // Slide 1 still covers most of the window; slide 2's words show below it, and can be commented on.
  await selectWords(page, "#s2p", "second slide");
  await page.locator(".selbar.show button").click();
  await expect(draft(page).getByRole("textbox", { name: "Comment" })).toBeFocused();
  await page.keyboard.type("Which second?");
  await page.keyboard.press("Enter");
  await expect.poll(() => savedViews(page)).toEqual({ "Which second?": { slide: "2" } });
  // So can its heading, with a click.
  await leaveReply(page);
  await page.locator("h2").first().click();
  await expect(draft(page).getByRole("textbox", { name: "Comment" })).toBeFocused();
  expect(meets((await draft(page).boundingBox())!, { x: 0, y: 0, width: 1280, height: 800 })).toBe(true);
});

test("copying gives the same words for a thread whether or not its slide shows, and names a slide's element plainly", async ({
  page,
}) => {
  await stubClipboard(page);
  await open(page, "deck.html");
  await seedView(page, "#s1p", "Say which quarter", { slide: "1" });
  const copy = async (as: "As Markdown" | "As text") => {
    await openMenu(page);
    await copyAs(page, as);
    return page.evaluate(() => (window as any).__copied.at(-1) as string);
  };
  const shown = await copy("As text");
  expect(shown).toContain("Paragraph · Growth, retention and what we change in…");
  await page.evaluate(() => (window as any).deck.go(2));
  await expect(control(page)).toHaveAttribute("aria-label", /on other slides/);
  expect(await copy("As text")).toBe(shown);
  const md = await copy("As Markdown");
  expect(md).toContain(
    '- **Element:** Paragraph · Growth, retention and what we change in… in `[data-pipeup-id="s1"]`',
  );
});

test("a text comment on a slide that doesn't show keeps its words when copied", async ({ page }) => {
  await stubClipboard(page);
  await open(page, "deck.html");
  await page.evaluate(() => {
    const w = window as any;
    const t = document.querySelector("#s1p")!.firstChild as Text;
    const r = document.createRange();
    r.setStart(t, t.data.indexOf("retention"));
    r.setEnd(t, t.data.indexOf("retention") + 9);
    return w.pu.document.comment(
      w.Pipeup.describeRange(r, document.body, { slide: "1" }),
      "Define retention",
    );
  });
  await page.evaluate(() => (window as any).deck.go(1));
  await openMenu(page);
  await copyAs(page, "As text");
  const text = await page.evaluate(() => (window as any).__copied.at(-1) as string);
  expect(text).toContain(
    'Slide 1 "Q3 review" › Paragraph · Growth, retention and what we change in…, on the text "retention"',
  );
});
