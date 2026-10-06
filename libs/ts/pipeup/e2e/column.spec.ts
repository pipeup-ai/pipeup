import { expect, test } from "@playwright/test";
import { open, seedElement, seedText, showComments } from "./helpers";

const quoteTop = (page: import("@playwright/test").Page, i = 0) =>
  page.evaluate((i) => ([...CSS.highlights.get("pipeup-quote")!][i] as Range).getClientRects()[0]!.top, i);

test("on documents, threads sit in a column beside the text, level with it", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p2", "second designer", "Why Q4?");
  const th = page.locator(".th");
  await expect(th).toContainText("Why Q4?");
  const top = await quoteTop(page);
  await expect.poll(async () => Math.abs((await th.boundingBox())!.y - top)).toBeLessThan(10);
  const article = (await page.locator("article").boundingBox())!;
  expect((await th.boundingBox())!.x).toBeGreaterThan(article.x + article.width);
});

test("threads on the same line stack without overlapping", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "new onboarding flow", "Which flow?");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(page.locator(".th")).toHaveCount(2);
  await expect
    .poll(async () => {
      const [a, b] = await page
        .locator(".th")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).sort((x, y) => x.top - y.top));
      return b!.top >= a!.bottom;
    })
    .toBe(true);
});

test("hovering connects; clicking opens, aligns and dims the rest; Escape closes", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Then what?");
  const first = page.locator(".th", { hasText: "Is 20% realistic?" });
  await first.hover();
  await expect.poll(() => page.locator(".pulse").count()).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => CSS.highlights.get("pipeup-on")?.size ?? 0)).toBe(1);
  // Click the words: on hover the footer opens and its action buttons sit under the thread's centre.
  await first.locator(".tx").first().click();
  await expect(first).toHaveClass(/\bon\b/);
  await expect(page.locator(".th", { hasText: "Then what?" })).toHaveClass(/\bdim\b/);
  await expect(first.locator(".rbox.always textarea")).toBeVisible();
  await page.mouse.move(5, 5);
  await page.keyboard.press("Escape");
  await expect(page.locator(".th.on")).toHaveCount(0);
});

test("element comments in documents get a bubble that opens their column thread", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=q4-bar]", "Label the Q4 bar.");
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.locator(".bub.in").click();
  await expect(page.locator(".th.on")).toContainText("Label the Q4 bar.");
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test("narrow pages use bubbles and popovers instead", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(page.locator(".th")).toHaveCount(0);
  const at = await page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + 4, y: q.top + q.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".pop.show")).toContainText("Is 20% realistic?");
});

test("comments on removed content move to the end and say what they were on", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work slips", "Then what?");
  await page.evaluate(() => document.getElementById("p3")!.remove());
  const lost = page.locator(".th.lost");
  await expect(lost).toContainText("No longer on the page");
  await expect(lost).toContainText("pricing work slips");
  const other = (await page.locator(".th:not(.lost)").boundingBox())!;
  expect((await lost.boundingBox())!.y).toBeGreaterThan(other.y);
});

test("threads follow the text when the layout changes without any DOM change", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p2", "second designer", "Why Q4?");
  const th = page.locator(".th");
  await expect(th).toContainText("Why Q4?");
  const before = await quoteTop(page);
  await expect.poll(async () => Math.abs((await th.boundingBox())!.y - before)).toBeLessThan(10);
  // A stylesheet rule added through the CSSOM changes the layout but is not a DOM mutation.
  await page.evaluate(() => document.styleSheets[0]!.insertRule("#p1{padding-bottom:200px}"));
  const after = await quoteTop(page);
  expect(after).toBeGreaterThan(before + 150);
  await expect.poll(async () => Math.abs((await th.boundingBox())!.y - after)).toBeLessThan(10);
});
