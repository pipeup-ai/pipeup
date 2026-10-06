import { expect, test } from "@playwright/test";
import { SHORTCUT } from "../src/ui/shortcut";

const example = new URL("../examples/review-document.html", import.meta.url).href;

test("the example document mounts itself and reserves a gutter in comment mode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(example);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  // The gutter opens with the comments, in comment mode.
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--pipeup-gutter").trim(),
      ),
    )
    .toBe("320px");
  expect(errors).toEqual([]);
});

test("the example site mounts itself, and comment mode names the block under the pointer", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("../examples/review-site.html", import.meta.url).href);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await page.locator('[data-pipeup-id="feature-offline"] p').hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(".namebar")).toContainText("Paragraph · Everything you save");
  expect(errors).toEqual([]);
});

test("the example deck mounts itself, and its ignored controls still change slides in comment mode", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(new URL("../examples/review-deck.html", import.meta.url).href);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await page.locator("#next").click();
  await expect(page.locator("#count")).toHaveText("2 / 3");
  await expect(page.locator('[data-pipeup-slide="2"]')).toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test("a block's label keeps the words of separate blocks apart", async ({ page }) => {
  await page.goto(new URL("../examples/review-site.html", import.meta.url).href);
  const label = await page.evaluate(() =>
    (window as any).Pipeup.labelOf(document.querySelector('[data-pipeup-id="feature-offline"]')),
  );
  expect(label).toBe("Block · Offline first Everything you save is th…");
});
