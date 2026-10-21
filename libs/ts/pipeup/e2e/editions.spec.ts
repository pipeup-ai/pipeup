import { expect, test, type Page } from "@playwright/test";
import {
  control,
  leaveReply,
  open,
  openAll,
  savedViews,
  seedElement,
  seedView,
  selectWords,
  showComments,
} from "./helpers";

const count = (page: Page) => page.locator(".launch .mode .cnt .n.on");
const edition = (page: Page, e: string | null) =>
  page.evaluate((e) => {
    if (e === null) document.documentElement.removeAttribute("data-pipeup-edition");
    else document.documentElement.setAttribute("data-pipeup-edition", e);
  }, e);
const card = (page: Page, text: string) => page.locator(".th", { hasText: text });

test("comments stay with the edition the page names; the control counts this edition's", async ({ page }) => {
  await open(page, "doc.html");
  await seedElement(page, "#p2", "Made before editions");
  await edition(page, "2026-10-20");
  await seedView(page, "#p1", "Monday's comment", { "pipeup-edition": "2026-10-20" });
  // The comment made before the page named an edition counts as an earlier edition's.
  await expect(card(page, "Monday's comment")).toBeVisible();
  await expect(card(page, "Made before editions")).toHaveCount(0);
  await expect(count(page)).toHaveText("1");
  await expect(control(page)).not.toHaveClass(/\belse\b/);

  // Tuesday is swapped in: Monday's comment leaves the page and is never matched to Tuesday's content.
  await edition(page, "2026-10-21");
  await expect(card(page, "Monday's comment")).toHaveCount(0);
  await expect(control(page)).not.toHaveClass(/\bhas\b/);
  await expect(control(page)).not.toHaveClass(/\belse\b/);
  await seedView(page, "#p3", "Tuesday's comment", { "pipeup-edition": "2026-10-21" });
  await expect(card(page, "Tuesday's comment")).toBeVisible();
  await expect(count(page)).toHaveText("1");

  // Agents can ask for this edition's comments only.
  const here = await page.evaluate(() => (window as any).Pipeup.comments({ edition: true }));
  expect(here.threads.map((t: any) => t.comments[0].text)).toEqual(["Tuesday's comment"]);
  const all = await page.evaluate(() => (window as any).Pipeup.comments());
  expect(all.threads).toHaveLength(3);

  // All comments: this edition's first, the earlier ones folded with their count.
  await openAll(page);
  const list = page.locator(".all.show");
  await expect(list.locator(".mi")).toHaveCount(1);
  const fold = list.getByRole("button", { name: /Earlier editions · 2 open/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(list.locator(".mi")).toHaveCount(3);
  await expect(list).toContainText("In the 2026-10-20 edition");
  await expect(list).toContainText("From before editions");
  await expect(list).not.toContainText("Moved");
  await expect(list).not.toContainText("No longer on the page");

  // Back to Monday: its comment is found again, on its own content.
  await list.getByRole("button", { name: "Close" }).click();
  await edition(page, "2026-10-20");
  await expect(card(page, "Monday's comment")).toBeVisible();
  await expect(card(page, "Monday's comment")).not.toContainText("Moved");
  await expect(card(page, "Tuesday's comment")).toHaveCount(0);

  // A page that stops naming editions shows everything as before.
  await edition(page, null);
  await expect(count(page)).toHaveText("3");
});

test("a new comment saves the edition showing; a page can't report that key itself", async ({ page }) => {
  await open(page, "doc.html");
  await page.evaluate(() => (window as any).Pipeup.setViewState({ "pipeup-edition": "forged", tab: "a" }));
  await edition(page, "2026-10-21");
  await showComments(page);
  await selectWords(page, "#p1", "pricing changes");
  await page.locator(".selbar.show button").click();
  await page.locator(".draft").getByRole("textbox", { name: "Comment" }).fill("Saved with its edition");
  await page.keyboard.press("Enter");
  await leaveReply(page);
  await expect
    .poll(() => savedViews(page))
    .toEqual({ "Saved with its edition": { tab: "a", "pipeup-edition": "2026-10-21" } });
});
