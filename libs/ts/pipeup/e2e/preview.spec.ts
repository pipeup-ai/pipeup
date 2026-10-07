import { expect, test, type Page } from "@playwright/test";
import { open, seedElement, seedText, showComments } from "./helpers";

/** The centre of the highlighted line whose text contains `words` (default: the first one). */
const centreOf = (page: Page, words?: string) =>
  page.evaluate((w) => {
    const all = [...CSS.highlights.get("pipeup-quote")!] as Range[];
    const range = w ? all.find((r) => r.toString().includes(w))! : all[0]!;
    const r = range.getClientRects()[0]!;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, words);

/** The centre of a text comment's first highlighted line. */
const quoteCentre = (page: Page) =>
  page.evaluate(() => {
    const r = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

test("a bubble's preview waits for the pointer, and clicking it opens the thread", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await page.locator(".bub.in").hover();
  const tip = page.locator(".tip.show");
  await expect(tip).toContainText("Match the nav?");
  const t = (await tip.boundingBox())!;
  // Travel onto the preview and linger past the grace period: it stays.
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  await expect(tip).toHaveCount(1);
  await tip.click();
  await expect(page.locator(".pop.show")).toContainText("Match the nav?");
  await expect(page.locator(".tip.show")).toHaveCount(0);
});

test("a preview stays briefly after the pointer leaves, then eases away", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const at = await quoteCentre(page);
  await page.mouse.move(at.x, at.y);
  await expect(page.locator(".tip.show")).toContainText("Love this line.");
  await page.mouse.move(at.x, at.y + 400);
  await expect(page.locator(".tip.show")).toHaveCount(1);
  // It fades rather than vanishing: a moment later it is still there, partly transparent, without `show`.
  await expect(page.locator(".tip.show")).toHaveCount(0);
  const tip = page.locator(".tip");
  await expect
    .poll(() => tip.evaluate((el) => Number(getComputedStyle(el).opacity)), { intervals: [10, 10, 10, 10] })
    .toBeLessThan(1);
  await expect(tip).toHaveCSS("opacity", "0");
});

test("moving from one highlight to another swaps the preview with no close in between", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "Answers about", "First thought.");
  await seedText(page, "h1", "in minutes not meetings", "Second thought.");
  const a = await centreOf(page, "Answers about");
  const b = await centreOf(page, "in minutes");
  await page.mouse.move(a.x, a.y);
  await expect(page.locator(".tip.show")).toContainText("First thought.");
  await page.evaluate(() => {
    (window as any).closes = 0;
    const tip = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".tip")!;
    new MutationObserver(() => {
      if (!tip.classList.contains("show")) (window as any).closes++;
    }).observe(tip, { attributes: true, attributeFilter: ["class"] });
  });
  await page.mouse.move(b.x, b.y);
  await expect(page.locator(".tip.show")).toContainText("Second thought.");
  expect(await page.evaluate(() => (window as any).closes)).toBe(0);
});

test("after clicking a preview, Esc leaves no preview and no hot highlight behind", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await page.locator(".bub.in").hover();
  const tip = page.locator(".tip.show");
  await expect(tip).toContainText("Match the nav?");
  await tip.click();
  await expect(page.locator(".pop.show")).toBeVisible();
  await page.mouse.move(640, 700, { steps: 4 });
  // From here on, the preview must never come back for a thread the pointer isn't on.
  await page.evaluate(() => {
    (window as any).shows = 0;
    const tip = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".tip")!;
    new MutationObserver(() => {
      if (tip.classList.contains("show")) (window as any).shows++;
    }).observe(tip, { attributes: true, attributeFilter: ["class"] });
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).shows)).toBe(0);
  expect(await page.evaluate(() => CSS.highlights.get("pipeup-on")?.size ?? 0)).toBe(0);
});

test("clicking an open thread's bubble or highlight keeps it open", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const bub = page.locator(".bub.in");
  await bub.click();
  await bub.click();
  await expect(page.locator(".pop.show")).toContainText("Match the nav?");
  const at = await quoteCentre(page);
  await page.mouse.click(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".pop.show")).toContainText("Love this line.");
});

test("Escape, a click elsewhere, or opening another thread closes the open one", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a fake number");
  const cta = page.getByRole("button", { name: "Comment on Link · Start free trial: Match the nav?" });
  const tile = page.getByRole("button", { name: "Comment on MRR tile: Use a fake number" });
  await cta.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await cta.click();
  await page.mouse.click(640, 760);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await cta.click();
  await tile.click();
  await expect(page.locator(".pop.show")).toContainText("Use a fake number");
  await expect(page.locator(".pop.show")).not.toContainText("Match the nav?");
});

test("in the document column, clicking an open thread's highlight keeps it open", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const at = await quoteCentre(page);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".th.on")).toHaveCount(1);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".th.on")).toHaveCount(1);
});

test("a preview lets go when the pointer leaves through Pipeup's own UI; Esc brings nothing back", async ({
  page,
}) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const at = await quoteCentre(page);
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.mouse.click(at.x, at.y);
  const pop = page.locator(".pop.show");
  await expect(pop).toContainText("Love this line.");
  // Straight from the highlight onto its popover (no page in between), then out onto blank page.
  const p = (await pop.boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + 12);
  await page.mouse.move(640, 700, { steps: 6 });
  // Past the preview's grace period: the pointer is on nothing, so nothing should still be held.
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    (window as any).shows = 0;
    const tip = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".tip")!;
    new MutationObserver(() => {
      if (tip.classList.contains("show")) (window as any).shows++;
    }).observe(tip, { attributes: true, attributeFilter: ["class"] });
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).shows)).toBe(0);
  expect(await page.evaluate(() => CSS.highlights.get("pipeup-on")?.size ?? 0)).toBe(0);
});

test("moving from a highlight straight onto its preview keeps the preview", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const at = await quoteCentre(page);
  await page.mouse.move(at.x, at.y, { steps: 4 });
  const tip = page.locator(".tip.show");
  await expect(tip).toContainText("Love this line.");
  const t = (await tip.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.waitForTimeout(600);
  await expect(tip).toHaveCount(1);
});
