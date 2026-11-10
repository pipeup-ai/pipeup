import { expect, test } from "@playwright/test";
import { leaveReply, open, quoteSpot, seedText, showComments } from "./helpers";

test("in comment mode, a thread open to read offers no other block, and a click on the page only closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator(".pop.show", { hasText: "Is 20% realistic?" })).toBeVisible();
  // Hovering another paragraph outlines nothing.
  const p2 = (await page.locator("#p2").boundingBox())!;
  await page.mouse.move(p2.x + 30, p2.y + p2.height / 2);
  await page.mouse.move(p2.x + 40, p2.y + p2.height / 2);
  await expect(page.locator(".pick.show")).toHaveCount(0);
  // A click there closes the thread and opens no comment box.
  await page.mouse.click(p2.x + 40, p2.y + p2.height / 2);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  // Now blocks are offered again: hover outlines, and a click opens a box.
  await page.mouse.move(p2.x + 50, p2.y + p2.height / 2);
  await expect(page.locator(".pick.show")).toHaveCount(1);
  await page.mouse.click(p2.x + 50, p2.y + p2.height / 2);
  await expect(page.locator(".pop.show .draft textarea")).toBeFocused();
});

test("in comment mode, a thread just written shows, and the next click goes on to the next block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  const p1 = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(p1.x + 30, p1.y + p1.height / 2);
  await page.keyboard.type("First");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show", { hasText: "First" })).toBeVisible();
  // Sending leaves the cursor in the new thread's reply line; out of it, the next click goes on.
  await leaveReply(page);
  const h1 = (await page.locator("h1").boundingBox())!;
  await page.mouse.click(h1.x + 30, h1.y + h1.height / 2);
  await expect(page.locator(".pop.show .draft textarea")).toBeFocused();
});
