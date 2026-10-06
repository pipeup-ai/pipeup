import { expect, test } from "@playwright/test";
import { open, seedText, settled, showComments } from "./helpers";

test("replies sit one level under the comment, in order, with no reply to a reply", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  // Older data can hold a reply to a reply: it joins the same list, by time.
  await page.evaluate(async (id) => {
    const d = (window as any).pu.document;
    const first = await d.reply(id, "We hit 18% last time");
    await d.reply(first, "Then 20% is a stretch");
    await d.reply(id, "Say 15 to 20%");
  }, id);
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  await expect(th.locator(".rps .it .tx")).toHaveText([
    "We hit 18% last time",
    "Then 20% is a stretch",
    "Say 15 to 20%",
  ]);
  await expect(th.getByRole("button", { name: "Reply" })).toHaveCount(0);
  await expect(th.locator(".rbox.always textarea")).toHaveCount(1);
  const x = async (selector: string) => (await th.locator(selector).first().boundingBox())!.x;
  expect(await x(".rps .it")).toBeGreaterThan((await x(".root .tx")) + 10);
  expect(Math.abs((await x(".rbox.always > div")) - (await x(".rps .it")))).toBeLessThan(2);
  // The line itself starts where the replies' words do: nothing sits before it.
  expect(Math.abs((await x(".rbox.always textarea")) - (await x(".rps .it .tx")))).toBeLessThan(2);
});

test("the reply line is only a line: no reply mark, and a click anywhere on it puts the caret at the end", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  const line = th.locator(".rbox.always .row");
  await expect(line).toBeVisible();
  await settled(th.locator(".more"));
  await expect(th.locator(".ricon")).toHaveCount(0);
  await expect(line).toHaveCSS("cursor", "text");
  const input = line.locator("textarea");
  // The far right of an empty line (where the send arrow will be) still focuses the line.
  const b = (await line.boundingBox())!;
  await page.mouse.click(b.x + b.width - 3, b.y + b.height / 2);
  await expect(input).toBeFocused();
  await input.fill("Fair point");
  await input.evaluate((el: HTMLTextAreaElement) => {
    el.setSelectionRange(0, 0);
    el.blur();
  });
  // The space above the line is part of it too, and the caret goes after what is there.
  await page.mouse.click(b.x + b.width / 2, b.y + 2);
  await expect(input).toBeFocused();
  expect(await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([
    10, 10,
  ]);
  // Hovering darkens the line, eased.
  expect(await input.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("border-color");
});
