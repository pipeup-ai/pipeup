import { expect, test, type Page } from "@playwright/test";
import { commenting, control, open, seedElement, showComments, toggleCommenting } from "./helpers";

// The newcomer's second pass (spec §5, §7; design: docs/design/newcomer-pass.md): comment mode's hint says two things
// the first time, and the rest once each when first useful; the comment box says "Comment" until there is someone to
// add; a new comment closes once sent.

const hint = (page: Page) => page.locator(".toast.show");

test("the first time, the hint says two things and names the button; the next time in this browser, nothing", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await toggleCommenting(page);
  await expect(hint(page)).toHaveText("Click anything to comment · This button or Esc when you're done");
  await toggleCommenting(page);
  await commenting(page, false);
  await toggleCommenting(page);
  await commenting(page);
  await page.waitForTimeout(300);
  await expect(hint(page)).toHaveCount(0);
  // Remembered by the browser, not the page.
  await open(page, "controls.html", { name: "Sam" });
  await toggleCommenting(page);
  await commenting(page);
  await page.waitForTimeout(300);
  await expect(hint(page)).toHaveCount(0);
});

test("with Pipeup's control off the page (the extension), the hint names no button", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam", control: "off" });
  await page.evaluate(() => (window as any).pu.setCommentMode(true));
  await expect(hint(page)).toHaveText("Click anything to comment · Esc when you're done");
});

test("Hold Space is said once, the first time a link, button or field is clicked in comment mode", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 790);
  await page.locator("#go").click();
  // The box opens on the button, and the hint says how to use the button instead.
  await expect(page.locator(".draft textarea")).toBeFocused();
  await expect(hint(page)).toHaveText("Hold Space to use the page");
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await page.locator("#go").click();
  await expect(page.locator(".draft textarea")).toBeFocused();
  await page.waitForTimeout(300);
  await expect(hint(page)).toHaveCount(0);
});

test("Option-click to pin is said once, the first time a thread is opened in comment mode", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  const id = await seedElement(page, "#p1", "Is this the plan?");
  await showComments(page);
  await page.evaluate((id) => (window as any).pu.openThread(id), id);
  await expect(hint(page)).toHaveText("Option-click (Alt-click) to pin");
  await page.keyboard.press("Escape");
  await page.evaluate((id) => (window as any).pu.openThread(id), id);
  await page.waitForTimeout(300);
  await expect(hint(page)).toHaveCount(0);
});

test("the box says Comment, and a reply line Reply, until there is someone to add with @", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  let id = await seedElement(page, "#p1", "Is this the plan?");
  await showComments(page);
  await page.evaluate((id) => (window as any).pu.openThread(id), id);
  await expect(page.getByRole("textbox", { name: "Reply" }).first()).toHaveAttribute("placeholder", "Reply");
  // The page lists someone (§10a): now there is someone to add.
  await open(page, "doc.html", { name: "Sam" });
  await page.evaluate(() => (window as any).Pipeup.setPeople([{ ref: "host:lee", name: "Lee" }]));
  id = await seedElement(page, "#p1", "Is this the plan?");
  await showComments(page);
  await page.evaluate((id) => (window as any).pu.openThread(id), id);
  await expect(page.getByRole("textbox", { name: "Reply" }).first()).toHaveAttribute(
    "placeholder",
    "Reply or add others with @",
  );
  await page.keyboard.press("Escape");
  await page.locator("#p2").click();
  await expect(page.getByRole("textbox", { name: "Comment" })).toHaveAttribute(
    "placeholder",
    "Comment or add others with @",
  );
});

test("a new comment closes once sent: its marker stays, nothing opens, and focus is on the Comment control", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await toggleCommenting(page);
  await commenting(page);
  await page.locator("#p2").click();
  await page.keyboard.type("Looks right");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show, .th.on")).toHaveCount(0);
  await expect(page.locator("[data-thread]").first()).toBeVisible();
  await expect(control(page)).toBeFocused();
  // The marker opens the thread, with its reply line, as any marker does.
  await page.locator("[data-thread]").first().click();
  await expect(page.getByRole("textbox", { name: "Reply" })).toBeVisible();
});
