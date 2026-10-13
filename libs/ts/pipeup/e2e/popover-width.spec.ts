import { expect, test } from "@playwright/test";
import { open, seedElement, showComments } from "./helpers";

test("a comment popover is roomier when the window has the space, and stays narrow on a small one", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedElement(page, "#title", "Headline");
  await showComments(page);
  await page.locator(".bub").first().click();
  const pop = page.locator(".pop.show");
  await expect(pop).toHaveCount(1);
  expect((await pop.boundingBox())!.width).toBeGreaterThan(380);
  await page.setViewportSize({ width: 800, height: 800 });
  await expect.poll(async () => Math.round((await pop.boundingBox())!.width)).toBeLessThan(320);
});

test("an open thread's popover shows who and when without hovering, and the block's naming bar steps aside", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedElement(page, "#title", "Cool");
  await showComments(page);
  await page.locator(".bub").first().click();
  const pop = page.locator(".pop.show");
  await expect(pop).toHaveCount(1);
  await page.waitForTimeout(600); // eased in
  const height = (await pop.boundingBox())!.height;
  await expect(pop.locator(".ft .who")).toBeVisible();
  await expect(pop.getByRole("button", { name: "Resolve" })).toBeVisible();
  await pop.locator(".tx").hover();
  await page.waitForTimeout(500);
  expect(Math.abs((await pop.boundingBox())!.height - height)).toBeLessThan(1);
  await expect(page.locator(".namebar.show")).toHaveCount(0);
});
