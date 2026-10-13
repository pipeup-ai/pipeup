import { expect, test } from "@playwright/test";
import { comment, mailbox, menu, open, poke, texts } from "./share-helpers";

test("a write token is read from the address and sent only inside POST bodies", async ({ browser }) => {
  const m = await mailbox({ writeTokens: true });
  expect(m.token).toBeTruthy();
  const context = await browser.newContext();
  const seen: { url: string; headers: Record<string, string>; body: string | null }[] = [];
  context.on(
    "request",
    (r) =>
      r.url().includes("mailbox.test") &&
      seen.push({ url: r.url(), headers: r.headers(), body: r.postData() }),
  );
  await m.route(context);
  const page = await context.newPage();
  await open(page, m.address);
  await comment(page, "With a token");
  await expect.poll(m.batches, { timeout: 10_000 }).toBe(1);
  const posts = seen.filter((r) => r.body);
  expect(posts.length).toBeGreaterThan(0);
  for (const r of posts) expect(JSON.parse(r.body!).token).toBe(m.token);
  for (const r of seen) {
    expect(r.url).not.toContain(m.token!);
    expect(JSON.stringify(r.headers)).not.toContain(m.token!);
    expect(r.headers.authorization).toBeUndefined();
  }
  // The token is never stored by the page.
  const stored = await page.evaluate(async () => JSON.stringify(Object.entries(localStorage)));
  expect(stored).not.toContain(m.token!);
  await context.close();
  await m.close();
});

test("without the token the page can read but not send, and says so", async ({ browser }) => {
  const m = await mailbox({ writeTokens: true });
  const context = await browser.newContext();
  await m.route(context);
  const page = await context.newPage();
  await open(page, m.address.replace(/\.[^.]+$/, ""));
  await comment(page, "No token");
  const mn = await menu(page);
  await expect(mn.locator("[role=menuitemcheckbox]").first()).toHaveText(
    /This page can't send to the shared copy; ask the author for the current file/,
    { timeout: 10_000 },
  );
  expect(await m.batches()).toBe(0);
  await context.close();
  await m.close();
});

test("with under 7 days left the switch's hint gives the date", async ({ browser }) => {
  const m = await mailbox({ keepDays: 3 });
  const context = await browser.newContext();
  await m.route(context);
  const page = await context.newPage();
  await open(page, m.address);
  await page.waitForTimeout(500);
  await poke(page);
  const mn = await menu(page);
  await expect(mn.locator("[role=menuitemcheckbox]").first()).toHaveAttribute(
    "aria-description",
    /The shared copy expires on \d{1,2} \w+\./,
    { timeout: 10_000 },
  );
  await context.close();
  await m.close();
});

test("at pagehide a comment still waiting is sent at once, sealed ahead of time (keepalive)", async ({
  browser,
}) => {
  const m = await mailbox();
  const context = await browser.newContext();
  await m.route(context);
  const posts: number[] = [];
  context.on("request", (r) => r.method() === "POST" && posts.push(Date.now()));
  const page = await context.newPage();
  await open(page, m.address);
  const t0 = Date.now();
  await comment(page, "Last words");
  await page.waitForTimeout(1300); // sealed ahead of time (1 s), still inside the 2 s send delay
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => posts.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  expect(posts[0]! - t0).toBeLessThan(1900);
  await expect.poll(m.batches).toBe(1);
  await context.close();
  await m.close();
});

test("two tabs of one browser: both comments arrive, each sent once", async ({ browser }) => {
  const m = await mailbox();
  const context = await browser.newContext();
  await m.route(context);
  const one = await context.newPage();
  const two = await context.newPage();
  await open(one, m.address);
  await open(two, m.address);
  await comment(one, "From tab one");
  await comment(two, "From tab two");
  await expect
    .poll(
      async () => {
        await poke(one);
        await poke(two);
        return [(await texts(one)).sort().join("|"), (await texts(two)).sort().join("|")];
      },
      { timeout: 25_000, intervals: [500] },
    )
    .toEqual(["From tab one|From tab two", "From tab one|From tab two"]);
  expect(await m.batches()).toBe(2);
  await context.close();
  await m.close();
});
