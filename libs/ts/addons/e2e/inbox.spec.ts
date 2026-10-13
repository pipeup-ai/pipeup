import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";
// The reference mailbox server, with its inbox (contract pm2), run for the test.
// @ts-expect-error: plain JavaScript
import { createMailboxServer } from "../../../../services/mailbox/src/server.mjs";

let server: { listen(port: number, host: string): Promise<{ port: number }>; close(): Promise<void> };
let base = "";
test.beforeAll(async () => {
  server = createMailboxServer({ memory: true, inboxWork: 6, rate: { post: 600, get: 6000 } });
  base = `http://127.0.0.1:${(await server.listen(0, "127.0.0.1")).port}`;
});
test.afterAll(() => server.close());

const person = async (browser: import("@playwright/test").Browser, attrs: Record<string, string> = {}) => {
  const page = await (await browser.newContext()).newPage();
  await blank(page);
  await page.evaluate(
    ([base, a]) => {
      document.documentElement.setAttribute("data-pipeup-inbox", base as string);
      document.documentElement.setAttribute("data-pipeup-inbox-poll", "1");
      for (const [k, v] of Object.entries(a as Record<string, string>))
        document.documentElement.setAttribute(k, v);
    },
    [base, attrs] as const,
  );
  await load(page, CORE, addon("inbox"));
  await mount(page);
  return page;
};
const me = (page: Page) => page.evaluate(() => (window as any).pu.document.me as string);
const toggle = async (page: Page) => {
  await openMenu(page);
  await page.locator(".menu.show").getByText("Mentions by inbox").click();
  await page.keyboard.press("Escape");
};

test("a page that names no inbox service leaves the add-on off, with the reason", async ({ page }) => {
  await blank(page);
  await load(page, CORE, addon("inbox"));
  await mount(page);
  const [a] = await page.evaluate(() =>
    (window as any).Pipeup.addons().map((x: any) => `${x.id}:${x.state}:${x.reason ?? ""}`),
  );
  expect(a).toMatch(/^inbox:off:the page names no inbox service/);
});

test("a mention leaves a sealed note; the person finds it, reads who and what, and dismisses it", async ({
  browser,
}) => {
  const sam = await person(browser);
  const ada = await person(browser);
  // Sam says something, so Ada can mention Sam (Ada's page learns Sam's comments); Sam switches the inbox on.
  const root = await sam.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Is this the plan?",
    );
  });
  await toggle(sam);
  const samKey = await me(sam);
  await expect
    .poll(async () => {
      const inbox = await sam.evaluate(async (k) => {
        // The address is worked out from the key, as a sender would.
        const b64 = (s: string) =>
          Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        const d = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new Uint8Array([...new TextEncoder().encode("pipeup-inbox/1"), ...b64(k)]),
          ),
        );
        const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        let bits = 0,
          acc = 0,
          out = "";
        for (const byte of d) {
          acc = (acc << 8) | byte;
          bits += 8;
          while (bits >= 5 && out.length < 26) {
            out += A[(acc >>> (bits - 5)) & 31];
            bits -= 5;
          }
        }
        return out;
      }, samKey);
      return (await fetch(`${base}/i/${inbox}/key`)).status;
    })
    .toBe(200);

  const ops = await sam.evaluate(() => (window as any).pu.document.ops());
  await ada.evaluate((o) => (window as any).pu.document.merge(o, "test"), ops);
  await toggle(ada);
  await ada.evaluate(
    ([root, key]) =>
      (window as any).pu.document.reply(root, "Hi @Sam, over to you", [{ start: 3, end: 7, ref: key }]),
    [root, samKey] as const,
  );

  // Sam's page checks its inbox every second in this test: a row appears with the count.
  await openMenu(sam);
  await expect(sam.locator(".menu.show").getByText("Mentions waiting")).toBeVisible({ timeout: 15000 });
  await sam.locator(".menu.show").getByText("Mentions waiting").click();
  const panel = sam.locator(".xp.show");
  await expect(panel).toContainText("mentioned you");
  await expect(panel).toContainText("Hi @Sam, over to you");
  await expect(panel).toContainText("Add-on fixture");
  await expect(panel).toContainText("Someone mentioned you");
  await panel.getByRole("button", { name: "Dismiss" }).click();
  await expect(panel).toContainText("Nothing waiting");
});

test("what is sent to the service is ciphertext, with no cookies and no referrer", async ({ browser }) => {
  const sam = await person(browser);
  const ada = await person(browser);
  const root = await sam.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Hello",
    );
  });
  await toggle(sam);
  await ada.evaluate(
    (o) => (window as any).pu.document.merge(o, "test"),
    await sam.evaluate(() => (window as any).pu.document.ops()),
  );
  const sent: { method: string; body: string | null; referer?: string; cookie?: string }[] = [];
  await ada.route(`${base}/**`, async (route) => {
    const r = route.request();
    sent.push({
      method: r.method(),
      body: r.postData(),
      referer: r.headers().referer,
      cookie: r.headers().cookie,
    });
    await route.continue();
  });
  await toggle(ada);
  const key = await me(sam);
  // Wait for Sam's key to be on the service, then Ada mentions Sam.
  await expect.poll(async () => sent.some((s) => s.method === "PUT")).toBe(true);
  await ada.evaluate(
    ([key, root]) =>
      (window as any).pu.document.reply(root, "Secret words @Sam", [{ start: 13, end: 17, ref: key }]),
    [key, root] as const,
  );
  await expect.poll(() => sent.some((s) => s.method === "POST")).toBe(true);
  const posted = sent
    .filter((s) => s.method === "POST")
    .map((s) => s.body ?? "")
    .join("\n");
  expect(posted).toMatch(/"ct":"pi1\./);
  expect(posted).not.toContain("Secret words");
  expect(posted).not.toContain(key);
  expect(sent.every((s) => !s.referer && !s.cookie)).toBe(true);
});
