import { expect, type Page } from "@playwright/test";

export const fixture = (name: string): string => new URL(`fixtures/${name}`, import.meta.url).href;
const dist = (rel: string): string => new URL(rel, import.meta.url).pathname;
export const CORE = dist("../../pipeup/dist/pipeup.min.js");
export const ESM_CORE = dist("../../pipeup/dist/pipeup.esm.js");
export const addon = (id: string): string => dist(`../${id}/dist/${id}.min.js`);
export const combined = (id: string): string => dist(`../${id}/dist/pipeup+${id}.min.js`);

/** Opens the fixture page with no scripts yet; the test adds them in the order it wants (`data-pipeup-auto` off). */
export async function blank(page: Page, name = "doc.html"): Promise<void> {
  await page.goto(fixture(name));
  await page.evaluate(() => document.documentElement.setAttribute("data-pipeup-auto", "off"));
}

export async function load(page: Page, ...paths: string[]): Promise<void> {
  for (const path of paths) await page.addScriptTag({ path });
}

export async function mount(page: Page, options: Record<string, unknown> = {}): Promise<void> {
  await page.evaluate(async (o) => {
    const w = window as any;
    w.pu = await w.Pipeup.mount(o);
  }, options);
}

export async function openMenu(page: Page): Promise<void> {
  // In comment mode the control opens All comments, and the menu is its footer's ⋯.
  const panelOpen = (await page.locator(".all.show").count()) > 0;
  const commenting = await page.locator(".launch .mode").evaluate((b) => b.classList.contains("on"));
  if (panelOpen || commenting) {
    if (!panelOpen) await page.locator(".launch .mode").click();
    await page.locator(".all.show .pf").getByRole("button", { name: "More" }).click();
  } else await page.locator(".launch .mode").click();
  await page.locator(".menu.show").waitFor();
}

/** Closes All comments if it is open (in comment mode, reaching the menu opens it). */
export async function closePanel(page: Page): Promise<void> {
  const panel = page.locator(".all.show");
  if (await panel.count()) await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".all.show")).toHaveCount(0);
}

/** Turns Hide comments on from the menu's switch, so comments are closed; the menu closes again. */
export async function hideComments(page: Page): Promise<void> {
  await openMenu(page);
  await page.locator(".menu.show").getByRole("menuitemcheckbox", { name: "Hide comments" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
}

/** Pretends the clipboard works and keeps what was copied in `window.__copied`. */
export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (t: string) => void (window as any).__copied.push(t) },
    });
  });
}

/** Turns comment mode on with its shortcut, once Pipeup has started, so the comments show. */
export async function showComments(page: Page): Promise<void> {
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
}
