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

/**
 * Runs in the page: the contrast of an element's words against the first opaque background behind them inside
 * Pipeup (0 when none of Pipeup's own is there, since then it would depend on the page). Colours go through a canvas
 * so any format the browser serialises (rgb, color(), oklab…) reads the same.
 */
const readingOf = (el: Element) => {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const rgba = (css: string): number[] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  let bg: number[] | null = null;
  for (let e: Element | null = el; e && !bg; e = e.parentElement) {
    const c = rgba(getComputedStyle(e).backgroundColor);
    if (c[3]! >= 0.99) bg = c;
  }
  const a = lum(rgba(getComputedStyle(el).color));
  if (!bg) return 0;
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test("on a dark page, words in the column read against their own backing, not the page", async ({ page }) => {
  await open(page, "hostile.html");
  await night(page, true);
  await showComments(page);
  await seedText(page, "#p2", "managers", "Who owns this?");
  const tx = page.locator(".th .tx");
  await expect(tx).toContainText("Who owns this?");
  await expect.poll(() => tx.evaluate(readingOf)).toBeGreaterThanOrEqual(4.5);
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
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        direction: cs.direction,
        color: cs.color,
      };
    });
const ratioOf = (page: Page, selector = ".menu .mi .lb") =>
  page.locator(selector).first().evaluate(readingOf);
/**
 * `seen`, once the element is really there: the column redraws as comments settle, and a computed style read from an
 * element that has just been replaced comes back empty.
 */
const settledSeen = async (page: Page, selector?: string) => {
  let last = await seen(page, selector);
  await expect
    .poll(async () => {
      last = await seen(page, selector);
      return last.fontSize;
    })
    .not.toBe("");
  return last;
};
/** The contrast of the words at `selector`, waiting out a redraw. */
const settledRatio = async (page: Page, selector?: string) => {
  let ratio = 0;
  await expect.poll(async () => (ratio = await ratioOf(page, selector))).toBeGreaterThanOrEqual(4.5);
  return ratio;
};

const HOSTILE = ["star", "vars", "body", "scheme", "rtl", "resets", "star,vars,body,scheme,rtl,resets"];
// The column only appears where the page leaves room for it, so these compare the menu, which is always there.
for (const rules of HOSTILE) {
  test(`hostile page styles (${rules}) change nothing about how Pipeup's menu looks`, async ({
    page,
    browser,
  }) => {
    await pageWith(page);
    await openMenu(page);
    const plain = await settledSeen(page);
    // Its own browser context, so the first page's saved comment isn't here too.
    const other = await (await browser.newContext()).newPage();
    await pageWith(other, rules);
    await openMenu(other);
    const hostile = await settledSeen(other);
    expect(hostile).toEqual(plain);
    await settledRatio(other);
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
    const plain = await settledSeen(page, ".th .tx");
    const other = await (await browser.newContext()).newPage();
    await pageWith(other, rules);
    await expect(other.locator(".th .tx")).toContainText("Who owns this?");
    const hostile = await settledSeen(other, ".th .tx");
    expect(hostile).toEqual(plain);
    await settledRatio(other, ".th .tx");
    await other.context().close();
  });
}

test("with forced colours on, Pipeup's words still read against their backing", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await pageWith(page);
  await openMenu(page);
  await settledRatio(page);
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
  await settledRatio(page);
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

const appearance = (page: Page) => page.evaluate(() => (window as any).pu.appearance());

test("a page that dresses its wrapper in oklch() is read as dark", async ({ page }) => {
  await page.goto(fixture("hostile.html?rules=oklch"));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  await expect(layer(page)).toHaveClass(/dark/);
  expect(await appearance(page)).toMatchObject({
    look: "dark",
    source: "page",
    effects: [],
  });
});

test("styles on <html> that Pipeup can't undo are listed, and said once in the console", async ({ page }) => {
  const said: string[] = [];
  page.on("console", (m) => m.type() === "warning" && said.push(m.text()));
  await page.goto(fixture("hostile.html?rules=filter"));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  expect(await appearance(page)).toMatchObject({
    look: "light",
    effects: ["filter: grayscale(1)"],
  });
  // A change elsewhere makes Pipeup look again; it doesn't repeat itself.
  await night(page, true);
  await night(page, false);
  await page.waitForTimeout(900);
  expect(said.filter((t) => t.includes("styles on <html>"))).toHaveLength(1);
  expect(said[0]).toContain("filter: grayscale(1)");
});

test("a page that fades <html> is said to make Pipeup hard to read, and Pipeup keeps the look it chose", async ({
  page,
}) => {
  const said: string[] = [];
  page.on("console", (m) => m.type() === "warning" && said.push(m.text()));
  await page.goto(fixture("hostile.html?rules=fade"));
  await page.evaluate(async () => {
    const w = window as any;
    document.documentElement.setAttribute("data-pipeup-theme", "light");
    w.pu = await w.Pipeup.mount({});
  });
  const a = await appearance(page);
  expect(a).toMatchObject({ look: "light", source: "author" });
  expect(a.effects).toEqual(["opacity: 0.35"]);
  expect(a.ratio).toBeLessThan(3);
  await expect(layer(page)).not.toHaveClass(/dark/);
  expect(said.join("\n")).toContain("may be hard to read");
});

test("a page with no styles on <html> has nothing to report", async ({ page }) => {
  const said: string[] = [];
  page.on("console", (m) => m.type() === "warning" && said.push(m.text()));
  await open(page, "hostile.html");
  expect(await appearance(page)).toMatchObject({ look: "light", effects: [] });
  expect(said).toEqual([]);
});
