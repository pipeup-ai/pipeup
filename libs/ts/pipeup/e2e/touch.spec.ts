import { devices, expect, test } from "@playwright/test";
import { fixture, openMenu, seedElement, seedText, settled } from "./helpers";

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

test("on a phone, a tap turns comment mode on, and pressing and holding opens the menu", async ({ page }) => {
  await start(page);
  await page.locator(".launch .mode").tap();
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
  await openMenu(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("on a phone, the controls are big enough to hit: 40 px for the button, 44 px for the menu's rows", async ({
  page,
}) => {
  await start(page);
  const control = (await page.locator(".launch .mode").boundingBox())!;
  expect(Math.min(control.width, control.height)).toBeGreaterThanOrEqual(40);
  await openMenu(page);
  const rows = await page
    .locator(".menu.show .mi")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);
});

test("on a phone, a tap on a block opens the comment box on it, and sending makes a comment you can tap to read", async ({
  page,
}) => {
  await start(page);
  await openMenu(page);
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
  await openMenu(page);
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await tapHighlight(page);
  await page.locator("button[aria-label=React]").first().tap();
  await page.locator(".rxo", { hasText: "🎉" }).first().tap();
  await expect(page.locator(".rx").first()).toContainText("🎉");
});

test("on a phone, All comments takes the whole width and its threads open in place", async ({ page }) => {
  await start(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).tap();
  const panel = (await page.locator(".all.show").boundingBox())!;
  expect(panel.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
  // The two filters fit on one line across the phone.
  const hd = page.locator(".all.show .hd");
  expect(await hd.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect((await hd.boundingBox())!.height).toBeLessThan(56);
  // With no hover, a closed card shows no actions (nothing to press by accident); opened, it has them.
  await expect(page.locator(".all.show .cd .acts")).toBeHidden();
  await page.locator(".all.show .mi").first().tap();
  await expect(page.locator(".all.show")).toContainText("Is this the plan?");
  await expect(
    page.locator(".all.show .cd.open").getByRole("button", { name: "Resolve", exact: true }),
  ).toBeVisible();
});

test("on a phone, a thread's buttons and the reaction row are finger-sized", async ({ page }) => {
  await start(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await openMenu(page);
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

test("on a phone, a comment opened from its bubble sits below or above what it's about, never over it", async ({
  page,
}) => {
  await start(page);
  await seedElement(page, "#p2", "Is this the plan?");
  await page.locator(".bub").first().tap();
  const pop = page.locator(".pop.show");
  await expect(pop).toContainText("Is this the plan?");
  await settled(pop);
  const p = (await pop.boundingBox())!;
  const el = (await page.locator("#p2").boundingBox())!;
  expect(p.y >= el.y + el.height || p.y + p.height <= el.y).toBe(true);
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
