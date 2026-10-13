import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";
// @ts-expect-error: the maintainer's tooling is plain JavaScript
import { newKey, signList } from "../../../../tools/updates.mjs";

const LIST = "https://pipeup-ai.github.io/pipeup/updates.json";
const info = (page: Page) =>
  page.evaluate(() =>
    (window as any).Pipeup.addons().map((a: any) => `${a.id}:${a.state}:${a.reason ?? ""}`),
  );

const serve = async (page: Page, requests: { referer?: string; credentials?: string }[]) => {
  const { privateKey } = newKey();
  const list = signList(
    {
      v: 1,
      at: "2026-10-12T00:00:00Z",
      expires: "2099-01-01T00:00:00Z",
      latest: "9.0.0",
      minimum: "0.5.0",
      versions: {},
      advisories: [],
    },
    privateKey,
    "k1",
  );
  await page.route(LIST, async (route) => {
    requests.push({ referer: route.request().headers().referer });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(list),
    });
  });
};

test("on the author's own computer it asks for the update list, with no referrer, and shows nothing it can't verify", async ({
  page,
}) => {
  const requests: { referer?: string }[] = [];
  await serve(page, requests);
  const said: string[] = [];
  page.on("console", (m) => said.push(`${m.type()}: ${m.text()}`));
  await blank(page);
  await load(page, CORE, addon("updates"));
  await mount(page);
  expect(await info(page)).toEqual(["updates:on:"]);
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]!.referer).toBeUndefined();
  // The list is signed by a key Pipeup doesn't know (this build has no keys yet), so it says nothing.
  await page.waitForTimeout(400);
  expect(said.filter((t) => t.includes("Pipeup 9.0.0"))).toEqual([]);
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText(/Pipeup is out|Security update/)).toHaveCount(0);
});

test("a page that switches it off gets no request", async ({ page }) => {
  const requests: unknown[] = [];
  await serve(page, requests as never);
  await blank(page);
  await load(page, CORE);
  await page.evaluate(() => document.documentElement.setAttribute("data-pipeup-updates", "off"));
  await load(page, addon("updates"));
  await mount(page);
  expect((await info(page))[0]).toMatch(/^updates:off:the page switched it off/);
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
});
