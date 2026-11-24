import { expect, test } from "@playwright/test";
import { open, quoteSpot, seedText, showComments } from "./helpers";

test("in comment mode, blocks stay offered while a thread is open to read, and one click closes it and opens a box", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator(".pop.show", { hasText: "Is 20% realistic?" })).toBeVisible();
  // Hovering another paragraph still outlines it.
  const p2 = (await page.locator("#p2").boundingBox())!;
  await page.mouse.move(p2.x + 30, p2.y + p2.height / 2);
  await page.mouse.move(p2.x + 40, p2.y + p2.height / 2);
  await expect(page.locator(".pick.show")).toHaveCount(1);
  // One click there closes the thread and opens the comment box on it.
  await page.mouse.click(p2.x + 40, p2.y + p2.height / 2);
  await expect(page.locator(".pop.show", { hasText: "Is 20% realistic?" })).toHaveCount(0);
  await expect(page.locator(".pop.show .draft textarea")).toBeFocused();
});

test("in comment mode, a reply half-written in the open thread holds a click on another block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  await page.locator(".pop.show .rbox textarea").fill("Half a thought");
  const p2 = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(p2.x + 40, p2.y + p2.height / 2);
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
  await expect(page.locator(".pop.show .rbox textarea")).toHaveValue("Half a thought");
  await expect(page.locator(".toast.show")).toHaveText("Finish or cancel this reply first");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
});

test("in comment mode, a comment just written closes, its marker stays, and the next click goes on to the next block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  const p1 = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(p1.x + 30, p1.y + p1.height / 2);
  await page.keyboard.type("First");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator("[data-thread]").first()).toBeVisible();
  // Nothing is open, so the next click goes straight on.
  const h1 = (await page.locator("h1").boundingBox())!;
  await page.mouse.click(h1.x + 30, h1.y + h1.height / 2);
  await expect(page.locator(".pop.show .draft textarea")).toBeFocused();
});
