import { expect, test, type Page } from "@playwright/test";
import {
  commenting,
  control,
  focusInPipeup,
  leaveReply,
  open,
  openAll,
  openMenu,
  seedElement,
  seedText,
  settled,
} from "./helpers";

const panel = (page: Page) => page.locator(".all.show");

test("the control is one small square tucked into the corner, flush with the window's edges, the number inside it", async ({
  page,
}) => {
  await open(page, "site.html");
  await expect(page.locator(".launch .opts, .launch .count, .launch .lbl")).toHaveCount(0);
  await expect(page.locator(".launch button")).toHaveCount(1);
  await settled(page.locator(".launch"));
  const empty = (await control(page).boundingBox())!;
  expect(empty.width).toBe(32);
  expect(Math.abs(empty.width - empty.height)).toBeLessThan(1);
  // Flush right and bottom, with no border; frosted glass behind it.
  const vp = page.viewportSize()!;
  expect(empty.x + empty.width).toBe(vp.width);
  expect(empty.y + empty.height).toBe(vp.height);
  const look = await page.locator(".launch").evaluate((e) => ({
    border: getComputedStyle(e).borderTopWidth,
    blur: getComputedStyle(e).backdropFilter,
  }));
  expect(look.border).toBe("0px");
  expect(look.blur).toContain("blur");
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

test("pointed at, the control reaches left just far enough to show its shortcut, after a short delay, and stays put", async ({
  page,
}) => {
  await open(page, "site.html");
  const tip = page.locator(".launch .ttip");
  await expect(tip).toHaveCSS("opacity", "0");
  const before = (await control(page).boundingBox())!;
  await control(page).hover();
  await expect(tip).toHaveCSS("opacity", "1");
  await expect(tip).toHaveText(/^(⇧⌥C|Shift\+Alt\+C)$/);
  await settled(page.locator(".launch .ttip"));
  // It grows to the left only, and only by the keys (their width, whatever the platform calls them).
  const tab = (await page.locator(".launch").boundingBox())!;
  expect(tab.x + tab.width).toBe(before.x + before.width);
  const words = await tip.locator("> span").evaluate((e) => e.scrollWidth);
  expect(Math.abs(tab.width - before.width - words)).toBeLessThan(1.5);
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
  expect(names.slice(1)).toEqual([
    "Copy comments",
    "As Markdown",
    "As text",
    "Theme",
    "All comments",
    "Hide comments",
    "Start commenting",
  ]);
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
  await openAll(page);
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
  // No title: the panel is named for screen readers, and its header holds only the toggles and Close.
  await expect(panel(page)).toHaveAttribute("aria-label", "All comments");
  await expect(panel(page).locator(".cd")).toHaveCount(2);
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
  await openAll(page);
  await expect(panel(page)).toHaveCount(1);
  expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("transform");
  await settled(all);
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await open(page, "site.html");
  expect(await all.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

test("the panel closes with its close button or Esc; a click on the page leaves it open", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openAll(page);
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(control(page)).toBeFocused();
  await openAll(page);
  await expect(panel(page)).toHaveCount(1);
  await page.mouse.click(40, 700);
  await page.waitForTimeout(400);
  await expect(panel(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});

test("in the column, the panel takes the column's place: a chosen thread opens out in the panel", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
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
  await openAll(page);
  const av = panel(page).locator(".cd .av").first();
  await settled(av);
  // Measured until it settles: under load the panel's own entry can still be easing when the first look is taken.
  await expect
    .poll(async () => {
      const a = (await av.boundingBox())!;
      return Math.abs(a.width - a.height) <= 1 && a.width >= 22 && a.width <= 24;
    })
    .toBe(true);
});

test("with reduced motion, opening and closing the panel only fades it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "site.html");
  const all = page.locator(".all");
  expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("opacity");
  await openAll(page);
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
  await openAll(page);
  await expect(panel(page)).toHaveCount(1);
  const t = await page.locator(".col").evaluate((e) => {
    const s = getComputedStyle(e);
    return { d: s.transitionDuration, f: s.transitionTimingFunction };
  });
  expect(t.d).toBe("0.2s");
  expect(t.f).toBe("cubic-bezier(0.4, 0, 1, 1)");
});

test("a click on empty page leaves the panel open", async ({ page }) => {
  await open(page, "site.html");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openAll(page);
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Love this line.");
  await page.mouse.click(40, 700);
  await page.waitForTimeout(400);
  await expect(panel(page)).toHaveCount(1);
});

test("a click on a page field leaves the panel open and puts focus in the field", async ({ page }) => {
  await open(page, "controls.html");
  await openAll(page);
  await expect(panel(page)).toHaveCount(1);
  await page.locator("#email").click();
  await expect(page.locator("#email")).toBeFocused();
  await expect(panel(page)).toHaveCount(1);
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
  for (const other of [/Copy comments/, /add your name/]) expect(await d(other)).not.toBe(all);
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
  // The plus, and the count's bubble in its round and wide forms.
  expect(widths).toHaveLength(3);
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

test("in comment mode the control opens All comments, whose footer has the switch and ⋯ for the menu", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(control(page)).toHaveAttribute("aria-haspopup", "menu");
  await page.keyboard.press("Shift+Alt+KeyC");
  await commenting(page);
  await expect(control(page)).toHaveAttribute("aria-haspopup", "dialog");
  await control(page).click();
  const panel = page.locator(".all.show");
  await expect(panel).toHaveCount(1);
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(panel).toContainText("Is 20% realistic?");
  // The footer: comment mode's switch, on, and ⋯ for the rest of the menu.
  await expect(panel.getByRole("switch", { name: /Comment/ })).toHaveAttribute("aria-checked", "true");
  await panel.locator(".pf").getByRole("button", { name: "More" }).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
});

test("holding Space never brings out the shortcut, even with focus left on the control", async ({ page }) => {
  await open(page, "controls.html");
  // Comment mode turned on from the menu, the menu closed with Escape: focus is back on the control, shown as
  // keyboard focus, and the pointer is away on the page.
  await control(page).click();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await commenting(page);
  await page.keyboard.press("Escape");
  await expect(control(page)).toBeFocused();
  await page.mouse.move(200, 200);
  const tip = page.locator(".launch .ttip");
  await page.waitForTimeout(700);
  await expect(tip).toHaveCSS("opacity", "0");
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await expect(tip).toHaveCSS("opacity", "0");
  await page.keyboard.up("Space");
  await page.waitForTimeout(500);
  await expect(tip).toHaveCSS("opacity", "0");
});
