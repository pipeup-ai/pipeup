import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bodySnapshot,
  control,
  fixture,
  leaveReply,
  open,
  openMenu,
  seedElement,
  seedText,
  seedView,
  selectWords,
  settled,
  showComments,
} from "./helpers";

const count = (page: Page) => page.locator(".launch .mode .cnt .n.on");
const quoteHighlights = (page: Page) =>
  page.evaluate(() => (CSS.highlights.get("pipeup-quote") as unknown as Set<Range> | undefined)?.size ?? 0);

test("on a deck only this slide's threads show, and they change with the slide", async ({ page }) => {
  await open(page, "deck.html");
  await seedView(page, "#s1box", "Box on one", { slide: "1" });
  await seedView(page, "[data-pipeup-id=s2-q4]", "Bar on two", { slide: "2" });
  await page.evaluate(() => {
    const w = window as any;
    const p = document.querySelector("#s3p")!;
    const r = document.createRange();
    r.setStart(p.firstChild!, 0);
    r.setEnd(p.firstChild!, 4);
    return w.pu.document.comment(w.Pipeup.describeRange(r, document.body, { slide: "3" }), "Words on three");
  });
  await showComments(page);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  expect(await quoteHighlights(page)).toBe(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await expect(page.locator(".bub")).toHaveCount(1);
  await settled(page.locator(".bub.in"));
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show")).toContainText("Bar on two");
  // The open thread closes when its slide goes.
  await leaveReply(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".bub")).toHaveCount(0);
  await expect.poll(() => quoteHighlights(page)).toBe(1);
});

test("a slide change fades the old slide's bubbles out, never snapping", async ({ page }) => {
  await open(page, "deck.html");
  await seedView(page, "#s1box", "Box on one", { slide: "1" });
  await showComments(page);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.evaluate(() => {
    const w = window as any;
    const b = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".bub")!;
    w.__op = [];
    const t0 = performance.now();
    const tick = () => {
      if (b.isConnected) w.__op.push(Number(getComputedStyle(b).opacity));
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bub")).toHaveCount(0);
  const seen = await page.evaluate(() => (window as any).__op as number[]);
  expect(seen.some((o) => o > 0.05 && o < 0.95)).toBe(true);
});

test("the control counts the threads here and marks those on other slides", async ({ page }) => {
  await open(page, "deck.html");
  await seedView(page, "#s1box", "One", { slide: "1" });
  await seedView(page, "#s1p", "Two", { slide: "1" });
  await seedView(page, "[data-pipeup-id=s2-q4]", "Three", { slide: "2" });
  await expect(count(page)).toHaveText("2");
  await expect(control(page)).toHaveClass(/\belse\b/);
  await expect(page.locator(".launch .mode .dot")).toHaveCSS("opacity", "1");
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 2 here · 1 on other slides");
  await expect(page.locator(".launch .ttip")).toContainText("2 here · 1 on other slides");
  await page.keyboard.press("ArrowRight");
  await expect(count(page)).toHaveText("1");
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 1 here · 2 on other slides");
  await page.keyboard.press("ArrowRight");
  // Nothing here: the bubble goes, the dot stays.
  await expect(control(page)).not.toHaveClass(/\bhas\b/);
  await expect(control(page)).toHaveClass(/\belse\b/);
  await expect(page.locator(".launch .mode .dot")).toHaveCSS("opacity", "1");
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 0 here · 3 on other slides");
});

test("on a reveal.js deck, Reveal decides what is here", async ({ page }) => {
  await open(page, "reveal.html");
  await seedView(page, "#r1p", "On one", { slide: "1" });
  await seedView(page, "#r2p", "On two", { slide: "2" });
  await showComments(page);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(control(page)).toHaveAttribute(
    "aria-label",
    "Comment, comment mode on, 1 here · 1 on other slides",
  );
  await settled(page.locator(".bub.in"));
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show")).toContainText("On two");
});

test("on a tabbed page, threads in another view or on hidden content are elsewhere", async ({ page }) => {
  await open(page, "tabs.html");
  await seedView(page, "#pro", "Too cheap?", { tab: "plans", label: "Plans tab" });
  await seedView(page, "#refunds", "Say it up top", { tab: "faq", label: "FAQ tab" });
  // No view, but the page hides it (a closed details).
  await seedElement(page, "#fine", "Too fine");
  await expect(count(page)).toHaveText("1");
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 1 here · 2 in other views");
  await showComments(page);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.keyboard.press("Shift+Alt+KeyC");
  await page.locator("#tab-faq").click();
  await page.locator("#more summary").click();
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 2 here · 1 in other views");
});

test("following slides and views changes nothing on the page", async ({ page }) => {
  await page.goto(fixture("deck.html"));
  const before = await bodySnapshot(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
  await seedView(page, "#s1box", "One", { slide: "1" });
  await seedView(page, "[data-pipeup-id=s2-q4]", "Two", { slide: "2" });
  await seedText(page, "#s3p", "second designer", "Who?");
  await showComments(page);
  await page.keyboard.press("Shift+Alt+KeyC");
  expect(await bodySnapshot(page)).toBe(before);
});

test("a reply being typed survives the slide changing under its thread", async ({ page }) => {
  await open(page, "deck.html");
  await seedView(page, "[data-pipeup-id=s2-q4]", "Bar on two", { slide: "2" });
  await showComments(page);
  await page.evaluate(() => (window as any).deck.go(1));
  await settled(page.locator(".bub.in"));
  await page.locator(".bub.in").click();
  const line = page.locator(".pop.show textarea");
  await line.fill("half a thought");
  await page.evaluate(() => (window as any).deck.go(0));
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.evaluate(() => (window as any).deck.go(1));
  await settled(page.locator(".bub.in"));
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show textarea")).toHaveValue("half a thought");
});

test("a draft keeps its words but steps aside while its slide is gone", async ({ page }) => {
  await open(page, "deck.html");
  await showComments(page);
  await selectWords(page, "#s1p", "retention");
  await page.locator(".selbar.show button").click();
  const line = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await line.fill("unsent words");
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await page.evaluate(() => (window as any).deck.go(1));
  await expect(page.locator(".pop.show")).toHaveCount(0);
  expect(await quoteHighlights(page)).toBe(0);
  await page.evaluate(() => (window as any).deck.go(0));
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await expect(line).toHaveValue("unsent words");
});

test("Escape leaves a draft with words alone while its slide is gone", async ({ page }) => {
  await open(page, "deck.html");
  await showComments(page);
  await selectWords(page, "#s1p", "retention");
  await page.locator(".selbar.show button").click();
  const line = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await line.fill("unsent words");
  await page.evaluate(() => (window as any).deck.go(1));
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).deck.go(0));
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await expect(line).toHaveValue("unsent words");
});

/** A draft with words on slide 1, with the deck moved on to slide 2 under it. */
async function awayDraft(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.Pipeup.onReveal((view: { slide?: string }) => view.slide && w.deck.go(Number(view.slide) - 1));
  });
  await showComments(page);
  await selectWords(page, "#s1p", "retention");
  await page.locator(".selbar.show button").click();
  const line = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await line.fill("unsent words");
  await page.evaluate(() => (window as any).deck.go(1));
  await expect(page.locator(".pop.show")).toHaveCount(0);
  return line;
}
/** The deck is back on the draft's slide, with the draft showing and its words intact. */
async function backAtDraft(page: Page, line: Locator) {
  await expect(page.locator("#count")).toHaveText("1 / 3");
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await expect(line).toHaveValue("unsent words");
}

test("selecting words elsewhere while a draft with words is away takes the reviewer back to it", async ({
  page,
}) => {
  await open(page, "deck.html");
  const line = await awayDraft(page);
  await selectWords(page, "[data-pipeup-id=s2] h2", "Revenue");
  await page.locator(".selbar.show button").click();
  await backAtDraft(page, line);
});

test("a bubble clicked while a draft with words is away goes back to the draft; an All comments row leaves it be", async ({
  page,
}) => {
  await open(page, "deck.html");
  await seedView(page, "[data-pipeup-id=s2-q4]", "Bar on two", { slide: "2" });
  const line = await awayDraft(page);
  await page.locator(".bub.in").click();
  await backAtDraft(page, line);
  await page.evaluate(() => (window as any).deck.go(1));
  await expect(page.locator("#count")).toHaveText("2 / 3");
  // A row chosen in All comments opens out in the panel and leaves the draft where it is.
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page
    .locator(".all.show")
    .getByRole("menuitem", { name: /Bar on two/ })
    .click();
  await expect(page.locator(".all.show .xr")).toContainText("Bar on two");
  await expect(page.locator("#count")).toHaveText("2 / 3");
  await expect(line).toHaveValue(/./);
});
