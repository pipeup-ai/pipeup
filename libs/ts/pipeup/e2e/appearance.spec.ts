import { expect, test, type Page } from "@playwright/test";
import { fixture, open, openMenu, seedText, showComments } from "./helpers";

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

const pageWith = async (page: Page, rules = "") => {
  await page.goto(fixture(`hostile.html${rules ? `?rules=${rules}` : ""}`));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  await showComments(page);
  await seedText(page, "#p2", "managers", "Who owns this?");
  await expect(page.locator("pipeup-root")).toHaveCount(1);
};

/**
 * What a person sees of Pipeup's words in the menu (or wherever `selector` points), and how well they read against
 * what is behind them. The font family is left out: Pipeup takes on the page's own font, by design.
 */
const seen = (page: Page, selector = ".menu .mi .lb") =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
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
      const cs = getComputedStyle(el);
      const a = lum(rgb(cs.color));
      const b = lum(bg ?? [0, 0, 0]);
      return {
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        direction: cs.direction,
        color: cs.color,
        ratio: bg ? (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) : 0,
      };
    });

const HOSTILE = ["star", "vars", "body", "scheme", "rtl", "resets", "star,vars,body,scheme,rtl,resets"];
// The column only appears where the page leaves room for it, so these compare the menu, which is always there.
for (const rules of HOSTILE) {
  test(`hostile page styles (${rules}) change nothing about how Pipeup's menu looks`, async ({
    page,
    browser,
  }) => {
    await pageWith(page);
    await openMenu(page);
    const plain = await seen(page);
    // Its own browser context, so the first page's saved comment isn't here too.
    const other = await (await browser.newContext()).newPage();
    await pageWith(other, rules);
    await openMenu(other);
    const hostile = await seen(other);
    expect(hostile).toEqual(plain);
    expect(hostile.ratio).toBeGreaterThanOrEqual(4.5);
    await expect(layer(other)).not.toHaveClass(/dark/);
    await other.context().close();
  });
}

// On pages that keep the column's room, its words are checked too.
for (const rules of ["star", "vars", "body", "scheme"]) {
  test(`hostile page styles (${rules}) change nothing about how Pipeup's column looks`, async ({
    page,
    browser,
  }) => {
    await pageWith(page);
    await expect(page.locator(".th .tx")).toContainText("Who owns this?");
    const plain = await seen(page, ".th .tx");
    const other = await (await browser.newContext()).newPage();
    await pageWith(other, rules);
    await expect(other.locator(".th .tx")).toContainText("Who owns this?");
    const hostile = await seen(other, ".th .tx");
    expect(hostile).toEqual(plain);
    expect(hostile.ratio).toBeGreaterThanOrEqual(4.5);
    await other.context().close();
  });
}

test("with forced colours on, Pipeup's words still read against their backing", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await pageWith(page);
  await openMenu(page);
  expect((await seen(page)).ratio).toBeGreaterThanOrEqual(4.5);
});

test("the Look row in the menu overrides the page, and the choice is kept", async ({ page }) => {
  await pageWith(page);
  const row = page.locator(".mi", { hasText: "Look" });
  await openMenu(page);
  await expect(row).toContainText("Automatic");
  await row.click();
  await expect(row).toContainText("Light");
  await expect(layer(page)).not.toHaveClass(/dark/);
  await row.click();
  await expect(row).toContainText("Dark");
  await expect(layer(page)).toHaveClass(/dark/);
  // The page's own look is still light; Pipeup's words still read on their own backing.
  expect((await seen(page)).ratio).toBeGreaterThanOrEqual(4.5);
  await page.reload();
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  await expect(layer(page)).toHaveClass(/dark/);
  await openMenu(page);
  await row.click();
  await expect(row).toContainText("Automatic");
  await expect(layer(page)).not.toHaveClass(/dark/);
});

test("a reviewer's choice beats the author's setting", async ({ page }) => {
  await page.goto(fixture("hostile.html"));
  await page.evaluate(async () => {
    const w = window as any;
    document.documentElement.setAttribute("data-pipeup-theme", "dark");
    w.pu = await w.Pipeup.mount({});
  });
  await expect(layer(page)).toHaveClass(/dark/);
  await openMenu(page);
  await page.locator(".mi", { hasText: "Look" }).click(); // Light
  await expect(layer(page)).not.toHaveClass(/dark/);
});
