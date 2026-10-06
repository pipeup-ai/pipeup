import { expect, test, type Page } from "@playwright/test";
import {
  bodySnapshot,
  commenting,
  fixture,
  open,
  seedText,
  settled,
  showComments,
  toggleCommenting,
} from "./helpers";

const gutter = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pipeup-gutter").trim());
const centre = (page: Page) =>
  page.locator("main").evaluate((m) => {
    const r = m.getBoundingClientRect();
    return r.left + r.width / 2;
  });
const width = (page: Page) => page.evaluate(() => document.documentElement.clientWidth);
/** Lets the resize handler and a render run, so "nothing changed" is checked after the fact. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test("a reserving page gets a 320px gutter while the column shows; its content stays centred in the rest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "reserve.html");
  await showComments(page);
  await expect.poll(() => gutter(page)).toBe("320px");
  const w = await width(page);
  await expect.poll(async () => Math.abs((await centre(page)) - (w - 320) / 2)).toBeLessThan(2);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await settled(th);
  const main = (await page.locator("main").boundingBox())!;
  const box = (await th.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(main.x + main.width);
  expect(box.x + box.width).toBeLessThanOrEqual(w);
});

test("the gutter opens with comment mode; leaving it closes the gutter and the content returns to the true centre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "reserve.html");
  // Comments are hidden on load, so the gutter starts closed.
  await expect.poll(() => gutter(page)).toBe("0px");
  await showComments(page);
  await expect.poll(() => gutter(page)).toBe("320px");
  await toggleCommenting(page);
  await commenting(page, false);
  await expect.poll(() => gutter(page)).toBe("0px");
  const w = await width(page);
  await expect.poll(async () => Math.abs((await centre(page)) - w / 2)).toBeLessThan(2);
});

test("narrow windows get bubbles and no gutter, with 24px of hysteresis", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await open(page, "reserve.html");
  await showComments(page);
  await expect.poll(() => gutter(page)).toBe("320px");
  await expect(page.locator(".col")).toHaveCount(1);
  await page.setViewportSize({ width: 985, height: 800 });
  await page.waitForFunction(() => document.documentElement.clientWidth === 985);
  await frames(page);
  await expect(page.locator(".col")).toHaveCount(1);
  expect(await gutter(page)).toBe("320px");
  await page.setViewportSize({ width: 970, height: 800 });
  await expect.poll(() => gutter(page)).toBe("0px");
  await expect(page.locator(".col")).toHaveCount(0);
  await page.setViewportSize({ width: 990, height: 800 });
  await page.waitForFunction(() => document.documentElement.clientWidth === 990);
  await frames(page);
  expect(await gutter(page)).toBe("0px");
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect.poll(() => gutter(page)).toBe("320px");
});

test("pages that don't reserve a gutter get no custom property", async ({ page }) => {
  await open(page, "doc.html");
  expect(await gutter(page)).toBe("");
});

test("unmount removes the gutter and leaves the page's own sheets and DOM exactly as they were", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(fixture("reserve.html"));
  await page.evaluate(() => {
    const own = new CSSStyleSheet();
    own.replaceSync("h1 { letter-spacing: 3px; }");
    document.adoptedStyleSheets = [own];
  });
  const spacing = () => page.evaluate(() => getComputedStyle(document.querySelector("h1")!).letterSpacing);
  const sheets = () => page.evaluate(() => document.adoptedStyleSheets.length);
  const before = await bodySnapshot(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  await showComments(page);
  await expect.poll(() => gutter(page)).toBe("320px");
  expect(await sheets()).toBe(2);
  expect(
    await page.evaluate(() => [
      document.documentElement.hasAttribute("style"),
      document.body.hasAttribute("style"),
    ]),
  ).toEqual([false, false]);
  expect(await spacing()).toBe("3px");
  await page.evaluate(() => (window as any).pu.unmount());
  expect(await gutter(page)).toBe("");
  expect(await sheets()).toBe(1);
  expect(await spacing()).toBe("3px");
  // The page's own CSS eases its padding back as the gutter closes: once it has, the page is exactly as it was.
  await expect.poll(() => bodySnapshot(page)).toBe(before);
});

for (const [name, file, on, off] of [
  ["a percentage max-width", "reserve-percent.html", 1700, 1300],
  ["a fixed width with no max-width", "reserve-fixed.html", 1100, 900],
] as const) {
  test(`${name}: the column shows when there is room, not when narrow, and never flips at the threshold`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: on, height: 800 });
    await open(page, file);
    await showComments(page);
    await expect.poll(() => gutter(page)).toBe("320px");
    await expect(page.locator(".col")).toHaveCount(1);
    await page.setViewportSize({ width: off, height: 800 });
    await expect.poll(() => gutter(page)).toBe("0px");
    await expect(page.locator(".col")).toHaveCount(0);
    // Stable at both ends: nothing changes after the page has had time to react.
    for (let i = 0; i < 3; i++) {
      await frames(page);
      expect(await gutter(page)).toBe("0px");
    }
    await page.setViewportSize({ width: on, height: 800 });
    await expect.poll(() => gutter(page)).toBe("320px");
    for (let i = 0; i < 3; i++) {
      await frames(page);
      expect(await gutter(page)).toBe("320px");
    }
  });
}

/** Fires resize several times at one window width, returning the gutter read after each. */
async function resizeReads(page: Page, w: number): Promise<string[]> {
  await page.setViewportSize({ width: w, height: 800 });
  await page.waitForFunction((x) => document.documentElement.clientWidth === x, w);
  const reads: string[] = [await gutter(page)];
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await frames(page);
    reads.push(await gutter(page));
  }
  return reads;
}

for (const [name, file, widths] of [
  ["a fixed width", "reserve-fixed.html", [1100, 1150, 1290]],
  ["a percentage max-width, just inside its band", "reserve-percent.html", [1490, 1550, 1590]],
] as const) {
  test(`${name}: repeated resizes between the thresholds never change the gutter`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 800 }); // wide enough to switch on from closed
    await open(page, file);
    await showComments(page);
    await expect.poll(() => gutter(page)).toBe("320px");
    for (const w of widths) {
      const reads = await resizeReads(page, w);
      expect(new Set(reads), `${w}px read ${reads.join(" ")}`).toEqual(new Set(["320px"]));
    }
  });
}
