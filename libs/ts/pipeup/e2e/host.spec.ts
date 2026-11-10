import { expect, test } from "@playwright/test";
import { fixture, open, seedText } from "./helpers";

/** Pipeup with its threads and comment box drawn by a host (the extension's side panel); what it says, kept. */
async function hosted(page: import("@playwright/test").Page): Promise<void> {
  await open(page, "doc.html", { ui: "host", control: "off" });
  await page.evaluate(() => {
    const w = window as any;
    w.heard = [];
    w.pu.on("open", (id: string | null) => w.heard.push(["open", id]));
  });
}
const heard = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).heard as unknown[]);

test("with a host, a click on a highlight tells the host and opens nothing on the page", async ({ page }) => {
  await hosted(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const at = await page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + 4, y: q.top + q.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => heard(page)).toEqual([["open", id]]);
  await expect(page.locator(".pop.show, .col .th, .all.show")).toHaveCount(0);
});

test("with a host, a new comment is written on the page with the cursor in its box, and the host is told", async ({
  page,
}) => {
  await hosted(page);
  await page.evaluate(() => (window as any).pu.setCommentMode(true));
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  const box = page.locator(".draft textarea");
  await expect(box).toBeFocused();
  await box.fill("Say which week.");
  await page.locator(".draft").getByRole("button", { name: "Comment" }).click();
  await expect.poll(() => heard(page)).toEqual([["open", expect.any(String)]]);
  // The host shows the thread: none opens on the page.
  await expect(page.locator(".pop.show .th, .col .th")).toHaveCount(0);
});

test("a host can copy the comments as text, set the look and Hide comments, and go to a thread", async ({
  page,
}) => {
  await hosted(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const got = await page.evaluate(async (thread) => {
    const pu = (window as any).pu;
    const md = pu.commentsAs("ai");
    const text = pu.commentsAs("text");
    await pu.setLook("dark");
    await pu.setHidden(true);
    const after = { look: pu.look, hidden: pu.hidden };
    await pu.setHidden(false);
    await pu.openThread(thread);
    return { md, text, after };
  }, id);
  expect(got.md).toContain("# Comments on");
  expect(got.md).toContain("Is 20% realistic?");
  expect(got.text).toContain("Is 20% realistic?");
  expect(got.after).toEqual({ look: "dark", hidden: true });
  await expect(page.locator(".layer")).toHaveClass(/dark/);
  // Going to it opens nothing on the page, and doesn't tell the host it was opened from the page.
  await expect(page.locator(".pop.show, .col .th")).toHaveCount(0);
  expect(await heard(page)).toEqual([]);
});

test("a host can open the comment box on an element or on words, and give page settings", async ({
  page,
}) => {
  await open(page, "doc.html", { settings: { "data-pipeup-github-repo": "lumen/plans", other: "x" } });
  const got = await page.evaluate(() => {
    const w = window as any;
    return [w.Pipeup.setting("data-pipeup-github-repo"), w.Pipeup.setting("other")];
  });
  expect(got).toEqual(["lumen/plans", null]);
  await page.evaluate(() => (window as any).pu.startComment(document.querySelector("#p2")));
  await expect(page.locator(".draft textarea").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const r = document.createRange();
    const t = document.querySelector("#p1")!.firstChild!;
    r.setStart(t, 0);
    r.setEnd(t, 10);
    return (window as any).pu.startComment(r);
  });
  await expect(page.locator(".draft").first()).toContainText("“");
});

test("a host can keep Pipeup's UI from the page's scripts, and keep add-ons' choices out of the site's storage", async ({
  page,
}) => {
  await page.goto(fixture("doc.html"));
  const seen = await page.evaluate(async () => {
    const w = window as any;
    const held = new Map<string, unknown>();
    let got: unknown;
    w.Pipeup.use({
      id: "keeper",
      api: 1,
      version: "1.0.0",
      needs: [],
      network: { when: "never", to: [], says: "Sends nothing." },
      async setup(host: any) {
        await host.keep.set("choice", { on: true });
        got = await host.keep.get("choice");
      },
    });
    w.pu = await w.Pipeup.mount({
      closed: true,
      keep: {
        get: async (k: string) => held.get(k),
        set: async (k: string, v: unknown) => void held.set(k, v),
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    return {
      root: !!document.querySelector("pipeup-root"),
      shadow: document.querySelector("pipeup-root")!.shadowRoot,
      held: Object.fromEntries(held),
      got,
      dbs:
        (await indexedDB.databases?.())?.map((d) => d.name).filter((n) => n?.startsWith("pipeup-addon")) ??
        [],
    };
  });
  expect(seen).toEqual({
    root: true,
    shadow: null,
    held: { "keeper:choice": { on: true } },
    got: { on: true },
    dbs: [],
  });
});

test("a host's stand-in for Pipeup's box: keys passed in work as typed ones and never reach the page @safari", async ({
  page,
}) => {
  await page.goto(fixture("doc.html"));
  await page.evaluate(async () => {
    const w = window as any;
    w.heard = [];
    for (const t of ["keydown", "keyup", "input", "focusout"])
      window.addEventListener(t, (e) => w.heard.push(`${t}:${(e as KeyboardEvent).key ?? ""}`), true);
    w.fields = [];
    w.pu = await w.Pipeup.mount({
      closed: true,
      field: (f: HTMLTextAreaElement, pass: (e: Event) => void) => {
        w.fields.push({ f, pass });
        return document.createElement("span");
      },
    });
    await w.pu.startComment(document.querySelector("#p2"));
  });
  // As the extension's frame does: the words, then Enter, as plain events carrying the key's fields.
  const sent = await page.evaluate(async () => {
    const w = window as any;
    const { f, pass } = w.fields.find((x: any) => x.f instanceof HTMLTextAreaElement);
    const key = (type: string, k: string) => {
      const e = new Event(type, { bubbles: true, cancelable: true, composed: false });
      for (const [n, v] of Object.entries({
        key: k,
        code: "",
        isComposing: false,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false,
        location: 0,
      }))
        Object.defineProperty(e, n, { value: v });
      Object.defineProperty(e, "getModifierState", { value: () => false });
      pass(e);
    };
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(f, "Typed elsewhere");
    pass(new Event("input", { bubbles: true, composed: false }));
    key("keydown", "Enter");
    key("keyup", "Enter");
    await new Promise((r) => setTimeout(r, 300));
    return w.pu.document.threads().map((t: any) => t.root.text);
  });
  expect(sent).toEqual(["Typed elsewhere"]);
  expect(await page.evaluate(() => (window as any).heard)).toEqual([]);
});
