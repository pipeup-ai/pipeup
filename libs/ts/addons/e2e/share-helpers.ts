import { type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { addon, blank, CORE, load, mount } from "./helpers";
import { createPrivateBinMock } from "../share/test/privatebin-mock";
// @ts-expect-error: the reference server is plain JavaScript
import { createMailboxServer } from "../../../../services/mailbox/src/server.mjs";

export const key = () => randomBytes(32).toString("base64url");
export const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

/** A reference mailbox on an ephemeral port, and a way to route https://mailbox.test/ to it. */
export async function mailbox(options: Record<string, unknown> = {}) {
  const server = createMailboxServer({ memory: true, ...options });
  const { port } = await server.listen(0, "127.0.0.1");
  const origin = `http://127.0.0.1:${port}`;
  const headers = { "content-type": "text/plain" };
  const made = await (
    await fetch(`${origin}/m`, { method: "POST", headers, body: JSON.stringify({ v: 1 }) })
  ).json();
  const k = key();
  return {
    origin,
    id: made.mailbox as string,
    stop: made.stop as string,
    token: made.token as string | null,
    address: `https://mailbox.test/m/${made.mailbox}#pm1.${k}${made.token ? "." + made.token : ""}`,
    batches: async (): Promise<number> =>
      ((await (await fetch(`${origin}/m/${made.mailbox}/ops`)).json()) as { batches: unknown[] }).batches
        .length,
    remove: () =>
      fetch(`${origin}/m/${made.mailbox}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${made.stop}` },
      }),
    /** Answers https://mailbox.test/** from the local server, unless `down.on`. */
    route: async (context: BrowserContext, down = { on: false }) =>
      context.route("https://mailbox.test/**", async (route) => {
        if (down.on) return route.abort("internetdisconnected");
        const u = new URL(route.request().url());
        // A request still in flight when a test closes its context is not a failure.
        try {
          await route.fulfill({ response: await route.fetch({ url: origin + u.pathname + u.search }) });
        } catch {
          /* closed */
        }
      }),
    close: () => server.close(),
  };
}

/** A PrivateBin mock behind https://paste.test/ and a paste made on it. */
export async function paste() {
  const mock = createPrivateBinMock();
  const base = "https://paste.test/";
  const { createPaste } = await import("../share/src/privatebin");
  const { ladder } = await import("@pipeup/kit");
  const room = randomBytes(32);
  const k = room.toString("base64url");
  const made = await createPaste(mock.fetch, base, ladder("aaaaaaaaaaaaaaaa", new Uint8Array(room)));
  return {
    mock,
    id: made.id,
    address: `${base}?${made.id}#${k}`,
    route: async (context: BrowserContext, down = { on: false }) =>
      context.route("https://paste.test/**", async (route) => {
        if (down.on) return route.abort("internetdisconnected");
        const r = route.request();
        const out = mock.handle(r.method(), r.url(), r.headers(), r.postData() ?? "");
        await route.fulfill({ status: out.status, headers: out.headers, body: out.body }).catch(() => {});
      }),
  };
}

/** Opens the fixture with `data-pipeup-share` set (or not), the core and share loaded, and Pipeup mounted. */
export async function open(page: Page, address: string | null): Promise<void> {
  await blank(page);
  await page.evaluate((a) => a && document.documentElement.setAttribute("data-pipeup-share", a), address);
  await load(page, CORE, addon("share"));
  await mount(page);
  // Setup is asynchronous (it opens the add-on's settings): a comment made before it ends is one "written before
  // sharing", which is held until the reviewer chooses. People are never that quick; tests are, so wait.
  await page.waitForFunction(
    () => (window as any).Pipeup.addons().find((a: any) => a.id === "share")?.state !== "waiting",
  );
}

export const comment = (page: Page, text: string) =>
  page.evaluate(([a, t]) => (window as any).pu.document.comment(a, t), [ANCHOR, text] as const);

export const texts = (page: Page) =>
  page.evaluate(() => (window as any).pu.document.threads().map((t: any) => t.root.text));

/** Makes the page read the shared copy now, as it does on focus. */
export const poke = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

export const shareInfo = (page: Page) =>
  page.evaluate(() => (window as any).Pipeup.addons().find((a: any) => a.id === "share"));

export async function menu(page: Page) {
  await page.locator(".launch .mode").click();
  const m = page.locator(".menu.show");
  await m.waitFor();
  return m;
}

export interface Service {
  address: string;
  route(context: BrowserContext, down?: { on: boolean }): Promise<unknown>;
  /** How many batches the service holds. */
  count(): Promise<number>;
  /** Deletes the shared copy. */
  gone(): Promise<void>;
  close(): Promise<void> | void;
}

export async function service(kind: "mailbox" | "privatebin"): Promise<Service> {
  if (kind === "mailbox") {
    const m = await mailbox();
    return {
      address: m.address,
      route: m.route,
      count: m.batches,
      gone: async () => void (await m.remove()),
      close: m.close,
    };
  }
  const p = await paste();
  return {
    address: p.address,
    route: p.route,
    count: async () => p.mock.sent().length,
    gone: async () => void p.mock.pastes.clear(),
    close() {},
  };
}
