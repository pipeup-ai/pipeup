import { expect, test, type Page } from "@playwright/test";
import {
  commenting,
  control,
  leaveReply,
  focusInPipeup,
  open,
  openMenu,
  seedElement,
  seedText,
  settled,
} from "./helpers";

const panel = (page: Page) => page.locator(".all.show");

test("the control is one round button: no more button, no slide-out words, the number inside it", async ({
  page,
}) => {
  await open(page, "site.html");
  await expect(page.locator(".launch .opts, .launch .count, .launch .lbl")).toHaveCount(0);
  await expect(page.locator(".launch button")).toHaveCount(1);
  await settled(page.locator(".launch"));
  const empty = (await control(page).boundingBox())!;
  expect(empty.width).toBeGreaterThanOrEqual(44);
  expect(empty.width).toBeLessThanOrEqual(46);
  expect(Math.abs(empty.width - empty.height)).toBeLessThan(1);
  await expect(control(page)).toHaveAttribute("aria-label", "Comment");
  await expect(control(page)).toHaveAttribute("aria-keyshortcuts", "Shift+Alt+C");

  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  const num = page.locator(".launch .mode .n.on");
  await expect(num).toHaveText("2");
  await settled(page.locator(".launch"));
  const two = (await control(page).boundingBox())!;
  expect(two).toEqual(empty);
  const n = (await num.boundingBox())!;
  expect(n.x).toBeGreaterThanOrEqual(two.x);
  expect(n.x + n.width).toBeLessThanOrEqual(two.x + two.width);
  expect(n.y).toBeGreaterThanOrEqual(two.y);
  expect(n.y + n.height).toBeLessThanOrEqual(two.y + two.height);
});

test("the number cross-fades when it changes, and shows 99+ above 99", async ({ page }) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "One");
  await expect(page.locator(".launch .mode .n.on")).toHaveText("1");
  // Both numbers sit in one place and ease their opacity: the old one fades as the new one comes in.
  const ns = page.locator(".launch .mode .n");
  await expect(ns).toHaveCount(2);
  for (const t of await ns.evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionProperty)))
    expect(t).toContain("opacity");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Two");
  await expect(page.locator(".launch .mode .n.on")).toHaveText("2");
  await expect(page.locator(".launch .mode .n:not(.on)")).toHaveText("1");
  await page.evaluate(async () => {
    const w = window as any;
    const el = document.querySelector("[data-pipeup-id=cta-trial]");
    for (let i = 0; i < 98; i++)
      await w.pu.document.comment(w.Pipeup.describeElement(el, document.body), `More ${i}`);
  });
  await expect(page.locator(".launch .mode .n.on")).toHaveText("99+");
});

test("hovering the button shows a tooltip with its shortcut, after a short delay, and the button stays put", async ({
  page,
}) => {
  await open(page, "site.html");
  const tip = page.locator(".launch .ttip");
  await expect(tip).toHaveCSS("opacity", "0");
  const before = (await control(page).boundingBox())!;
  await control(page).hover();
  await expect(tip).toHaveCSS("opacity", "1");
  await expect(tip).toContainText("Comment");
  await expect(tip).toContainText(/⇧⌥C|Shift\+Alt\+C/);
  expect(await tip.evaluate((e) => parseFloat(getComputedStyle(e).transitionDelay))).toBeGreaterThan(0);
  await settled(page.locator(".launch"));
  expect((await control(page).boundingBox())!).toEqual(before);
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCSS("opacity", "0");
});

test("a click opens the menu above the button; the item nearest it is Start commenting, a switch for comment mode", async ({
  page,
}) => {
  await open(page, "site.html");
  await control(page).click();
  const menu = page.locator(".menu.show");
  await expect(menu).toHaveCount(1);
  await settled(menu);
  const m = (await menu.boundingBox())!;
  const b = (await control(page).boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual(b.y);
  const names = await menu.locator(".mi .lb").allTextContents();
  expect(names.slice(1)).toEqual(["Copy as Markdown", "Copy as Text", "All comments", "Start commenting"]);
  await expect(menu.locator("[role=separator]")).toHaveCount(2);
  const last = menu.locator(".mi").last();
  await expect(last).toContainText(/⇧⌥C|Shift\+Alt\+C/);
  await expect(last).toHaveAttribute("aria-keyshortcuts", "Shift+Alt+C");
  await expect(last).toHaveAttribute("aria-checked", "false");
  await last.click();
  await commenting(page);
  // The menu stays open so the switch is seen to move.
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await expect(page.locator(".menu.show .mi").last().locator(".lb")).toHaveText("Start commenting");
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await commenting(page, false);
});

test("the menu shows the open count on All comments", async ({ page }) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: /All comments/ })).toContainText("2");
});

test.describe("on a touch screen with no hover", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  test("a tap opens the menu and Comment starts comment mode", async ({ page }) => {
    await open(page, "site.html");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "hover", value: "none" }] });
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true);
    await control(page).tap();
    await expect(page.locator(".menu.show")).toHaveCount(1);
    await page.locator(".menu.show .mi").last().tap();
    await commenting(page);
  });
});

test("All comments is a full-height panel on the right; choosing a thread reveals it and the panel stays", async ({
  page,
}) => {
  await open(page, "site.html");
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div style="height:1600px"></div><p id="far" style="margin:0 24px">Far down the page</p><div style="height:400px"></div>`,
    ),
  );
  await seedElement(page, "#far", "Is this far enough?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await settled(panel(page));
  const p = (await panel(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(p.x + p.width)).toBe(vp.width);
  expect(p.y).toBe(0);
  expect(Math.round(p.height)).toBe(vp.height);
  expect(p.width).toBeGreaterThanOrEqual(300);
  expect(p.width).toBeLessThanOrEqual(340);
  await expect(panel(page)).toContainText("All comments");
  await expect(panel(page).locator(".hd")).toContainText("2");
  await expect(panel(page).getByRole("button", { name: "Close" })).toBeVisible();
  // Focus moved in.
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Love this line.");

  await panel(page)
    .getByRole("menuitem", { name: /Is this far enough\?/ })
    .click();
  await expect(panel(page).locator(".xr")).toContainText("Is this far enough?");
  await expect(panel(page)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = document.querySelector("#far")!.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
    )
    .toBe(true);
  // Step on to the next one: the first closes and the panel is still there.
  await panel(page)
    .getByRole("menuitem", { name: /Love this line\./ })
    .click();
  await expect(panel(page).locator(".xr")).toHaveCount(1);
  await expect(panel(page).locator(".xr")).toContainText("Love this line.");
  await expect(panel(page)).toBeVisible();

  await leaveReply(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(async () => (await focusInPipeup(page)).cls).toContain("mode");
  expect(await page.locator(".all").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
});

test("the panel slides in from the right edge, and with reduced motion only fades", async ({ page }) => {
  await open(page, "site.html");
  const all = page.locator(".all");
  expect(await all.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  expect(await all.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("transform");
  await settled(all);
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await open(page, "site.html");
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

test("the panel closes with its close button, and with a click on the page", async ({ page }) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(control(page)).toBeFocused();
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  await page.mouse.click(40, 700);
  await expect(panel(page)).toHaveCount(0);
});

test("in the column, the panel takes the column's place: a chosen thread opens out in the panel", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await panel(page)
    .getByRole("menuitem", { name: /Is 20% realistic\?/ })
    .click();
  await expect(panel(page).locator(".xr")).toContainText("Is 20% realistic?");
  // The column behind the panel is out of sight and out of reach.
  await expect.poll(() => page.locator(".col").evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  expect(await page.locator(".col").evaluate((e) => (e as HTMLElement).inert)).toBe(true);
  // Closing the panel gives the column back, with nothing open there.
  await leaveReply(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".th.on")).toHaveCount(0);
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test("an avatar in a panel row keeps its square", async ({ page }) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  const av = panel(page).locator(".mi .av").first();
  await settled(av);
  const a = (await av.boundingBox())!;
  expect(Math.abs(a.width - a.height)).toBeLessThanOrEqual(1);
  expect(a.width).toBeGreaterThanOrEqual(22);
  expect(a.width).toBeLessThanOrEqual(24);
});

test("with reduced motion, opening and closing the panel only fades it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "site.html");
  const all = page.locator(".all");
  expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("opacity");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("opacity");
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  // Nothing but opacity animates on the way in.
  const props = await all.evaluate((el) =>
    el.getAnimations().map((a) => (a as CSSTransition).transitionProperty),
  );
  for (const p of props) expect(p).toBe("opacity");
});

test("the column fades out with the exit timing when the panel opens", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  const t = await page.locator(".col").evaluate((e) => {
    const s = getComputedStyle(e);
    return { d: s.transitionDuration, f: s.transitionTimingFunction };
  });
  expect(t.d).toBe("0.2s");
  expect(t.f).toBe("cubic-bezier(0.4, 0, 1, 1)");
});

test("a click on empty page closes the panel and gives focus back to the button", async ({ page }) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Love this line.");
  await page.mouse.click(40, 700);
  await expect(panel(page)).toHaveCount(0);
  await expect(control(page)).toBeFocused();
});

test("a click on a page field closes the panel and leaves focus in the field", async ({ page }) => {
  await open(page, "controls.html");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  await page.locator("#email").click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator("#email")).toBeFocused();
});

test("All comments has its own icon in the menu", async ({ page }) => {
  await open(page, "site.html");
  await openMenu(page);
  const d = (name: RegExp) =>
    page
      .getByRole("menuitem", { name })
      .locator("svg")
      .first()
      .evaluate((s) => [...s.querySelectorAll("path")].map((p) => p.getAttribute("d")).join(" "));
  const all = await d(/All comments/);
  for (const other of [/Copy as/, /add your name/]) expect(await d(other)).not.toBe(all);
  const start = await page
    .getByRole("menuitemcheckbox", { name: "Start commenting" })
    .locator("svg")
    .first()
    .evaluate((s) => [...s.querySelectorAll("path")].map((p) => p.getAttribute("d")).join(" "));
  expect(start).not.toBe(all);
});

test("the button's comment bubble is drawn with a thinner line than other icons, the count in medium weight", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  const widths = await control(page)
    .locator("svg")
    .evaluateAll((els) => els.map((e) => parseFloat(e.getAttribute("stroke-width")!)));
  expect(widths).toHaveLength(2);
  for (const w of widths) expect(w).toBeCloseTo(1.4, 1);
  await openMenu(page);
  const other = await page
    .locator(".menu.show .mi svg")
    .first()
    .evaluate((e) => parseFloat(e.getAttribute("stroke-width")!));
  expect(other).toBeGreaterThan(1.6);
  const n = page.locator(".launch .mode .n.on");
  expect(await n.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("500");
});
