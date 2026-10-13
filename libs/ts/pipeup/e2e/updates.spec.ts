import { expect, test, type Page } from "@playwright/test";
import { fixture } from "./helpers";

const mount = async (page: Page, now: string, attr?: string) => {
  const said: string[] = [];
  page.on("console", (m) => m.type() === "info" && said.push(m.text()));
  await page.clock.setFixedTime(new Date(now));
  await page.goto(fixture("doc.html"));
  if (attr) await page.evaluate((a) => document.documentElement.setAttribute("data-pipeup-updates", a), attr);
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
  return said;
};

test("a Pipeup over a year old says so once in the console, with nothing sent anywhere", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => !r.url().startsWith("file:") && requests.push(r.url()));
  const said = await mount(page, "2030-01-01T00:00:00Z");
  await expect.poll(() => said.filter((t) => t.includes("newer versions exist")).length).toBe(1);
  expect(said[0]).toMatch(/Pipeup \d+\.\d+\.\d+.*from \d{4}-\d{2}-\d{2}/);
  expect(requests).toEqual([]);
});

test("a recent Pipeup says nothing, and the author can silence the line", async ({ page }) => {
  const recent = await mount(page, "2026-10-13T00:00:00Z");
  await page.waitForTimeout(300);
  expect(recent.filter((t) => t.includes("newer versions exist"))).toEqual([]);
  const quiet = await mount(page, "2030-01-01T00:00:00Z", "off");
  await page.waitForTimeout(300);
  expect(quiet.filter((t) => t.includes("newer versions exist"))).toEqual([]);
});
