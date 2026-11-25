import { expect, PAGES, panel, sidePanel, tabOf, test } from "./fixtures";
import type { Page, Worker } from "@playwright/test";
import { readFileSync } from "node:fs";

/** Asks Pipeup in `page`'s tab, as the side panel and the right-click menu do. */
const askPage = (worker: Worker, tab: number, message: Record<string, unknown>) =>
  worker.evaluate(([t, m]) => chrome.tabs.sendMessage(t as number, { to: "page", ...(m as object) }), [
    tab,
    message,
  ] as const);

async function started(
  context: import("@playwright/test").BrowserContext,
  worker: Worker,
  id: string,
  page: Page,
) {
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  return p;
}

test("Comment with Pipeup on selected words or a picture opens the box on them", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  await page.evaluate(() => {
    const t = document.querySelector("#p1")!.firstChild!;
    const r = document.createRange();
    r.setStart(t, 3);
    r.setEnd(t, 9);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  });
  await askPage(worker, tab, { type: "commentOn", selection: true });
  await expect(page.locator(".pop.show .draft")).toContainText("launch");
  await page.keyboard.press("Escape");
  const src = await page.locator("#logo").evaluate((i) => (i as HTMLImageElement).src);
  await askPage(worker, tab, { type: "commentOn", src });
  await expect(page.locator(".pop.show .draft textarea")).toBeVisible();
});

test("unpinned, Your comments on this page opens Pipeup's own panel on the page, without its menu", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await p.getByRole("button", { name: /^Your comments on this page/ }).click();
  await expect(page.locator(".all.show")).toHaveCount(1);
  // The panel's bar keeps the name and the Comment switch; the ⋯ that opened a second menu is gone.
  await expect(page.locator(".all .pf .fs")).toBeVisible();
  await expect(page.locator(".all .pf .ib, .launch .mm")).toHaveCount(0);
});

test("on a single-page app, Pipeup follows the page: each address has its own comments", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}app.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const doc = async () =>
    ((await askPage(worker, tab, { type: "agentSend" })) as { result: { doc: string } }).result.doc;
  const before = await doc();
  // Comment mode is on (it takes clicks on the page), so the app changes page as its own code would.
  await page.evaluate(() => history.pushState({}, "", "/settings"));
  await expect.poll(doc).not.toBe(before);
});

test("on a page from this computer, the menu offers Always on for local pages", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await expect(p.getByRole("switch", { name: /Always on for local pages/ })).toBeHidden();
  await p.getByRole("button", { name: "More" }).click();
  await expect(p.getByRole("switch", { name: /Always on for local pages/ })).toBeVisible();
  await expect(p.locator("#always-row")).toBeHidden();
});

test("a picture of where a new comment was is kept, and shown when the comment's place is gone", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  await page.bringToFront();
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  await page.keyboard.type("Is June firm?");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () =>
      worker.evaluate(
        async () =>
          Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith("shot:")).length,
      ),
    )
    .toBe(1);
  // The paragraph goes: the comment is lost, and the side panel shows how it looked. Pipeup takes a moment to give a
  // place up (it waits out the page's churn before calling a comment lost), and the tab tells the panel every 1.5 s:
  // wait for the page's own word first, then look at the panel.
  await page.evaluate(() => document.querySelector("#p2")!.remove());
  const tab = await tabOf(worker, page);
  await expect
    .poll(
      () =>
        worker.evaluate(async (t) => {
          const answer = await chrome.tabs.sendMessage(t, { to: "page", type: "snapshot" }, { frameId: 0 });
          return answer?.result?.threads?.map((x: { where?: string }) => x.where ?? "").join("|") ?? "";
        }, tab),
      { timeout: 20_000 },
    )
    .toMatch(/No longer on the page/);
  const side = await sidePanel(context, worker, id, page);
  const card = side.locator(".card", { hasText: "Is June firm?" });
  await expect(card).toContainText("No longer on the page", { timeout: 10_000 });
  await expect(card.locator("img")).toBeVisible();
  // Deleting the comment deletes its picture.
  await card.click();
  await side.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(side.locator(".card", { hasText: "Is June firm?" })).toHaveCount(0);
  await expect
    .poll(async () =>
      worker.evaluate(
        async () =>
          Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith("shot:")).length,
      ),
    )
    .toBe(0);
});

test("Save as a file gives a Markdown file and a Pipeup file", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await expect(p.getByRole("button", { name: /A Markdown file/ })).toBeHidden();
  await p.getByRole("button", { name: /Save as a file/ }).click();
  const [md] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: /A Markdown file/ }).click(),
  ]);
  expect(md.suggestedFilename()).toBe("Lumen launch plan.md");
  expect(await md.path().then((f) => readFileSync(f, "utf8"))).toContain("# Comments on Lumen launch plan");
  await md.delete();
  // Saved, it folds back; it opens again for the other kind.
  await expect(p.getByRole("button", { name: /A Pipeup file/ })).toBeHidden();
  await p.getByRole("button", { name: /Save as a file/ }).click();
  const [file] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: /A Pipeup file/ }).click(),
  ]);
  expect(file.suggestedFilename()).toBe("Lumen launch plan.pipeup.json");
  await file.delete();
});

test("until it is set up, Send to an AI agent is under More and opens to the one command to run", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await started(context, worker, id, page);
  await expect(p.getByRole("button", { name: /Send to my agent/ })).toBeHidden();
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Send to an AI agent on this computer/ }).click();
  // From the release this extension is, for this browser (Chromium: Chrome's host file).
  const version = await worker.evaluate(() => chrome.runtime.getManifest().version);
  await expect(p.locator("#agent-cmd")).toHaveText(
    `npx --yes pipeup@${version} browser install --extension-id ${id}`,
  );
  await expect(p.locator("#agent-setup-said")).toHaveText("Not set up yet");
  // The settings say the same, behind one line.
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await expect(settings.locator("#agent-said")).toHaveText("Not set up");
  await expect(settings.locator("#agent-cmd")).toBeHidden();
  await settings.getByRole("button", { name: /Send to an AI agent/ }).click();
  await expect(settings.locator("#agent-cmd")).toHaveText(
    `npx --yes pipeup@${version} browser install --extension-id ${id}`,
  );
});

test("once set up, Send to my agent is in the menu's top level, naming the agent that last answered", async ({
  context,
  worker,
  id,
}) => {
  await worker.evaluate(() => chrome.storage.local.set({ agentUsed: true }));
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  let p = await started(context, worker, id, page);
  await expect(p.locator("#on > .item:visible, #on > div > .item:visible")).toHaveText([
    /Add your name/,
    /Your comments on this page/,
    /Copy comments/,
    /Save as a file/,
    /Send to my agent/,
    /Commenting/,
    /More/,
  ]);
  await expect(p.locator("#agent-said")).toHaveText("on this computer");
  await p.close();
  await worker.evaluate(() => chrome.storage.local.set({ agentName: "Claude Code" }));
  p = await panel(context, worker, id, page);
  await expect(p.locator("#agent-said")).toHaveText("Claude Code");
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await expect(settings.locator("#agent-said")).toHaveText("Claude Code");
});

test("add-ons: Emoji is on by default, and the others are turned on in the extension's settings", async ({
  context,
  worker,
  id,
}) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  // The add-ons are behind one line, which says which are on.
  await expect(settings.locator("#addons-said")).toHaveText(/^Emoji on; /);
  await expect(settings.getByRole("switch", { name: /^Emoji/ })).toBeHidden();
  await settings.getByRole("button", { name: /^Add-ons/ }).click();
  await expect(settings.getByRole("switch", { name: /^Emoji/ })).toBeChecked();
  await settings.getByRole("switch", { name: /^Save to GitHub/ }).check();
  await expect(settings.locator("#addons-said")).toHaveText(/^Emoji, Save to GitHub on; /);
  await settings.getByRole("textbox", { name: /Repository for issues/ }).fill("lumen/plans");
  await settings.getByRole("textbox", { name: /Repository for issues/ }).blur();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get("settings")).settings))
    .toMatchObject({ addons: { github: true }, githubRepo: "lumen/plans" });
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const states = await worker.evaluate(
    async (t) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId: t },
          func: () =>
            (
              globalThis as unknown as { Pipeup: { addons(): { id: string; state: string }[] } }
            ).Pipeup.addons().map((a) => `${a.id}:${a.state}`),
        })
      )[0]!.result,
    tab,
  );
  expect(states).toEqual(expect.arrayContaining(["emoji:on", "github:on"]));
});

test("a page can't say where comments go: Share stays off without the reviewer's own sharing address", async ({
  context,
  worker,
  id,
}) => {
  await worker.evaluate(() => chrome.storage.local.set({ settings: { addons: { share: true } } }));
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-pipeup-share", "https://mailbox.example/lumen"),
  );
  await started(context, worker, id, page);
  const tab = await tabOf(worker, page);
  const share = await worker.evaluate(
    async (t) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId: t },
          func: () =>
            (
              globalThis as unknown as { Pipeup: { addons(): { id: string; state: string }[] } }
            ).Pipeup.addons().find((a) => a.id === "share")?.state,
        })
      )[0]!.result,
    tab,
  );
  expect(share).toBe("off");
});

test("what is typed into Pipeup's comment box never reaches the page, and the comment is kept", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  // The page listens for everything typed anywhere, before Pipeup starts.
  await page.evaluate(() => {
    const heard: string[] = ((window as unknown as { heard: string[] }).heard = []);
    for (const type of ["keydown", "keyup", "keypress", "beforeinput", "input", "paste", "compositionend"])
      window.addEventListener(type, (e) => heard.push(`${type}:${(e as KeyboardEvent).key ?? ""}`), true);
  });
  await started(context, worker, id, page);
  await page.bringToFront();
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  // The box is the extension's own frame, with the cursor in it.
  await expect(page.locator(".draft .line iframe")).toBeVisible();
  await expect(page.locator(".draft .line textarea")).toBeHidden();
  await page.keyboard.type("secret plan");
  await expect(page.locator(".draft .send")).toHaveClass(/show/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await expect
    .poll(() =>
      worker.evaluate(async () =>
        JSON.stringify(
          Object.entries(await chrome.storage.local.get(null)).filter(([k]) => k.startsWith("doc:")),
        ),
      ),
    )
    .toContain("secret plan");
  expect(await page.evaluate(() => (window as unknown as { heard: string[] }).heard)).toEqual([]);
});

test("a page that frames the typing page itself gets a box that does nothing", async ({ context, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await page.evaluate((src) => {
    const f = Object.assign(document.createElement("iframe"), { src, id: "mine" });
    document.body.append(f);
    return new Promise((r) => f.addEventListener("load", r));
  }, `chrome-extension://${id}/typing.html`);
  const frame = page.frameLocator("#mine");
  await page.evaluate(() => {
    const c = new MessageChannel();
    (window as unknown as { got: unknown[] }).got = [];
    c.port1.onmessage = (m) => (window as unknown as { got: unknown[] }).got.push(m.data);
    (document.getElementById("mine") as HTMLIFrameElement).contentWindow!.postMessage(
      { pipeup: "typing", token: "made-up", kind: "textarea" },
      "*",
      [c.port2],
    );
  });
  await page.waitForTimeout(300);
  await expect(frame.locator(".box")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { got: unknown[] }).got)).toEqual([]);
});

test("in the extension's box, Shift+Enter breaks the line, Esc cancels, and a reply is typed there too", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await started(context, worker, id, page);
  await page.bringToFront();
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  const line = page.frameLocator(".draft .line iframe").locator(".box");
  await expect(line).toBeFocused();
  await page.keyboard.type("Two");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("lines");
  await expect(line).toHaveValue("Two\nlines");
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  // A comment, then a reply in its thread's own box.
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  await expect(page.frameLocator(".draft .line iframe").locator(".box")).toBeFocused();
  await page.keyboard.type("Is June firm?");
  await page.keyboard.press("Enter");
  // Sent, the comment closes; its marker opens the thread, whose reply line is the extension's box too.
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.locator("[data-thread]").first().click();
  const reply = page.frameLocator(".pop.show .rbox iframe").locator(".box");
  await reply.click();
  await page.keyboard.type("Yes, Lee confirmed.");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show")).toContainText("Yes, Lee confirmed.");
});
