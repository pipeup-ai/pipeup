import { expect, test } from "@playwright/test";
import { addon, blank, CORE, combined, load, mount, openMenu } from "./helpers";

const info = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).Pipeup.addons().map((a: any) => `${a.id}:${a.state}`));

test("an add-on loaded before Pipeup, after it, and in a combined file all attach", async ({ page }) => {
  await blank(page);
  await load(page, addon("test"), CORE);
  await mount(page);
  expect(await info(page)).toEqual(["hello:on"]);
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await expect.poll(() => info(page)).toEqual(["hello:on"]);
  await blank(page);
  await load(page, combined("test"));
  await mount(page);
  await expect.poll(() => info(page)).toEqual(["hello:on"]);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
});

test("an add-on registered after mount attaches at once, and a duplicate id is ignored", async ({ page }) => {
  await blank(page);
  await load(page, CORE);
  await mount(page);
  expect(await info(page)).toEqual([]);
  await load(page, addon("test"));
  await expect.poll(() => info(page)).toEqual(["hello:on"]);
  const warned = page.waitForEvent(
    "console",
    (m) => m.type() === "warning" && /already registered/.test(m.text()),
  );
  await load(page, addon("test"));
  await warned;
  expect(await info(page)).toEqual(["hello:on"]);
});

test("the wrong API stays off, with the reason", async ({ page }) => {
  await blank(page);
  await load(page, CORE);
  await mount(page);
  await page.evaluate(() =>
    (window as any).Pipeup.use({
      id: "old",
      api: 99,
      version: "1",
      needs: [],
      network: { when: "never", to: [], says: "x" },
      setup() {},
    }),
  );
  const [a] = await page.evaluate(() => (window as any).Pipeup.addons());
  expect(a).toMatchObject({ id: "old", state: "off" });
  expect(a.reason).toMatch(/needs add-on API 99; this Pipeup has 1/);
});

test("menu rows: an action, a switch that keeps the menu open, a count, and an error shown in words", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await openMenu(page);
  const menu = page.locator(".menu.show");
  const labels = await menu.locator(".lb").allTextContents();
  // Add-on rows sit between All comments and Start commenting.
  expect(labels.slice(-5)).toEqual([
    "All comments",
    "Pressed 0 times",
    "Switch is off",
    "Fails",
    "Start commenting",
  ]);
  await menu.getByText("Switch is off").click();
  await expect(menu).toHaveClass(/show/);
  await expect(menu.getByText("Switch is on"))
    .toHaveAttribute("aria-checked", "true")
    .catch(async () => {
      await expect(menu.locator("[role=menuitemcheckbox]", { hasText: "Switch is on" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  await menu.getByText("Pressed 0 times").click();
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText("Pressed 1 times")).toBeVisible();
  await expect(page.locator(".menu.show .kc").filter({ hasText: /^1$/ })).toHaveCount(1);
  await page.locator(".menu.show").getByText("Fails").click();
  await expect(page.locator(".toast.show")).toHaveText("Can't reach the example service");
});

test("status is on the control and in the menu; the composer note shows above a new comment", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await expect(page.locator(".launch .mode")).toHaveAttribute("aria-label", /Example on/);
  await openMenu(page);
  await expect(page.locator(".menu.show .sec")).toHaveText("Example on");
});

test("a composer tool inserts words at the caret, with the Send arrow following; the note shows above the box", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await openMenu(page);
  await page.locator(".menu.show").getByText("Start commenting").click();
  // The first click only closes the menu; the next chooses the block.
  await page.locator("[data-pipeup-id=p2]").click();
  await page.locator("[data-pipeup-id=p2]").click();
  const draft = page.locator(".draft");
  await expect(draft.locator(".note")).toHaveText("Comments here are an example.");
  const box = draft.locator("textarea");
  await box.fill("Start");
  await box.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await draft.locator(".tool").click();
  await expect(box).toHaveValue("Start hello world");
  await expect(draft.locator(".send.show")).toBeVisible();
  // The caret stays in the box: pressing a tool takes no focus.
  await expect(box).toBeFocused();
});

test("a panel opens, makes the rest inert, and Escape closes it", async ({ page }) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await page.evaluate(() => ((window as any).__hello.handle = (window as any).__hello.panel()));
  const panel = page.locator(".xp.show");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("A panel");
  await expect(page.locator(".launch")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".xp")).toHaveCount(0);
  await expect(page.locator(".launch")).toHaveJSProperty("inert", false);
});

test("merge records the add-on as the source, and listeners hear it; sign refuses a bad purpose", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  const out = await page.evaluate(async () => {
    const w = window as any;
    const heard: string[] = [];
    w.pu.document.onChange((_t: unknown, added: unknown[], source: string) =>
      heard.push(`${added.length}:${source}`),
    );
    // A second reviewer's comment, made in a throwaway document with the same id.
    const other = await w.Pipeup.PipeupDocument.open({
      doc: w.pu.document.id,
      key: null,
      store: new w.Pipeup.MemoryStore(),
      identity: await w.Pipeup.createIdentity(),
      name: "Ada",
    });
    await other.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p2]"), document.body),
      "From Ada",
    );
    const added = await w.__hello.host.merge(other.ops());
    const again = await w.__hello.host.merge(other.ops());
    let refused = "";
    try {
      await w.pu.document.sign("nope", "x");
    } catch (e: any) {
      refused = e.message;
    }
    const sig = await w.__hello.host.sign("proof", "data");
    return {
      added,
      again,
      heard,
      refused,
      sig: sig.length,
      threads: w.pu.document.threads().map((t: any) => t.root.text),
    };
  });
  expect(out.added).toBe(1);
  expect(out.again).toBe(0);
  expect(out.heard).toEqual(["1:hello"]);
  expect(out.refused).toMatch(/signing purpose/);
  expect(out.sig).toBeGreaterThan(40);
  expect(out.threads).toEqual(["From Ada"]);
});

test("a notice raised while comments are closed waits for the menu; announcements stay out of the toast", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await page.evaluate(() => (window as any).__hello.host.notify("Shared copy is up to date"));
  await expect(page.locator(".toast.show")).toHaveCount(0);
  await openMenu(page);
  await expect(page.locator(".toast.show")).toHaveText("Shared copy is up to date");
});

test("unmount runs the teardown and removes everything the add-on added", async ({ page }) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await page.evaluate(() => (window as any).pu.unmount());
  expect(await page.evaluate(() => (window as any).__hello.torn)).toBe(true);
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  expect(await info(page)).toEqual(["hello:waiting"]);
  // Mounting again sets it up again.
  await mount(page);
  await expect.poll(() => info(page)).toEqual(["hello:on"]);
});

test("an add-on that says it can't work here stays off with its reason, and leaves nothing behind", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE);
  await mount(page);
  await page.evaluate(() =>
    (window as any).Pipeup.use({
      id: "quiet",
      api: 1,
      version: "1",
      needs: ["menu"],
      network: { when: "never", to: [], says: "Sends nothing." },
      setup(host: any) {
        host.addMenuItem({
          id: "x",
          icon: ["M5 12h14"],
          label: () => "Should not show",
          hint: () => "",
          select() {},
        });
        host.off("this browser has no speech engine");
      },
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).Pipeup.addons().map((a: any) => `${a.id}:${a.state}:${a.reason}`)),
    )
    .toEqual(["quiet:off:this browser has no speech engine"]);
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText("Should not show")).toHaveCount(0);
});

test("an add-on's own announcement is heard at once while comments show, never while they are closed", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  await page.evaluate(() => (window as any).__hello.host.announce("Listening"));
  await expect(page.locator(".layer > .sr")).toHaveText("");
  await openMenu(page);
  await page.locator(".menu.show").getByText("Start commenting").click();
  await page.evaluate(() => (window as any).__hello.host.announce("Listening"));
  await expect(page.locator(".layer > .sr")).toHaveText("Listening");
});

test("two copies of Pipeup on one page run once: the second warns and hands over to the first", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  await blank(page);
  await load(page, CORE, addon("test"), CORE);
  await mount(page);
  await expect.poll(() => info(page)).toEqual(["hello:on"]);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  expect(warnings.some((w) => /Pipeup is on this page twice/.test(w))).toBe(true);
  // An add-on arriving through the second copy's global still reaches the first.
  await page.evaluate(() =>
    (window as any).Pipeup.use({
      id: "late",
      api: 1,
      version: "1",
      needs: [],
      network: { when: "never", to: [], says: "x" },
      setup() {},
    }),
  );
  await expect.poll(() => info(page)).toEqual(["hello:on", "late:on"]);
});

test("the combined file and the separate files are the same code", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const core = readFileSync(CORE, "utf8");
  const part = readFileSync(addon("test"), "utf8");
  expect(readFileSync(combined("test"), "utf8")).toBe(`${core}\n${part}`);
  expect(part.startsWith('"use strict"')).toBe(true);
  void page;
});

test("other people's new comments are announced as one short sentence, never while comments are closed", async ({
  page,
}) => {
  await blank(page);
  await load(page, CORE, addon("test"));
  await mount(page);
  const bring = (text: string) =>
    page.evaluate(async (text) => {
      const w = window as any;
      const ada = await w.Pipeup.PipeupDocument.open({
        doc: w.pu.document.id,
        key: null,
        store: new w.Pipeup.MemoryStore(),
        identity: await w.Pipeup.createIdentity(),
        name: "Ada",
      });
      await ada.comment(
        w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
        text,
      );
      await w.__hello.host.merge(ada.ops());
    }, text);
  // Comments are closed: nothing is said, and the words wait.
  await bring("While closed");
  await expect(page.locator(".layer > .sr")).toHaveText("");
  await openMenu(page);
  await page.locator(".menu.show").getByText("Start commenting").click();
  await expect(page.locator(".layer > .sr")).toHaveText("1 new comment from Ada", { timeout: 5000 });
});
