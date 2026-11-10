import { expect, test, type Page } from "@playwright/test";
import { open, seedElement, showComments } from "./helpers";

/** A comment on the Team box, then a Free tier added first: the page a redesign leaves behind. */
async function freeTierAdded(page: Page): Promise<void> {
  await open(page, "pricing.html");
  await seedElement(page, ".tier:nth-of-type(2)", "Show the yearly price too?");
  await page.evaluate(() => {
    const free = document.createElement("div");
    free.className = "tier";
    free.innerHTML = "<b>Free</b> <span>$0</span>";
    document.querySelector(".tiers")!.prepend(free);
  });
  await showComments(page);
  // The thread opens, and with it the question.
  await page.locator(".th").first().click();
}

/** The thread's place as everyone now has it: the latest anchor's words. */
const placeWords = (page: Page) =>
  page.evaluate(() => (window as any).pu.document.threads()[0].anchor.snapshot as string);

test("a comment follows the thing it was on when something is added before it, and asks once", async ({
  page,
}) => {
  await freeTierAdded(page);
  const card = page.locator(".th").first();
  await expect(card).toContainText("Is this the right place?");
  // On the Team box, not on Starter, which now sits where Team was.
  const where = await page.evaluate(() => (window as any).pu.comments().threads[0].where as string);
  expect(where).toContain("Team $20 a month");
  await card.getByRole("button", { name: "Yes" }).click();
  await expect(card).not.toContainText("Is this the right place?");
  await expect(card).toContainText("confirmed the place");
  expect(await placeWords(page)).toContain("Team");
});

test("Not here lets the reader click the right place, for everyone", async ({ page }) => {
  await freeTierAdded(page);
  const card = page.locator(".th").first();
  await card.getByRole("button", { name: "Not here" }).click();
  await expect(page.locator(".toast")).toContainText("Click where this comment belongs");
  await page.locator(".tier", { hasText: "Business" }).click();
  await expect(page.locator(".th").first()).toContainText("moved this comment");
  expect(await placeWords(page)).toContain("Business");
});

test("It's gone makes the comment Lost on purpose, and it says what it was and can be shown its place", async ({
  page,
}) => {
  await freeTierAdded(page);
  await page.locator(".th").first().getByRole("button", { name: "It's gone" }).click();
  const lost = page.locator(".th.lost");
  await expect(lost).toContainText("No longer on the page · it was a box under Lumen › Pricing");
  await expect(lost).toContainText("marked the place as gone");
  await expect(lost.getByRole("button", { name: "Show where it belongs" })).toBeVisible();
});

test("Copy for AI says a look-alike place isn't confirmed yet, and what it was", async ({ page }) => {
  await freeTierAdded(page);
  await expect(page.locator(".th").first()).toContainText("Is this the right place?");
  const where = await page.evaluate(() => (window as any).pu.comments({ all: true }).threads[0]);
  expect(JSON.stringify(where)).toContain("Moved, not yet confirmed (it was a box under Lumen › Pricing");
});
