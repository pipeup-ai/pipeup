import { expect, test } from "@playwright/test";
import { commenting, open, seedElement, showComments, toggleCommenting } from "./helpers";

// The newcomer's third pass (spec §5, §7; design: docs/design/states-pass.md): the states after the first comment.

test("in comment mode, a block with a comment previews on hover and opens to read on click, and its reply line rests", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedElement(page, "#p1", "Is May still realistic?");
  const p1 = (await page.locator("#p1").boundingBox())!;
  await page.mouse.move(p1.x + 30, p1.y + 10);
  await page.mouse.move(p1.x + 40, p1.y + 12);
  // The preview, as over the marker, beside the outline.
  await expect(page.locator(".tip.show")).toContainText("Is May still realistic?");
  await expect(page.locator(".pick.show")).toHaveCount(1);
  // A click opens the thread, not a second box, and nothing is focused in it: only the reader's own words are there.
  await page.mouse.click(p1.x + 40, p1.y + 12);
  await expect(page.locator(".pop.show .thread")).toContainText("Is May still realistic?");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await expect(page.locator(".pop.show .rbox textarea")).not.toBeFocused();
  // A click on the reply line brings the form.
  await page.locator(".pop.show .rbox textarea").click();
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
});

test("outside comment mode, a block with a comment is left to the page; its marker still opens it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedElement(page, "#p1", "Is May still realistic?");
  await toggleCommenting(page);
  await commenting(page, false);
  const p1 = (await page.locator("#p1").boundingBox())!;
  await page.mouse.move(p1.x + 30, p1.y + 10);
  await page.mouse.move(p1.x + 40, p1.y + 12);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  await page.mouse.click(p1.x + 40, p1.y + 12);
  await expect(page.locator(".pop.show .thread")).toHaveCount(0);
  await page.locator("[data-thread]").first().click();
  await expect(page.locator(".pop.show .thread")).toContainText("Is May still realistic?");
});

test("an Undo offer goes as soon as the next comment is sent", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  const p1 = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(p1.x + 30, p1.y + 10);
  await page.keyboard.type("Half a thought");
  await page.keyboard.press("Escape");
  await expect(page.locator(".toast.show")).toContainText("Comment discarded");
  const p2 = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(p2.x + 30, p2.y + p2.height / 2);
  // Starting another box keeps the offer.
  await expect(page.locator(".toast.show")).toContainText("Comment discarded");
  await page.keyboard.type("Say which prices");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await expect(page.locator(".toast.show", { hasText: "Comment discarded" })).toHaveCount(0);
});
