import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

const start = async (page: Page, attrs: Record<string, string>) => {
  await blank(page);
  await page.evaluate((a) => {
    for (const [k, v] of Object.entries(a)) document.documentElement.setAttribute(k, v);
  }, attrs);
  await load(page, CORE, addon("github"));
  await mount(page);
};
const say = (page: Page, text: string, ref: string) =>
  page.evaluate(
    ([text, ref]) => {
      const w = window as any;
      const at = text.indexOf("@");
      return w.pu.document.comment(
        w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
        text,
        [{ start: at, end: text.length, ref }],
      );
    },
    [text, ref] as const,
  );
const info = (page: Page) =>
  page.evaluate(() =>
    (window as any).Pipeup.addons().map((a: any) => `${a.id}:${a.state}:${a.reason ?? ""}`),
  );

test("a page that names no repository leaves the add-on off, with the reason", async ({ page }) => {
  await start(page, {});
  expect((await info(page))[0]).toMatch(/^github:off:the page names no repository/);
});

test("mentioning someone who is on GitHub offers, in the menu, a new issue with their @name and the words", async ({
  page,
}) => {
  await start(page, {
    "data-pipeup-github-repo": "pipeup-ai/pipeup",
    "data-pipeup-github-people": "octocat hubot",
  });
  expect(await info(page)).toEqual(["github:on:"]);
  // The page's listed GitHub people can be mentioned.
  const offered = await page.evaluate(() => (window as any).Pipeup && true);
  expect(offered).toBe(true);
  await page.evaluate(() => ((window as any).__opened = []));
  await page.evaluate(() => {
    window.open = ((u: string) => ((window as any).__opened.push(u), null)) as any;
  });
  await say(page, "Please check @octocat", "gh:octocat");
  await openMenu(page);
  const row = page.locator(".menu.show").getByText("Mention @octocat on GitHub");
  await expect(row).toBeVisible();
  await row.click();
  const [url] = await page.evaluate(() => (window as any).__opened);
  expect(url).toMatch(/^https:\/\/github\.com\/pipeup-ai\/pipeup\/issues\/new\?title=/);
  const body = decodeURIComponent(url.split("&body=")[1]);
  expect(body).toContain("@octocat");
  expect(body).toContain("> Please check @octocat");
  // Done: the row is gone.
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText("Mention @octocat on GitHub")).toHaveCount(0);
});

test("mentioning someone with no GitHub name offers nothing", async ({ page }) => {
  await start(page, { "data-pipeup-github-repo": "pipeup-ai/pipeup" });
  await say(page, "Hi @someone", "host:someone");
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText(/on GitHub/)).toHaveCount(0);
});
