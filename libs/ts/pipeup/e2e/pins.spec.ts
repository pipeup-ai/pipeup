import { expect, test, type Page } from "@playwright/test";
import { commenting, open, settled, showComments, toggleCommenting } from "./helpers";

async function commentMode(page: Page): Promise<void> {
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 790);
}
/** Option-clicks at a point (page.mouse.click takes no modifiers, so Alt is held on the keyboard). */
async function altClick(page: Page, x: number, y: number): Promise<void> {
  await page.keyboard.down("Alt");
  await page.mouse.click(x, y);
  await page.keyboard.up("Alt");
}
/**
 * Where a bubble's tip is: 2px in and 20px down from its corner (margin -20px 0 0 -2px), at any scale (an open
 * or hovered bubble grows from its tip).
 */
async function tipOf(page: Page, selector: string) {
  const b = page.locator(selector);
  await settled(b);
  const r = (await b.boundingBox())!;
  const s = r.width / (await b.evaluate((el) => (el as HTMLElement).offsetWidth));
  return { x: r.x + 2 * s, y: r.y + 20 * s };
}

test("Option-click drops a pin exactly there and starts a comment; Enter posts it", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  const tile = (await page.locator("[data-pipeup-id=tile-teams]").boundingBox())!;
  // Whole pixels: click events report whole-pixel coordinates.
  const x = Math.round(tile.x + tile.width * 0.3);
  const y = Math.round(tile.y + tile.height * 0.6);
  await altClick(page, x, y);
  const ghost = await tipOf(page, ".bub.pin.ghost.in");
  expect(Math.abs(ghost.x - x)).toBeLessThan(2);
  expect(Math.abs(ghost.y - y)).toBeLessThan(2);
  const draft = page.locator(".pop.show .draft");
  await expect(draft.locator(".ctx")).toHaveText("Pin on teams tile");
  await draft.getByRole("textbox", { name: "Comment" }).fill("Use a rounder number");
  await draft.getByRole("textbox", { name: "Comment" }).press("Enter");
  await page.mouse.move(5, 790);
  await expect(page.locator(".bub.pin.in:not(.ghost)")).toHaveCount(1);
  await expect(page.locator(".bub.ghost.in")).toHaveCount(0);
  const pin = await tipOf(page, ".bub.pin.in:not(.ghost)");
  expect(Math.abs(pin.x - x)).toBeLessThan(2);
  expect(Math.abs(pin.y - y)).toBeLessThan(2);
  const point = await page.evaluate(() => (window as any).pu.document.threads()[0].anchor.point);
  expect(point.x).toBeCloseTo((x - tile.x) / tile.width, 2);
  expect(point.y).toBeCloseTo((y - tile.y) / tile.height, 2);
});

test("Escape drops a pending pin", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  const tile = (await page.locator("[data-pipeup-id=tile-teams]").boundingBox())!;
  await altClick(page, tile.x + 20, tile.y + 20);
  await expect(page.locator(".bub.ghost.in")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".bub.ghost.in")).toHaveCount(0);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pu.document.threads().length)).toBe(0);
});

test("pins keep their place on the element when the window resizes", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await showComments(page);
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector("[data-pipeup-id=tile-teams]")!;
    return w.pu.document.comment(w.Pipeup.describeElement(el, document.body, { x: 0.3, y: 0.6 }), "Pinned");
  });
  await page.setViewportSize({ width: 900, height: 800 });
  const tile = (await page.locator("[data-pipeup-id=tile-teams]").boundingBox())!;
  await expect
    .poll(async () => {
      const p = await tipOf(page, ".bub.pin.in");
      return Math.abs(p.x - (tile.x + tile.width * 0.3)) + Math.abs(p.y - (tile.y + tile.height * 0.6));
    })
    .toBeLessThan(3);
});

test("outside comment mode, Option-click is left to the page", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await page.locator("#go").click({ modifiers: ["Alt"] });
  expect(await page.evaluate(() => (window as any).fired)).toContain("go");
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test("Option-click on a link pins it, without following or downloading it", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  const url = page.url();
  let downloads = 0;
  page.on("download", () => downloads++);
  await commentMode(page);
  await page.locator("#cta").click({ modifiers: ["Alt"] });
  await expect(page.locator(".pop.show .draft .ctx")).toHaveText(/^Pin on /);
  await expect(page.locator(".bub.ghost.in")).toHaveCount(1);
  expect(page.url()).toBe(url);
  expect(downloads).toBe(0);
});

test("Option-click where no block is picked pins the whole commentable area", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  const far = (await page.locator(".spacer").boundingBox())!;
  const x = far.x + 300;
  const y = far.y + 100;
  await altClick(page, x, y);
  const ghost = await tipOf(page, ".bub.pin.ghost.in");
  expect(Math.abs(ghost.x - x)).toBeLessThan(2);
  expect(Math.abs(ghost.y - y)).toBeLessThan(2);
  await page.locator(".pop.show .draft").getByRole("textbox", { name: "Comment" }).fill("Too much space");
  await page.keyboard.press("Enter");
  const anchor = await page.evaluate(() => (window as any).pu.document.threads()[0].anchor);
  expect(anchor.path).toBe("");
  expect(anchor.id).toBeUndefined();
});

test("bubbles fade in with the enter timing and out with the exit timing", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  const tile = (await page.locator("[data-pipeup-id=tile-teams]").boundingBox())!;
  await altClick(page, tile.x + 20, tile.y + 20);
  const ghost = page.locator(".bub.ghost");
  await expect(ghost).toHaveClass(/\bin\b/);
  const timing = () =>
    ghost.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration.split(",")[0]?.trim(), s.transitionTimingFunction.split(")")[0] + ")"];
    });
  const enter = await timing();
  await page.keyboard.press("Escape");
  await expect(ghost).not.toHaveClass(/\bin\b/);
  const exit = await timing();
  expect(enter[0]).toBe("0.26s");
  expect(exit[0]).toBe("0.2s");
  expect(exit[1]).toBe("cubic-bezier(0.4, 0, 1, 1)");
  expect(enter[1]).not.toBe(exit[1]);
});
