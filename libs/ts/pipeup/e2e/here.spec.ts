import { expect, test, type Page } from "@playwright/test";
import { fixture, open, savedViews, selectWords, showComments } from "./helpers";

/** Comment mode is on: clicks a block and writes a comment on it. */
async function commentOn(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).click();
  const box = page.locator(".pop.show .draft").getByRole("textbox", { name: "Comment" });
  await box.fill(text);
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
}

test("on a class-toggled deck, a new comment saves the slide showing, and the deck's keys still work in comment mode", async ({
  page,
}) => {
  await open(page, "deck.html");
  await showComments(page);
  await commentOn(page, "#s1box", "Title box");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#count")).toHaveText("2 / 3");
  await commentOn(page, "[data-pipeup-id=s2-q4]", "Label the Q4 bar");
  expect(await savedViews(page)).toEqual({ "Title box": { slide: "1" }, "Label the Q4 bar": { slide: "2" } });
});

test("on a scrolling deck, the slide covering most of the window is the one saved", async ({ page }) => {
  await open(page, "scroll-deck.html");
  await page.evaluate(() => document.querySelector("#s3p")!.scrollIntoView({ block: "center" }));
  await showComments(page);
  await selectWords(page, "#s3p", "third slide");
  await page.locator(".selbar.show button").click();
  await page.locator(".pop.show .draft").getByRole("textbox", { name: "Comment" }).fill("Which third?");
  await page.keyboard.press("Enter");
  await expect.poll(() => savedViews(page)).toEqual({ "Which third?": { slide: "3" } });
});

test("on a reveal.js deck, the current slide comes from Reveal", async ({ page }) => {
  await open(page, "reveal.html");
  await page.keyboard.press("ArrowRight");
  await showComments(page);
  // Content outside every slide takes the current slide, and only Reveal knows it is slide 2.
  await commentOn(page, "#note", "Notes");
  expect(await savedViews(page)).toEqual({ Notes: { slide: "2" } });
});

test("a page's reported view is saved with new comments, including state reported before mounting", async ({
  page,
}) => {
  await open(page, "tabs.html");
  await showComments(page);
  await commentOn(page, "#pro", "Too cheap?");
  await page.keyboard.press("Shift+Alt+KeyC");
  await page.locator("#tab-faq").click();
  await showComments(page);
  await commentOn(page, "#refunds", "Say 30 days up top");
  expect(await savedViews(page)).toEqual({
    "Too cheap?": { tab: "plans", label: "Plans tab" },
    "Say 30 days up top": { tab: "faq", label: "FAQ tab" },
  });
});

test("a deck's own hook says which slide shows", async ({ page }) => {
  await page.goto(fixture("deck.html"));
  await page.evaluate(async () => {
    const w = window as any;
    // The hook disagrees with the page on purpose: it wins.
    w.pu = await w.Pipeup.mount({ slides: { current: () => 3, go: () => {} } });
  });
  await showComments(page);
  await commentOn(page, "#foot", "Hooked");
  expect(await savedViews(page)).toEqual({ Hooked: { slide: "3" } });
});
