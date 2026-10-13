import { expect, test, type Page } from "@playwright/test";
import { fixture, open, openMenu, seedView, selectWords, showComments, stubClipboard } from "./helpers";

const list = (page: Page) => page.locator(".all.show");
async function openAll(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(list(page)).toBeVisible();
}
const choose = (page: Page, words: string) =>
  list(page)
    .getByRole("menuitem", { name: new RegExp(words) })
    .click();
/** The thread opens out in the panel; nothing opens on the page. */
const openedInPlace = (page: Page) => page.locator(".all .xr");

async function seedDeck(page: Page): Promise<void> {
  await seedView(page, "[data-pipeup-id=s2-q4]", "Bar on two", { slide: "2" });
  await seedView(page, "#s3p", "Words on three", { slide: "3" });
  await seedView(page, "#s1box", "Box on one", { slide: "1" });
  await seedView(page, "[data-pipeup-id=s3]", "Slide three", { slide: "3" });
}

test("All comments groups a deck's threads by slide, in deck order, this slide marked", async ({ page }) => {
  await open(page, "deck.html");
  await seedDeck(page);
  await page.keyboard.press("ArrowRight");
  await openAll(page);
  await expect(list(page).locator(".sec")).toHaveText([
    "Slide 1 · 1 open",
    "Slide 2 · 1 openThis slide",
    "Slide 3 · 2 open",
  ]);
  await expect(list(page).getByRole("group", { name: "Slide 2 · 1 open · This slide" })).toContainText(
    "Bar on two",
  );
  await expect(list(page).locator(".hd .pn")).toHaveText("4");
});

test("choosing a thread on another slide goes there with the page's onReveal, then opens it in the panel", async ({
  page,
}) => {
  await open(page, "deck.html");
  await page.evaluate(() => {
    const w = window as any;
    w.Pipeup.onReveal((view: { slide?: string }) => view.slide && w.deck.go(Number(view.slide) - 1));
  });
  await seedDeck(page);
  await openAll(page);
  await choose(page, "Words on three");
  await expect(page.locator("#count")).toHaveText("3 / 3");
  await expect(openedInPlace(page)).toContainText("Words on three");
  await expect(list(page)).toBeVisible();
});

test("a deck's hook is used to go there", async ({ page }) => {
  await page.goto(fixture("deck.html"));
  await page.evaluate(async () => {
    const w = window as any;
    w.went = [];
    w.pu = await w.Pipeup.mount({
      slides: {
        current: () => w.deck.at + 1,
        go: (n: number) => {
          w.went.push(n);
          w.deck.go(n - 1);
        },
      },
    });
  });
  await seedDeck(page);
  await openAll(page);
  await choose(page, "Bar on two");
  await expect(openedInPlace(page)).toContainText("Bar on two");
  expect(await page.evaluate(() => (window as any).went)).toEqual([2]);
});

test("reveal.js decks are driven with Reveal.slide", async ({ page }) => {
  await open(page, "reveal.html");
  await seedView(page, "#r3p", "On three", { slide: "3" });
  await openAll(page);
  await choose(page, "On three");
  await expect(openedInPlace(page)).toContainText("On three");
  expect(await page.evaluate(() => (window as any).slid)).toEqual([2]);
});

test("a scrolling deck with no hook scrolls the slide into view", async ({ page }) => {
  await open(page, "scroll-deck.html");
  await seedView(page, "#s3p", "Far down", { slide: "3" });
  await openAll(page);
  await choose(page, "Far down");
  await expect(openedInPlace(page)).toContainText("Far down");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
});

test("with no way to go there, the thread opens in the panel with its snapshot", async ({ page }) => {
  await open(page, "deck.html");
  await seedDeck(page);
  await openAll(page);
  await choose(page, "Words on three");
  const side = openedInPlace(page);
  await expect(side).toContainText("Words on three", { timeout: 3000 });
  await expect(side).toContainText("On slide 3 — it read “Hire a second designer");
  await expect(page.locator("#count")).toHaveText("1 / 3");
});

test("on a tabbed page, other views are grouped by name and choosing one reveals it", async ({ page }) => {
  await open(page, "tabs.html");
  await seedView(page, "#pro", "Too cheap?", { tab: "plans", label: "Plans tab" });
  await seedView(page, "#refunds", "Say it up top", { tab: "faq", label: "FAQ tab" });
  await openAll(page);
  await expect(list(page).locator(".sec")).toHaveText(["FAQ tab"]);
  await choose(page, "Say it up top");
  await expect(page.locator("#faq")).toBeVisible();
  await expect(openedInPlace(page)).toContainText("Say it up top");
  expect(await page.evaluate(() => (window as any).revealed)).toEqual([{ tab: "faq", label: "FAQ tab" }]);
  // Now the plans tab is the other view.
  await expect(list(page).locator(".sec")).toHaveText(["Plans tab"]);
});

test("Copy as Markdown names a non-slide view in the Where line", async ({ page }) => {
  await stubClipboard(page);
  await open(page, "tabs.html");
  await seedView(page, "#refunds", "Say it up top", { tab: "faq", label: "FAQ tab" });
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Copy as Markdown" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__copied.at(-1) as string))
    .toContain('- **Where:** FAQ tab › Section "FAQ" › Paragraph · Refunds within 30 days.');
});

test("choosing a thread elsewhere leaves a draft with words where it is, as opening does", async ({
  page,
}) => {
  await open(page, "deck.html");
  await page.evaluate(() => {
    const w = window as any;
    w.Pipeup.onReveal((view: { slide?: string }) => view.slide && w.deck.go(Number(view.slide) - 1));
  });
  await seedView(page, "#s3p", "Words on three", { slide: "3" });
  await showComments(page);
  await selectWords(page, "#s1p", "retention");
  await page.locator(".selbar.show button").click();
  const line = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await line.fill("unsent words");
  await openAll(page);
  await choose(page, "Words on three");
  await page.waitForTimeout(300);
  await expect(page.locator("#count")).toHaveText("1 / 3");
  await expect(line).toHaveValue("unsent words");
});

test("a jump still waiting does not open its thread over the one chosen after it", async ({ page }) => {
  await open(page, "deck.html");
  await seedDeck(page);
  await openAll(page);
  await choose(page, "Words on three");
  await choose(page, "Box on one");
  await page.waitForTimeout(1300);
  await expect(openedInPlace(page)).toHaveCount(1);
  await expect(openedInPlace(page)).toContainText("Box on one");
});

test("on a tabbed page, content the page hides in the current view is listed as hidden, not under its view", async ({
  page,
}) => {
  await open(page, "tabs.html");
  await seedView(page, "#refunds", "Hidden one", { tab: "plans", label: "Plans tab" });
  await openAll(page);
  await expect(list(page).locator(".sec")).toHaveText(["Hidden on the page"]);
});
