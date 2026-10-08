import { expect, test, type Page } from "@playwright/test";
import { SHORTCUT } from "../src/ui/shortcut";
import { bodySnapshot, commenting, open, toggleCommenting } from "./helpers";

const mode = (page: Page) => page.locator(".launch .mode");
const on = (page: Page) => commenting(page);
const off = (page: Page) => commenting(page, false);
const cursorOf = (page: Page, selector: string) =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s)!).cursor, selector);
const tip = (page: Page) => page.locator(".launch .ttip");

test("the comment control shows only its icon at rest; hovering it eases in a tooltip and never grows it", async ({
  page,
}) => {
  await open(page, "controls.html");
  await expect(mode(page)).toHaveAttribute("aria-label", "Comment");
  await expect(mode(page).locator(".plus svg")).toHaveCount(1);
  await expect(mode(page).locator(".lbl")).toHaveCount(0);
  const rest = (await mode(page).boundingBox())!;
  expect(await tip(page).evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  expect(await tip(page).evaluate((e) => getComputedStyle(e).transitionProperty)).toContain("opacity");
  await mode(page).hover();
  await expect(tip(page)).toHaveCSS("opacity", "1");
  await expect(tip(page)).toContainText("Comment");
  await expect(tip(page)).toContainText(/⇧⌥C|Shift\+Alt\+C/);
  expect((await mode(page).boundingBox())!).toEqual(rest);
  await page.mouse.move(5, 5);
  await expect(tip(page)).toHaveCSS("opacity", "0");
});

test("the tooltip also shows on keyboard focus, and the shortcut is named for assistive tech", async ({
  page,
}) => {
  await open(page, "controls.html");
  const keys = await mode(page).getAttribute("aria-keyshortcuts");
  expect(keys).toBe("Shift+Alt+C");
  await mode(page).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(tip(page)).toHaveCSS("opacity", "1");
});

for (const combo of [`Shift+Alt+${SHORTCUT.code}`]) {
  test(`a real ${combo} keypress turns comment mode on and off`, async ({ page }) => {
    await open(page, "controls.html");
    await page.keyboard.press(combo);
    await on(page);
    await page.keyboard.press(combo);
    await off(page);
  });
}

test("plain C, Meta+Shift+C and Ctrl+Alt+C do nothing, and the shortcut does nothing in a page field", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.keyboard.press("c");
  await off(page);
  await page.keyboard.press("Shift+Meta+KeyC");
  await off(page);
  await page.keyboard.press("Control+Alt+KeyC");
  await off(page);
  await page.keyboard.press("Alt+Meta+KeyC");
  await off(page);
  await page.locator("#email").focus();
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await off(page);
});

test("Escape on the block cursor leaves comment mode, with focus on the Comment control", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await on(page);
  await expect(page.locator(".toast.show")).toContainText("Esc to finish");
  await page.keyboard.press("Escape");
  await off(page);
  await expect(mode(page)).toBeFocused();
});

test("the naming bar has an expand icon, not the word Parent, and it still selects the block around", async ({
  page,
}) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  await page.mouse.move(5, 790);
  await page.locator("#go").click();
  const bar = page.locator(".namebar");
  await expect(bar).not.toContainText("Parent");
  const up = bar.getByRole("button", { name: "Around it" });
  await expect(up).toHaveAttribute("title", "Select the block around it");
  await expect(up.locator("svg")).toHaveCount(1);
  await up.click();
  await expect(bar).toContainText("Hero");
});

test("comment mode shows a picking cursor on the page, except on ignored areas, and gives it back", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.addStyleTag({ content: "#nav-btn{cursor:help}" });
  const before = await bodySnapshot(page);
  const original = await cursorOf(page, "#card");
  const ignored = await cursorOf(page, "#nav-btn");
  expect(ignored).toBe("help");
  await toggleCommenting(page);
  await on(page);
  expect(await cursorOf(page, "#card")).toContain("url(");
  expect(await cursorOf(page, "#title")).toContain("url(");
  expect(await cursorOf(page, "#nav-btn")).toBe("help");
  expect(await cursorOf(page, "nav a")).not.toContain("url(");
  expect(await mode(page).evaluate((e) => getComputedStyle(e).cursor)).toBe("pointer");
  expect(await bodySnapshot(page)).toBe(before);
  await toggleCommenting(page);
  await off(page);
  expect(await cursorOf(page, "#card")).toBe(original);
  await toggleCommenting(page);
  expect(await cursorOf(page, "#card")).toContain("url(");
  await page.evaluate(() => (window as any).pu.unmount());
  expect(await cursorOf(page, "#card")).toBe(original);
  expect(await bodySnapshot(page)).toBe(before);
});

const combo = `Shift+Alt+${SHORTCUT.code}`;
const keydown = (page: Page, init: Record<string, unknown>): Promise<boolean> =>
  page.evaluate((i: Record<string, unknown>) => {
    const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...i });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  }, init);

test("holding the shortcut does not flicker comment mode", async ({ page }) => {
  await open(page, "controls.html");
  const init = { code: SHORTCUT.code, shiftKey: true, altKey: true };
  expect(await keydown(page, init)).toBe(true);
  await on(page);
  expect(await keydown(page, { ...init, repeat: true })).toBe(false);
  await on(page);
  await page.keyboard.press(combo);
  await off(page);
});

test("AltGr+C types its character: no toggle and no preventDefault", async ({ page }) => {
  await open(page, "controls.html");
  const prevented = await keydown(page, {
    code: SHORTCUT.code,
    shiftKey: true,
    altKey: true,
    modifierAltGraph: true,
  });
  expect(prevented).toBe(false);
  await off(page);
});

test("at rest the control is a round icon, centred", async ({ page }) => {
  await open(page, "controls.html");
  const b = (await mode(page).boundingBox())!;
  expect(Math.abs(b.width - b.height)).toBeLessThan(1);
  const i = (await mode(page).locator(".plus svg").boundingBox())!;
  expect(Math.abs(i.x + i.width / 2 - (b.x + b.width / 2))).toBeLessThanOrEqual(1);
});

test("with reduced motion the tooltip only fades: it never moves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html");
  expect(await tip(page).evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  await mode(page).hover();
  await expect(tip(page)).toHaveCSS("opacity", "1");
  expect(await tip(page).evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  await expect(tip(page)).toContainText(/\S/);
});

test("Pipeup's own non-button UI does not inherit the picking cursor", async ({ page }) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  const cursors = await page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    return [".layer", ".launch", ".toast", ".ttip"].map(
      (s) => getComputedStyle(root.querySelector(s)!).cursor,
    );
  });
  for (const c of cursors) expect(c).not.toContain("url(");
});
