import { expect, test } from "@playwright/test";
import { focusInPipeup, open, seedElement, seedText, showComments } from "./helpers";

test("a reply being typed in the column survives other comments arriving", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  const line = th.locator(".rbox.always textarea");
  await line.click();
  await line.pressSequentially("Half a thou");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await page.evaluate((id) => (window as any).pu.document.reply(id, "Someone else's reply"), id);
  await expect(th.locator(".rps")).toContainText("Someone else's reply");
  await expect(line).toHaveValue("Half a thou");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA", value: "Half a thou" });
  await page.keyboard.type("ght");
  await page.keyboard.press("Enter");
  await expect(th.locator(".rps")).toContainText("Half a thought");
});

test("a reply being typed in a popover survives other comments arriving", async ({ page }) => {
  await open(page, "site.html", { name: "Sam" });
  await showComments(page);
  const id = await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await page.locator(".bub.in").click();
  const line = page.locator(".pop.show .rbox.always textarea");
  await line.click();
  await line.pressSequentially("Yes, will");
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a fake number");
  await page.evaluate((id) => (window as any).pu.document.reply(id, "Agreed"), id);
  await expect(page.locator(".pop.show .rps")).toContainText("Agreed");
  await expect(line).toHaveValue("Yes, will");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA", value: "Yes, will" });
});

test("a new comment being written survives other comments arriving", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await page.evaluate(() => {
    const w = window as any;
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("p2")!);
    w.getSelection().addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.locator(".selbar.show button").click();
  const box = page.locator(".draft").getByRole("textbox", { name: "Comment" });
  await box.pressSequentially("Draft words");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(box).toHaveValue("Draft words");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA", value: "Draft words" });
});
