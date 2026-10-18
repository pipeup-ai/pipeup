import { expect, test, type Page } from "@playwright/test";
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
  await pop.getByRole("button", { name: "Resolve", exact: true }).click();
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

/**
 * What is wrong with the bubbles on screen: one outside the window, over another bubble or over a column card, or not
 * the one a click at its middle would reach. Measured once every bubble has eased in.
 */
async function crowding(page: Page): Promise<string[]> {
  const settledAll = () =>
    page.evaluate(() =>
      [...document.querySelector("pipeup-root")!.shadowRoot!.querySelectorAll(".bub.in")].every(
        (b) => getComputedStyle(b).transform === "none",
      ),
    );
  await expect.poll(settledAll).toBe(true);
  return page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    const bubs = [...root.querySelectorAll<HTMLElement>(".bub.in")];
    const cards = [...root.querySelectorAll(".th")].map((c) => c.getBoundingClientRect());
    const meets = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const wrong: string[] = [];
    bubs.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const name = `bubble ${i + 1} at ${Math.round(r.left)},${Math.round(r.top)}`;
      if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)
        wrong.push(`${name}: outside`);
      if (bubs.some((o, j) => j !== i && meets(r, o.getBoundingClientRect())))
        wrong.push(`${name}: on a bubble`);
      if (cards.some((c) => meets(r, c))) wrong.push(`${name}: on a card`);
      if (root.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== b)
        wrong.push(`${name}: covered`);
    });
    return wrong;
  });
}

/** Opens the document at `width` with `n` comments on its Revenue chart (and, for the column, two on its words). */
async function chartWith(page: Page, width: number, n: number, words = false): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await open(page, "doc.html");
  if (words) {
    await seedText(page, "#p1", "onboarding flow", "Which flow?");
    await seedText(page, "#p2", "six people", "Is six enough?");
  }
  for (let i = 1; i <= n; i++) await seedElement(page, "[data-pipeup-id=revenue-chart]", `Chart note ${i}`);
  await expect(page.locator(".bub.in")).toHaveCount(n);
}

const chartBubble = (page: Page, n: number) =>
  page.getByRole("button", { name: `Comment on Revenue chart: Chart note ${n}`, exact: true });

for (const width of [1180, 1280, 1440]) {
  test(`at ${width} wide, eight comments on one chart step aside left of the column, each clear and clickable`, async ({
    page,
  }) => {
    await chartWith(page, width, 8, true);
    await expect(page.locator(".th")).toHaveCount(10);
    expect(await crowding(page)).toEqual([]);
    // The first and the last each open their own thread.
    for (const n of [1, 8]) {
      await chartBubble(page, n).click();
      await expect(page.locator(".th.on")).toContainText(`Chart note ${n}`);
    }
  });
}

test("near the window's edge, comments on one element step left rather than pile on one spot", async ({
  page,
}) => {
  await chartWith(page, 760, 6);
  await seedElement(page, "[data-pipeup-id=q4-bar]", "Label the Q4 bar");
  await expect(page.locator(".bub.in")).toHaveCount(7);
  expect(await crowding(page)).toEqual([]);
  // The chart's first bubble still opens its thread.
  await chartBubble(page, 1).click();
  await expect(page.locator(".pop.show")).toContainText("Chart note 1");
});

test("more comments than a row has room for wrap to a row below, each still clear and clickable", async ({
  page,
}) => {
  await chartWith(page, 420, 20);
  expect(await crowding(page)).toEqual([]);
  const tops = await page
    .locator(".bub.in")
    .evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().top));
  expect(new Set(tops).size).toBeGreaterThan(1);
});
