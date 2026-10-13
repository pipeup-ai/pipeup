import { devices, expect, test } from "@playwright/test";
import { fixture, seedText } from "./helpers";

/** Taps the highlighted words of the first text comment, as a reader's finger would. */
const tapHighlight = async (page: import("@playwright/test").Page) => {
  const at = await page.evaluate(() => {
    const range = [...(CSS.highlights.get("pipeup-quote") as unknown as Set<Range>)][0]!;
    const r = range.getClientRects()[0]!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.tap(at.x, at.y);
};

test.use({ ...devices["Pixel 7"] });

const start = async (page: import("@playwright/test").Page) => {
  await page.goto(fixture("phone.html"));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
};

test("on a phone, a tap opens the menu and Start commenting turns comment mode on", async ({ page }) => {
  await start(page);
  await page.locator(".launch .mode").tap();
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
});

test("on a phone, the controls are big enough to hit: 40 px for the button, 44 px for the menu's rows", async ({
  page,
}) => {
  await start(page);
  const control = (await page.locator(".launch .mode").boundingBox())!;
  expect(Math.min(control.width, control.height)).toBeGreaterThanOrEqual(40);
  await page.locator(".launch .mode").tap();
  const rows = await page
    .locator(".menu.show .mi")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);
});

test("on a phone, a tap on a block opens the comment box on it, and sending makes a comment you can tap to read", async ({
  page,
}) => {
  await start(page);
  await page.locator(".launch .mode").tap();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("#p2").tap();
  const box = page.locator(".draft textarea, .pop.show textarea").first();
  await expect(box).toBeVisible();
  await box.fill("Is this the plan?");
  await box.press("Enter");
  await expect(page.locator(".bub, .th").first()).toBeVisible();
  await page.locator(".bub, .th .tx").first().tap();
  await expect(page.locator(".pop.show, .th.on").first()).toContainText("Is this the plan?");
});

test("on a phone, a comment can be reacted to with taps", async ({ page }) => {
  await start(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await page.locator(".launch .mode").tap();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await tapHighlight(page);
  await page.locator("button[aria-label=React]").first().tap();
  await page.locator(".rxo", { hasText: "🎉" }).first().tap();
  await expect(page.locator(".rx").first()).toContainText("🎉");
});

test("on a phone, All comments takes the whole width and its threads open in place", async ({ page }) => {
  await start(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await page.locator(".launch .mode").tap();
  await page.getByRole("menuitem", { name: /All comments/ }).tap();
  const panel = (await page.locator(".all.show").boundingBox())!;
  expect(panel.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
  await page.locator(".all.show .mi").first().tap();
  await expect(page.locator(".all.show")).toContainText("Is this the plan?");
});

test("on a phone, a thread's buttons and the reaction row are finger-sized", async ({ page }) => {
  await start(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await page.locator(".launch .mode").tap();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await tapHighlight(page);
  await page.locator("button[aria-label=React]").first().tap();
  const sizes = await page.locator(".pop.show .ib, .pop.show .rxo").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return Math.min(r.width, r.height);
    }),
  );
  expect(sizes.length).toBeGreaterThan(5);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(36);
});
