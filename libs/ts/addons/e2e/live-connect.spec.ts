import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { startRelay, type TestRelay } from "../kit/test/relay.mjs";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

// Loopback WebRTC between two pages on this machine needs real (not mDNS) host candidates.
test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

test.describe.configure({ timeout: 90_000 });

let relay: TestRelay;
test.beforeAll(async () => {
  relay = await startRelay();
});
test.afterAll(async () => {
  await relay.close();
});

// The add-ons' status is the menu's first line; the menu draws it when it opens.
async function label(page: Page): Promise<string> {
  const was = (await page.locator(".menu.show").count()) > 0;
  if (!was) await openMenu(page);
  const text = (await page.locator(".menu").first().textContent()) ?? "";
  if (!was) await page.keyboard.press("Escape");
  return text;
}

/** Opens the fixture page with Pipeup and live, as a separate reviewer (each context has its own identity). */
async function open(
  browser: Browser,
  attrs: Record<string, string> = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await blank(page);
  await page.evaluate(
    ([url, extra]) => {
      const html = document.documentElement;
      html.setAttribute("data-pipeup-live-relays", url as string);
      for (const [k, v] of Object.entries(extra as Record<string, string>)) html.setAttribute(k, v);
    },
    [relay.url, attrs] as const,
  );
  await load(page, CORE, addon("live"));
  await mount(page);
  return { ctx, page };
}

/** Chooses "Go live" in the menu and agrees in the panel. */
async function goLive(page: Page): Promise<void> {
  await openMenu(page);
  await page
    .locator(".menu.show")
    .locator(".lb", { hasText: /^Go live$/ })
    .click();
  await page.locator(".xp.show").getByRole("button", { name: "Go live" }).click();
}

async function both(browser: Browser) {
  const a = await open(browser);
  const b = await open(browser);
  await goLive(a.page);
  await goLive(b.page);
  await expect.poll(() => label(a.page), { timeout: 30_000 }).toContain("Live with 1 other");
  await expect.poll(() => label(b.page), { timeout: 30_000 }).toContain("Live with 1 other");
  return { a, b };
}

const texts = (page: Page) =>
  page.evaluate(() =>
    (window as any).pu.document
      .threads()
      .map((t: any) => [t.root.text, t.resolved, t.root.replies.map((r: any) => r.text)]),
  );

test("two reviewers meet through the relay and comments, replies and resolves cross within a second", async ({
  browser,
}) => {
  const { a, b } = await both(browser);
  const id = await a.page.evaluate(async () => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Please label the chart",
    );
  });
  await expect.poll(() => texts(b.page), { timeout: 3000 }).toEqual([["Please label the chart", false, []]]);
  await b.page.evaluate((i) => (window as any).pu.document.reply(i, "Done, thanks"), id);
  await expect
    .poll(() => texts(a.page), { timeout: 3000 })
    .toEqual([["Please label the chart", false, ["Done, thanks"]]]);
  await a.page.evaluate((i) => (window as any).pu.document.resolve(i), id);
  await expect
    .poll(() => texts(b.page), { timeout: 3000 })
    .toEqual([["Please label the chart", true, ["Done, thanks"]]]);
  // The meeting point only ever saw sealed content.
  for (const e of relay.events) expect(e.content).toMatch(/^pu1\./);
  await a.ctx.close();
  await b.ctx.close();
});

test("comments made before meeting are reconciled on connect", async ({ browser }) => {
  const a = await open(browser);
  await a.page.evaluate(async () => {
    const w = window as any;
    await w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Earlier",
    );
  });
  const b = await open(browser);
  await b.page.evaluate(async () => {
    const w = window as any;
    await w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p2]"), document.body),
      "Mine",
    );
  });
  await goLive(a.page);
  await goLive(b.page);
  await expect.poll(async () => (await texts(a.page)).length, { timeout: 30_000 }).toBe(2);
  await expect.poll(async () => (await texts(b.page)).length, { timeout: 30_000 }).toBe(2);
  await a.ctx.close();
  await b.ctx.close();
});

test("presence: a cursor in the overlay, the typing words, the People panel and Go to where they are", async ({
  browser,
}) => {
  const { a, b } = await both(browser);
  // Cursors show only while comments are showing: start commenting on both.
  for (const { page } of [a, b]) {
    await openMenu(page);
    await page.locator(".menu.show").locator(".lb", { hasText: "Start commenting" }).click();
  }
  const box = await b.page.locator("[data-pipeup-id=p2]").boundingBox();
  await b.page.mouse.move(box!.x + 40, box!.y + 10);
  await b.page.mouse.move(box!.x + 60, box!.y + 12);
  await expect(a.page.locator(".ov[data-addon=live] .live-c.on")).toHaveCount(1, { timeout: 5000 });
  await expect(a.page.locator(".ov[data-addon=live] .live-c > span")).toHaveText(/\S/);
  await expect(a.page.locator(".ov[data-addon=live]")).toHaveAttribute("aria-hidden", "true");
  // A comments; B starts a reply: A sees it in words, .
  await a.page.evaluate(async () => {
    const w = window as any;
    await w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "A question",
    );
  });
  await expect.poll(async () => (await texts(b.page)).length).toBe(1);
  await b.page.locator(".th .tx").first().click();
  await b.page.locator(".th .rbox textarea").first().focus();
  await expect.poll(() => label(a.page), { timeout: 5000 }).toMatch(/is (replying|writing a comment)…/);
  await b.page.keyboard.press("Escape");
  // The People panel.
  await a.page.keyboard.press("Escape");
  await expect(a.page.locator(".menu.show")).toHaveCount(0);
  await openMenu(a.page);
  await a.page.locator(".menu.show").locator(".lb", { hasText: "People here (1)" }).click();
  const panel = a.page.locator(".xp.show");
  await expect(panel.locator(".live-p")).toHaveCount(1);
  await expect(panel.locator(".live-p .in")).toHaveCount(1);
  await panel.getByRole("button", { name: "Go to where they are" }).click();
  await expect(a.page.locator(".xp.show")).toHaveCount(0);
  await a.ctx.close();
  await b.ctx.close();
});

test("a reviewer who is not live sends nothing and opens no sockets, until they choose to go live", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const sockets: string[] = [];
  const requests: string[] = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));
  page.on("request", (r) => requests.push(r.url()));
  await blank(page);
  await page.evaluate((url) => {
    document.documentElement.setAttribute("data-pipeup-live-relays", url);
    // The author's default must still not connect anyone who hasn't been told.
    document.documentElement.setAttribute("data-pipeup-live", "auto");
  }, relay.url);
  await load(page, CORE, addon("live"));
  await mount(page);
  await openMenu(page);
  await page.waitForTimeout(1500);
  expect(sockets).toEqual([]);
  expect(requests.filter((u) => !u.startsWith("file:"))).toEqual([]);
  expect(
    await page.evaluate(() => (window as any).Pipeup.addons().map((a: any) => `${a.id}:${a.state}`)),
  ).toEqual(["live:on"]);
  // "Not now" keeps it that way.
  await page
    .locator(".menu.show")
    .locator(".lb", { hasText: /^Go live$/ })
    .click();
  await expect(page.locator(".xp.show")).toContainText("network address");
  await page.locator(".xp.show").getByRole("button", { name: "Not now" }).click();
  await page.waitForTimeout(500);
  expect(sockets).toEqual([]);
  await openMenu(page);
  await page
    .locator(".menu.show")
    .locator(".lb", { hasText: /^Go live$/ })
    .click();
  await page.locator(".xp.show").getByRole("button", { name: "Go live" }).click();
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  expect(sockets.every((u) => u.startsWith(relay.url))).toBe(true);
  await ctx.close();
});

test("without a document identity live is off, with the reason", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await blank(page);
  await page.evaluate(() => document.documentElement.removeAttribute("data-pipeup-doc"));
  await load(page, CORE, addon("live"));
  await mount(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).Pipeup.addons().map((a: any) => [a.id, a.state, a.reason])),
    )
    .toEqual([["live", "off", "needs a document identity"]]);
  await ctx.close();
});

test("without WebRTC live is off, with the reason", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    delete (window as any).RTCPeerConnection;
  });
  const page = await ctx.newPage();
  await blank(page);
  await load(page, CORE, addon("live"));
  await mount(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).Pipeup.addons().map((a: any) => [a.id, a.state, a.reason])),
    )
    .toEqual([["live", "off", "this browser can't make direct connections"]]);
  await ctx.close();
});

test("a forged hello is dropped: the other side never counts that peer", async ({ browser }) => {
  const a = await open(browser);
  const b = await open(browser);
  // B's hello is signed wrongly (as if B claimed a key it doesn't hold).
  await b.page.evaluate(() => {
    const send = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: any) {
      if (typeof data === "string" && data.includes('"t":"hello"')) {
        const m = JSON.parse(data);
        m.sig = m.sig.split("").reverse().join("");
        data = JSON.stringify(m);
      }
      return send.call(this, data);
    } as any;
  });
  await goLive(a.page);
  await goLive(b.page);
  // They connect at the transport level, but A must never accept B.
  await expect.poll(async () => relay.events.length, { timeout: 30_000 }).toBeGreaterThan(3);
  await a.page.waitForTimeout(8000);
  expect(await label(a.page)).not.toContain("Live with");
  expect(await label(a.page)).toContain("nobody else here");
  // And nothing crosses.
  await b.page.evaluate(async () => {
    const w = window as any;
    await w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Not for A",
    );
  });
  await a.page.waitForTimeout(1500);
  expect(await texts(a.page)).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});
