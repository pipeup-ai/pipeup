import { type Page } from "@playwright/test";

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
  await page.locator(".launch .mode").click();
  await page.locator(".menu.show").waitFor();
}
