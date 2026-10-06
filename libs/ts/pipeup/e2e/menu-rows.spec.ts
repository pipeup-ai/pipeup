import { expect, test, type Page } from "@playwright/test";
import { commenting, control, focusInPipeup, open, openMenu, settled } from "./helpers";

const menu = (page: Page) => page.locator(".menu.show");

test("the menu, top down: who you are, copying, All comments, then Start commenting", async ({ page }) => {
  await open(page, "site.html");
  await openMenu(page);
  const me = await page.evaluate(() => (window as any).Pipeup.animalName((window as any).pu.document.me));
  const shape = await menu(page).evaluate((m) =>
    [...m.children].map((c) =>
      c.classList.contains("sep") ? "|" : (c.querySelector(".lb")?.textContent ?? c.className),
    ),
  );
  expect(shape).toEqual([me, "|", "Copy all", "Copy all as text", "All comments", "|", "Start commenting"]);
  // The identity row: your avatar and name, with Add name at its end.
  const id = menu(page).locator("[data-item=name]");
  await expect(id.locator(".av")).toHaveAttribute("data-animal", me);
  await expect(id).toContainText("Add name");
  await expect(menu(page).getByText("Stop commenting")).toHaveCount(0);
  await expect(menu(page).locator(".fmt, .fm")).toHaveCount(0);
  // Hiding comments and showing resolved ones are not in the menu any more.
  await expect(menu(page).getByText(/Hide comments|Show resolved/)).toHaveCount(0);
});

test("every row is one line; its explanation is a tooltip on hover and on keyboard focus", async ({
  page,
}) => {
  await open(page, "site.html");
  await openMenu(page);
  await settled(menu(page));
  const rows = menu(page).locator(".mi");
  await expect(rows).toHaveCount(5);
  for (const r of await rows.all()) {
    await expect(r.locator("small")).toHaveCount(0);
    expect((await r.boundingBox())!.height).toBeLessThanOrEqual(36);
  }
  const asText = menu(page).getByRole("menuitem", { name: "Copy all as text", exact: true });
  const tip = asText.locator(".tt");
  await expect(asText).toHaveAttribute("aria-description", "Just the words");
  await expect(tip).toHaveText("Just the words");
  await expect(menu(page).getByRole("menuitem", { name: "Copy all", exact: true })).toHaveAttribute(
    "aria-description",
    "Markdown, with where each thread is",
  );
  await expect(tip).toHaveCSS("opacity", "0");
  const before = (await asText.boundingBox())!;
  await asText.hover();
  await expect(tip).toHaveCSS("opacity", "1");
  expect(await tip.evaluate((e) => parseFloat(getComputedStyle(e).transitionDelay))).toBeGreaterThan(0);
  expect((await asText.boundingBox())!).toEqual(before);
  // The tooltip covers none of the menu's rows: it sits beside the menu.
  const t = (await tip.boundingBox())!;
  const m = (await menu(page).boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(m.x);
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCSS("opacity", "0");

  // From the keyboard, focus shows the tooltip too.
  await page.keyboard.press("Escape");
  await control(page).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Start commenting");
  await page.keyboard.press("ArrowUp");
  const all = menu(page).getByRole("menuitem", { name: /All comments/ });
  await expect(all).toBeFocused();
  await expect(all.locator(".tt")).toHaveCSS("opacity", "1");
  await expect(all).toHaveAttribute("aria-description", "Every thread, and where it is");
});

test("the bottom row is Start commenting, with a switch that follows comment mode, by click and by Space", async ({
  page,
}) => {
  await open(page, "site.html");
  await openMenu(page);
  const start = menu(page).locator(".mi").last();
  await expect(start).toHaveAttribute("role", "menuitemcheckbox");
  await expect(start.locator(".sw")).toHaveCount(1);
  await expect(start).toHaveAttribute("aria-checked", "false");
  await expect(start.locator(".lb")).toHaveText("Start commenting");
  await expect(start).toContainText(/⇧⌥C|Shift\+Alt\+C/);
  await expect(start).toHaveAttribute("aria-keyshortcuts", "Shift+Alt+C");
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveCount(1);
  // The switch eases between states with the move token.
  expect(
    await start
      .locator(".sw")
      .evaluate((e) => getComputedStyle(e, "::after").transitionDuration.split(",")[0]!.trim()),
  ).toBe("0.34s");
  await start.click();
  await commenting(page);
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Space toggles it from the keyboard, closes the menu, and gives focus back to the button.
  await page.keyboard.press("Escape");
  await control(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toBeFocused();
  await page.keyboard.press("Space");
  await commenting(page, false);
  await expect(menu(page)).toHaveCount(0);
  await expect(control(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.keyboard.press("Space");
  await commenting(page);
});

test("with reduced motion the switch cross-fades instead of sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "site.html");
  await openMenu(page);
  const sw = menu(page).locator(".mi").last().locator(".sw");
  const look = await sw.evaluate((e) => ({
    p: getComputedStyle(e, "::after").transitionProperty,
    t: getComputedStyle(e, "::after").transform,
  }));
  expect(look.p).toBe("opacity");
  expect(look.t).toBe("none");
});

test("the identity row edits your name, and then shows it with an edit mark", async ({ page }) => {
  await open(page, "doc.html");
  await openMenu(page);
  const id = menu(page).locator("[data-item=name]");
  await id.click();
  const input = page.getByRole("textbox", { name: "Your name" });
  await input.fill("Red Panda");
  await input.press("Enter");
  await expect(id.locator(".lb")).toHaveText("Red Panda");
  await expect(id).not.toContainText("Add name");
  await expect(id.locator(".av")).toHaveText("R");
  await expect(id).toBeFocused();
  await expect(id).toHaveAttribute("aria-label", "Red Panda, edit your name");
});

test.describe("on a touch screen with no hover", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  test("the Start commenting switch works by tap", async ({ page }) => {
    await open(page, "doc.html");
    await control(page).tap();
    await expect(menu(page)).toHaveCount(1);
    await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
    await commenting(page);
  });
});
