import { expect, test, type Page } from "@playwright/test";
import { commenting, open, openMenu, seedText, settled, showComments, toggleCommenting } from "./helpers";

const panel = (page: Page) => page.locator(".all.show");
async function openAll(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe.configure({ mode: "parallel" });

test("the panel's header has no title: @ and ✓ are icon toggles, bold when on, and nothing wraps", async ({
  page,
}) => {
  await open(page, "doc.html");
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate((id) => (window as any).pu.document.resolve(id), id);
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await openAll(page);
  const hd = panel(page).locator(".hd");
  await expect(hd).not.toContainText("All comments");
  // One line: the header is as tall as its buttons.
  expect((await hd.boundingBox())!.height).toBeLessThan(50);
  const resolved = hd.getByRole("button", { name: "Show resolved" });
  await expect(resolved).toHaveAttribute("aria-pressed", "false");
  const grey = await resolved.evaluate((e) => getComputedStyle(e).color);
  await expect(panel(page).locator(".cd")).toHaveCount(1);
  await resolved.click();
  await expect(resolved).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).locator(".cd")).toHaveCount(2);
  await page.mouse.move(5, 5);
  await expect.poll(() => resolved.evaluate((e) => getComputedStyle(e).color)).not.toBe(grey);
  // No border or box around it.
  expect(await resolved.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("0px");
  // Mentions of me (@) only shows once someone mentions this reviewer.
  await expect(hd.getByRole("button", { name: "Mentions of me" })).toBeHidden();
});

test("while the panel is open the round button is its footer: who you are, Comment, and ⋯ for the menu", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
  const foot = panel(page).locator(".pf");
  await expect(foot).toContainText("Sam");
  // The round button has stepped aside (out of sight and out of the keyboard's reach).
  await expect(page.locator(".launch")).toHaveAttribute("inert", "");
  await expect.poll(() => page.locator(".launch").evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  // Comment turns comment mode on, and the panel stays.
  const sw = foot.getByRole("switch", { name: /Comment/ });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(panel(page)).toBeVisible();
  // ⋯ opens the rest of the menu above the footer, without Comment and All comments (the footer has them).
  await foot.getByRole("button", { name: "More" }).click();
  const menu = page.locator(".menu.show");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy as Markdown", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitemcheckbox", { name: "Hide comments" })).toBeVisible();
  await expect(menu.getByRole("menuitemcheckbox", { name: "Start commenting" })).toBeHidden();
  await expect(menu.getByRole("menuitem", { name: /All comments/ })).toBeHidden();
  const m = (await menu.boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual((await foot.boundingBox())!.y + 1);
  await page.keyboard.press("Escape");
  // Closing the panel brings the round button back.
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".launch")).not.toHaveAttribute("inert", "");
});

test("with the panel open, a new comment is written in it, in page order, joined to its place by a line", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Too tight?");
  await openAll(page);
  await panel(page)
    .locator(".pf")
    .getByRole("switch", { name: /Comment/ })
    .click();
  await commenting(page);
  await page.mouse.move(5, 700);
  // A paragraph between the two threads: its new card sits between theirs.
  await page.locator("#p2").click();
  await expect(panel(page)).toBeVisible();
  const card = panel(page).locator(".cd.new");
  await expect(card).toHaveCount(1);
  const order = await panel(page)
    .locator(".cd")
    .evaluateAll((cards) =>
      cards.map((c) => (c.classList.contains("new") ? "new" : c.textContent!.slice(0, 40))),
    );
  expect(order[1]).toBe("new");
  const box = card.getByRole("textbox", { name: "Comment" });
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute("placeholder", "Comment or add others with @");
  await expect(page.locator(".cx.show")).toHaveCount(1);
  // Comment stays grey until there are words.
  await expect(card.locator(".send")).not.toHaveClass(/\bshow\b/);
  await page.keyboard.type("Say who the designer is");
  await expect(card.locator(".send")).toHaveClass(/\bshow\b/);
  await card.locator(".send").click();
  // Sent: it is a thread in the panel, open for a reply; the panel stays.
  await expect(panel(page).locator(".cd.new")).toHaveCount(0);
  await expect(panel(page).locator(".xr")).toContainText("Say who the designer is");
  await expect(panel(page).locator(".cd")).toHaveCount(3);
  await commenting(page);
});

test("a comment being written moves into the panel when it opens, and back when it closes, with its words", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 700);
  await page.locator("#p2").click();
  const box = page.getByRole("textbox", { name: "Comment" });
  await expect(box).toBeFocused();
  await page.keyboard.type("Half a thought");
  await openAll(page);
  await expect(panel(page).locator(".cd.new textarea")).toHaveValue("Half a thought");
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".th textarea[aria-label=Comment]")).toHaveValue("Half a thought");
});

test("a card shows who and how long ago; its actions show on hover; ⋯ edits and deletes your own comment", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await expect(th.locator(".root .who")).toHaveText("Sam");
  await expect(th.locator(".root .ago")).toHaveText("just now");
  await expect(th.locator(".root .ago")).toHaveAttribute("title", /\d/);
  const acts = th.locator(".root .acts");
  await page.mouse.move(5, 700);
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await th.hover();
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  // Edit: the words go back in a box with Cancel and Save.
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Edit" }).click();
  const edit = th.locator(".root .edit textarea");
  await expect(edit).toBeFocused();
  await expect(edit).toHaveValue("Is 20% realistic?");
  await edit.fill("Is 20% realistic for Q3?");
  await page.keyboard.press("Enter");
  await expect(th.locator(".root > .tx")).toHaveText("Is 20% realistic for Q3? (edited)");
  // Delete asks once more.
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Delete" }).click();
  await expect(th.getByRole("menuitem", { name: "Delete for everyone" })).toBeVisible();
  await th.getByRole("menuitem", { name: "Delete for everyone" }).click();
  await expect(page.locator(".toast.show")).toContainText("Deleted");
  await settled(page.locator(".toast.show"));
});
