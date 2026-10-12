import { expect, test, type Page } from "@playwright/test";
import { open, seedText, showComments } from "./helpers";

const layer = (page: Page) => page.locator(".layer");
const night = (page: Page, on: boolean) =>
  page.evaluate((on) => document.getElementById("app")!.classList.toggle("night", on), on);
/** The colour of the quote highlight as the page sheet paints it: "r, g, b" (its strength changes as it fades in). */
const highlightColour = (page: Page) =>
  page.evaluate(() => {
    const rule = [...document.adoptedStyleSheets]
      .flatMap((s) => [...s.cssRules])
      .find((r) => r.cssText.includes("highlight(pipeup-quote)"));
    return (/rgba?\(([^)]*)\)/.exec(rule?.cssText ?? "")?.[1] ?? "").split(",").slice(0, 3).join(",");
  });

test("Pipeup follows a page whose own switch is a class on a wrapper, not on html or body", async ({
  page,
}) => {
  await open(page, "hostile.html");
  await showComments(page);
  await expect(layer(page)).not.toHaveClass(/dark/);
  await night(page, true);
  await expect(layer(page)).toHaveClass(/dark/);
  await night(page, false);
  await expect(layer(page)).not.toHaveClass(/dark/);
});

test("the highlights switch together with the rest of Pipeup", async ({ page }) => {
  await open(page, "hostile.html");
  await showComments(page);
  await seedText(page, "#p1", "feature development", "Why pause?");
  const light = await highlightColour(page);
  await night(page, true);
  await expect(layer(page)).toHaveClass(/dark/);
  await expect.poll(() => highlightColour(page)).not.toBe(light);
  await night(page, false);
  await expect(layer(page)).not.toHaveClass(/dark/);
  await expect.poll(() => highlightColour(page)).toBe(light);
});

test("an author can set the look with data-pipeup-theme", async ({ page }) => {
  await page.goto(new URL("fixtures/hostile.html", import.meta.url).href);
  await page.evaluate(async () => {
    const w = window as any;
    document.documentElement.setAttribute("data-pipeup-theme", "dark");
    w.pu = await w.Pipeup.mount({});
  });
  await expect(layer(page)).toHaveClass(/dark/);
  await page.evaluate(() => document.documentElement.setAttribute("data-pipeup-theme", "light"));
  await expect(layer(page)).not.toHaveClass(/dark/);
});

test("a right-to-left page does not flip Pipeup", async ({ page }) => {
  await page.goto(new URL("fixtures/hostile.html", import.meta.url).href);
  await page.evaluate(async () => {
    const w = window as any;
    document.documentElement.dir = "rtl";
    w.pu = await w.Pipeup.mount({});
  });
  expect(await layer(page).evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
});

test("threads at rest in the column sit on their own opaque backing", async ({ page }) => {
  await open(page, "hostile.html");
  await showComments(page);
  await seedText(page, "#p2", "managers", "Who owns this?");
  const th = page.locator(".th");
  await expect(th).toContainText("Who owns this?");
  const alpha = await th.evaluate((el) => {
    const m = /rgba?\(([^)]*)\)/.exec(getComputedStyle(el).backgroundColor);
    const parts = m![1]!.split(",").map((x) => parseFloat(x));
    return parts.length > 3 ? parts[3]! : 1;
  });
  expect(alpha).toBe(1);
});

test("on a dark page, words in the column read against their own backing, not the page", async ({ page }) => {
  await open(page, "hostile.html");
  await night(page, true);
  await showComments(page);
  await seedText(page, "#p2", "managers", "Who owns this?");
  const tx = page.locator(".th .tx");
  await expect(tx).toContainText("Who owns this?");
  const ratio = await tx.evaluate((el) => {
    const rgb = (s: string) =>
      /rgba?\(([^)]*)\)/
        .exec(s)![1]!
        .split(",")
        .map((x) => parseFloat(x));
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    let bg: number[] | null = null;
    for (let e: Element | null = el; e && !bg; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if ((c[3] ?? 1) >= 0.99) bg = c;
    }
    const a = lum(rgb(getComputedStyle(el).color));
    if (!bg) return 0; // nothing of Pipeup's own behind the words: it would depend on the page
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
