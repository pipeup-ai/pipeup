import { expect, test } from "@playwright/test";
import { open, seedElement, seedText, showComments } from "./helpers";

test("element comments get a bubble at the end of the element's content", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav: “Start free”?");
  const bub = page.locator(".bub.in");
  await expect(bub).toHaveCount(1);
  const b = (await bub.boundingBox())!;
  const cta = (await page.locator(".cta").boundingBox())!;
  expect(b.x).toBeGreaterThan(cta.x);
  expect(b.x).toBeLessThan(cta.x + cta.width + 10);
});

test("hovering a bubble previews it; clicking opens the thread; replying and resolving work", async ({
  page,
}) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  const bub = page.locator(".bub.in");
  await bub.hover();
  await expect(page.locator(".tip.show")).toContainText("Match the nav?");
  await bub.click();
  const pop = page.locator(".pop.show");
  await expect(pop).toContainText("Match the nav?");
  await pop.locator(".rbox.always textarea").fill("Yes — will change it.");
  await pop.locator(".rbox.always textarea").press("Enter");
  await expect(pop).toContainText("Yes — will change it.");
  await pop.locator(".root").hover();
  await pop.getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator(".bub")).toHaveCount(0);
  await expect(page.locator(".toast.show")).toContainText("Resolved");
});

test("text comments have no bubble; the highlight previews and opens them below the line", async ({
  page,
}) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await expect(page.locator(".bub")).toHaveCount(0);
  const box = await page.evaluate(() => {
    const r = [...CSS.highlights.get("pipeup-quote")!][0] as Range;
    const q = r.getClientRects()[0]!;
    return {
      x: q.left + q.width / 2,
      y: q.top + q.height / 2,
      bottom: [...r.getClientRects()].at(-1)!.bottom,
    };
  });
  await page.mouse.move(box.x, box.y);
  await expect(page.locator(".tip.show")).toContainText("Love this line.");
  await page.mouse.click(box.x, box.y);
  const pop = page.locator(".pop.show");
  await expect(pop).toContainText("Love this line.");
  expect((await pop.boundingBox())!.y).toBeGreaterThanOrEqual(box.bottom);
});

test("pins sit exactly at their point", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a fake number", { x: 0.5, y: 0.5 });
  // The bubble eases in (it starts raised and small); measure once it has settled.
  await expect(page.locator(".bub.in")).toHaveCSS("transform", "none");
  const b = (await page.locator(".bub.in").boundingBox())!;
  const tile = (await page.locator("[data-pipeup-id=tile-mrr]").boundingBox())!;
  // The bubble's tip is its bottom-left corner (margin -20px 0 0 -2px).
  expect(Math.abs(b.x + 2 - (tile.x + tile.width / 2))).toBeLessThan(3);
  expect(Math.abs(b.y + 20 - (tile.y + tile.height / 2))).toBeLessThan(3);
});

test("comment text is never treated as HTML", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=tile-churn]", '<img src=x onerror="window.__pwned=1">');
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show")).toContainText("<img src=x");
  await expect(page.locator("pipeup-root img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
});
