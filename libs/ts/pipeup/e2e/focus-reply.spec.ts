import { expect, test, type Page } from "@playwright/test";
import { focusInPipeup, leaveReply, open, seedElement, seedText, selectWords, showComments } from "./helpers";

/** The words of the first quote highlight, as a point to click. */
const quotePoint = (page: Page) =>
  page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });

test("clicking a highlight puts the cursor in the popover's reply line", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const p = await quotePoint(page);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".pop.show")).toContainText("Love this line.");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
  await page.keyboard.type("Agreed");
  await expect(page.locator(".pop.show .rbox textarea")).toHaveValue("Agreed");
});

test("clicking a thread in the column puts the cursor in its reply line", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  await expect(th).toHaveClass(/\bon\b/);
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
  await page.keyboard.type("Yes");
  await expect(th.locator(".rbox textarea")).toHaveValue("Yes");
});

test("Esc after the cursor lands in the reply line closes the thread", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  await expect(th).toHaveClass(/\bon\b/);
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
  await page.keyboard.press("Escape");
  await expect(th).not.toHaveClass(/\bon\b/);
});

test("choosing from All comments focuses the reply line; arrowing through rows does not", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await page.locator(".launch .mode").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator(".all.show")).toBeVisible();
  await expect.poll(async () => (await focusInPipeup(page)).cls).toContain("mi");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".all .xr")).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mi");
  await page.keyboard.press("Enter");
  await expect(page.locator(".all .xr")).toBeVisible();
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
  // Esc closes the thread and hands focus back to the row it came from.
  await page.keyboard.press("Escape");
  await expect(page.locator(".all .xr")).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mi");
});

test("a reader typing in a page field keeps the cursor when a thread opens", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate(() => {
    const f = document.createElement("input");
    f.id = "pagefield";
    document.body.append(f);
    f.focus();
  });
  // A synthetic click opens the thread without the press that would move focus off the field.
  await page.locator(".th .tx").first().dispatchEvent("click");
  await expect(page.locator(".th.on")).toHaveCount(1);
  await expect(page.locator("#pagefield")).toBeFocused();
});

/** Starts a comment on some words of `#p2` and types `Draft words` into it; the draft box is returned. */
async function draftWithWords(page: Page) {
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  const box = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await box.pressSequentially("Draft words");
  return box;
}

const kept = async (page: Page, box: ReturnType<typeof page.locator>) => {
  await expect(box).toHaveValue("Draft words");
  await expect(page.locator(".th.on[data-thread], .pop.show [data-thread]")).toHaveCount(0);
};

test("a column click does not drop a draft with words", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const box = await draftWithWords(page);
  await page.locator(".th", { hasText: "Is 20% realistic?" }).locator(".tx").first().click();
  await kept(page, box);
});

test("a bubble click does not drop a draft with words", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedElement(page, "#p1", "On the paragraph");
  const box = await draftWithWords(page);
  await page.locator(".bub.in").dispatchEvent("click");
  await kept(page, box);
});

test("a preview click does not drop a draft with words", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const p = await quotePoint(page);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator(".tip.show")).toContainText("Love this line.");
  await selectWords(page, "h1", "Answers about");
  await page.locator(".selbar.show button").dispatchEvent("click");
  const box = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await box.fill("Draft words");
  await page.locator(".tip.show").dispatchEvent("click");
  await kept(page, box);
});

test("choosing from All comments does not drop a draft with words", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const box = await draftWithWords(page);
  await page.locator(".launch .mode").click();
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page
    .locator(".all.show")
    .getByRole("menuitem", { name: /Is 20% realistic\?/ })
    .click();
  await kept(page, box);
});

test("clicking the open thread again puts the cursor back in its reply line", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  await expect(th).toHaveClass(/\bon\b/);
  await leaveReply(page);
  await th.locator(".tx").first().dispatchEvent("click");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
});
