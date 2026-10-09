import { expect, test, type Page } from "@playwright/test";
import { open, openMenu, seedElement, seedText } from "./helpers";

const panel = (page: Page) => page.locator(".all.show");
async function openAll(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toBeVisible();
}
const row = (page: Page, words: RegExp) => panel(page).getByRole("menuitem", { name: words });

test("a row is a preview; clicking it opens the thread out in the panel, with a line to its place", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openAll(page);
  await expect(panel(page).locator(".xr")).toHaveCount(0);
  await expect(page.locator(".cx.show")).toHaveCount(0);
  await row(page, /Love this line/).click();
  // The thread itself is in the panel, with its details and actions showing; nothing opens on the page.
  const thread = panel(page).locator(".xr");
  await expect(thread).toHaveCount(1);
  await expect(thread).toContainText("Love this line.");
  await expect(thread.getByRole("button", { name: "Resolve" })).toBeVisible();
  await expect(page.locator(".pop.show")).toHaveCount(0);
  // The line runs from the open row to its place on the page.
  await expect(page.locator(".cx.show")).toHaveCount(1);
  // One at a time: opening another closes the first.
  await row(page, /Match the nav/).click();
  await expect(panel(page).locator(".xr")).toHaveCount(1);
  await expect(panel(page).locator(".xr")).toContainText("Match the nav?");
  // Clicking the open row closes it again.
  await panel(page).locator(".mi.open").click();
  await expect(panel(page).locator(".xr")).toHaveCount(0);
  await expect(page.locator(".cx.show")).toHaveCount(0);
});

test("a thread can be replied to and resolved in the panel, and it stays until it is closed", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openAll(page);
  await row(page, /Love this line/).click();
  const thread = panel(page).locator(".xr");
  await thread.locator("textarea").fill("Agreed");
  await page.keyboard.press("Enter");
  await expect(thread.locator(".rps")).toContainText("Agreed");
  await thread.getByRole("button", { name: "Resolve" }).click();
  // Resolved, but still open here to be reopened; closing it lets it go (Show resolved is off).
  await expect(thread.getByRole("button", { name: "Reopen" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page).locator(".xr")).toHaveCount(0);
  await expect(panel(page).getByRole("menuitem")).toHaveCount(0);
});
