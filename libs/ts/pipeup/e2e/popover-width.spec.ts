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
