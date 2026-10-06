import { expect, test } from "@playwright/test";
import { open, seedElement, seedText, showComments } from "./helpers";

test("a link in a comment opens in a new tab", async ({ page }) => {
  await page
    .context()
    .route("https://example.test/**", (r) => r.fulfill({ body: "ok", contentType: "text/plain" }));
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Benchmarks: https://example.test/retention");
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  const link = th.getByRole("link", { name: "https://example.test/retention" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const [tab] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe("https://example.test/retention");
  expect(page.url()).toMatch(/doc\.html$/);
});

test("clicking a link in a hover preview opens the link only, not the thread", async ({ page }) => {
  await page
    .context()
    .route("https://example.test/**", (r) => r.fulfill({ body: "ok", contentType: "text/plain" }));
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "See https://example.test/nav");
  await page.evaluate(() => {
    (window as any).pageClicks = 0;
    window.addEventListener("click", () => (window as any).pageClicks++);
  });
  await page.locator(".bub.in").hover();
  const link = page.locator(".tip.show").getByRole("link", { name: "https://example.test/nav" });
  const [tab] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await tab.close();
  expect(await page.evaluate(() => (window as any).pageClicks)).toBe(0);
  await expect(page.locator(".pop.show")).toHaveCount(0);
});
