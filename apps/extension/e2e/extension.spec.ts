import { expect, PAGES, panel, sidePanel, tabOf, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Comment mode, a click on the paragraph, the words and Comment: as a reviewer writes one with the extension. The box
 * opens on the page, beside the paragraph, with the cursor in it.
 */
async function writeComment(page: Page, text: string, on = "#p1"): Promise<void> {
  await page.bringToFront();
  // Pipeup has started in the tab; Comment on this page turned comment mode on. If it's off, the shortcut would turn
  // it on, but the shortcut is the browser's own command (background.js), which a test can't press: the same
  // message the command sends does.
  await expect(page.locator(".launch")).toBeAttached();
  if ((await page.locator(".launch .mode.on").count()) === 0) {
    const worker = page.context().serviceWorkers()[0];
    const [tab] = await worker.evaluate((url) => chrome.tabs.query({ url }), page.url());
    await worker.evaluate(
      (id) =>
        chrome.tabs.sendMessage(id, { to: "page", type: "act", action: "mode", value: true }, { frameId: 0 }),
      tab.id!,
    );
  }
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  // Comment mode's layer takes the click, as on any page: press where the paragraph is.
  const at = (await page.locator(on).boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  // The box is the extension's own frame once it's ready, with the cursor in it.
  await expect(page.frameLocator(".draft .line iframe").locator(".box")).toBeFocused();
  await page.keyboard.type(text);
  await page.locator(".draft").getByRole("button", { name: "Comment" }).click();
  // Sent: no box shows (a closed popover fades out and stays in Pipeup's layer, unseen).
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
}

test("Comment on this page adds Pipeup and starts comment mode, with no button on the page; Turn off takes it away", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#where")).toHaveText("localhost:4931/plain.html");
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  // The toolbar is the way in: Pipeup's corner button steps aside, and comment mode is on.
  await expect(page.locator(".launch.off")).toBeAttached();
  await expect(page.locator(".launch .mode")).toBeHidden();
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  await expect(p.getByRole("switch", { name: /Commenting/ })).toBeChecked();
  await expect(p.locator("#count")).toHaveText("0");
  // Turn off on this page, under More: Pipeup leaves the page.
  await expect(p.getByRole("button", { name: "Turn off on this page" })).toBeHidden();
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: "Turn off on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeVisible();
});

test("comments are kept by the extension, not the site, and come back after a reload", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Which beta, Ada's or the public one?");

  // The site's own storage has nothing of Pipeup's: no database, no saved choices.
  const site = await page.evaluate(async () => ({
    databases: (await indexedDB.databases()).map((d) => d.name),
    keys: Object.keys(localStorage),
  }));
  expect(site.databases.filter((n) => n?.includes("pipeup"))).toEqual([]);
  expect(site.keys.filter((k) => k.includes("pipeup"))).toEqual([]);
  // The extension has the comment and one identity for every site.
  const kept = await worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return {
      docs: Object.keys(all).filter((k) => k.startsWith("doc:")),
      profile: !!all.profile,
    };
  });
  expect(kept.docs).toHaveLength(1);
  expect(kept.profile).toBe(true);

  // The toolbar button counts the page's open comments.
  const tab = await tabOf(worker, page);
  await expect.poll(() => worker.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), tab)).toBe("1");

  await page.reload();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(p.locator("#count")).toHaveText("1");
  const side = await sidePanel(context, worker, id, page);
  await expect(side.locator(".card", { hasText: "Which beta" })).toBeVisible();
});

test("after the first comment, one line says where it went, with the menu's own verbs; the box has closed", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Say which week in May.");
  await expect(page.locator(".toast.show")).toHaveText(
    "Saved in this browser. Press Pipeup in the toolbar to copy, save or send them.",
  );
  // Closed once sent: no reply line; the marker is there.
  await expect(page.locator(".pop.show, .th.on").getByRole("textbox", { name: "Reply" })).toHaveCount(0);
  await expect(page.locator("[data-thread]").first()).toBeVisible();
});

test("Settings opens on Comments you've made: the pages commented on", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Say which week in May.");
  const list = await context.newPage();
  await list.goto(`chrome-extension://${id}/comments.html`);
  await expect(list.getByRole("heading", { level: 2 }).first()).toHaveText("Comments you've made");
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list.locator("li a")).toHaveText("Lumen launch plan");
  await expect(list.locator("li span")).toContainText("1 comment");
});

test("a page with Pipeup built in keeps its own; the extension steps aside and says so", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}built-in.html`);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#built-in")).toBeVisible();
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeHidden();
  await expect(page.locator("pipeup-root")).toHaveCount(0);
});

test("on a browser page it says Pipeup can't run there", async ({ context, worker, id }) => {
  const page = await context.newPage();
  await page.goto("chrome://version");
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#blocked")).toBeVisible();
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeHidden();
});

test("on a file opened from this computer it says how to open it instead", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(pathToFileURL(fileURLToPath(new URL("pages/plain.html", import.meta.url))).href);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#blocked")).toContainText("file on this computer");
  await expect(p.locator("#blocked")).toContainText("pipeup browser");
  await expect(p.locator("#where")).toHaveText("plain.html");
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeHidden();
});

test("the toolbar panel is Pipeup's menu: name, copy, theme, Hide comments and comment mode", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  // Off: one action and one sentence (what clicking does; where comments stay is said after the first comment).
  await expect(p.locator("#off .note")).toHaveText("Click anything on the page to comment on it.");
  await expect(p.getByRole("switch")).toHaveCount(0);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  // On: the rows and More; no status line, no footer. Send to my agent waits under More until it is set up.
  await expect(p.locator("#status, footer")).toHaveCount(0);
  await expect(p.locator("#on > .item:visible, #on > div > .item:visible")).toHaveText([
    /Add your name/,
    /Your comments on this page/,
    /Copy comments/,
    /Save as a file/,
    /Commenting/,
    /More/,
  ]);

  // Who you are: the animal Pipeup gave, and the row becomes a name field in place.
  await expect(p.locator("#who-name")).not.toHaveText(/^(You|)$/);
  await p.getByRole("button", { name: /Add your name/ }).click();
  await p.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await p.keyboard.press("Enter");
  await expect(p.getByRole("button", { name: /Sam/ })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  // Theme, under More: each press moves on, and the page's Pipeup follows.
  await expect(p.getByRole("button", { name: /Theme/ })).toBeHidden();
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Theme/ }).click();
  await expect(p.locator("#theme-now")).toHaveText("Light");
  await p.getByRole("button", { name: /Theme/ }).click();
  await expect(p.locator("#theme-now")).toHaveText("Dark");
  await expect(page.locator(".layer")).toHaveClass(/dark/);

  // Hide comments.
  await p.getByRole("switch", { name: "Hide comments" }).check();
  await expect
    .poll(() => p.evaluate(() => (document.getElementById("hide") as HTMLInputElement).checked))
    .toBe(true);

  // More folds back with Esc, and focus comes back to its row.
  await p.getByRole("switch", { name: "Hide comments" }).focus();
  await p.keyboard.press("Escape");
  await expect(p.getByRole("button", { name: /Theme/ })).toBeHidden();
  await expect(p.getByRole("button", { name: "More" })).toBeFocused();

  // Copy comments, one press: the readable text, which is also Markdown (what goes to the clipboard is caught here).
  await p.evaluate(() => {
    const w = window as unknown as { copied: string };
    navigator.clipboard.writeText = async (t: string) => void (w.copied = t);
  });
  await expect(p.locator("#copied")).toHaveText("to paste anywhere");
  await p.getByRole("button", { name: /Copy comments/ }).click();
  await expect(p.locator("#copied")).toHaveText("Copied 0 threads");
  expect(await p.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
    "# Comments on Lumen launch plan",
  );

  // Commenting turns comment mode off and on.
  await p.getByRole("switch", { name: /Commenting/ }).click();
  await expect(page.locator(".launch .mode.on")).toHaveCount(0);
});

test("unpinned, threads open as popovers on the page, and Comments lists them all", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Which beta?");
  // Written: it closes (§7); its marker opens it beside the paragraph, as a popover, and the page keeps its width.
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.locator("[data-thread]").first().click();
  await expect(page.locator(".pop.show", { hasText: "Which beta?" })).toBeVisible();
  const side = await sidePanel(context, worker, id, page);
  await expect(side.locator(".card", { hasText: "Which beta?" })).toBeVisible();
  await expect(side.getByRole("button", { name: "Keep comments beside the page" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("pinned, a thread opened on the page shows in the side panel, and replies and resolves there", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  const side = await sidePanel(context, worker, id, page);
  // The side panel's pin: Pipeup on the page starts again the pinned way.
  await side.getByRole("button", { name: "Keep comments beside the page" }).click();
  await expect(side.getByRole("button", { name: "Keep comments beside the page" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const tab = await tabOf(worker, page);
  await expect
    .poll(() =>
      worker.evaluate(
        async (t) =>
          (
            await chrome.scripting.executeScript({
              target: { tabId: t },
              func: () => (globalThis as unknown as { __pipeupExt?: { mode?: string } }).__pipeupExt?.mode,
            })
          )[0]!.result,
        tab,
      ),
    )
    .toBe("pinned");
  await writeComment(page, "Which beta?");
  // Written on the page, it closes; its marker opens the thread in the side panel, not on the page.
  await expect(side.locator(".card", { hasText: "Which beta?" })).toBeVisible();
  await expect(side.locator(".card.open")).toHaveCount(0);
  await page.locator("[data-thread]").first().click();
  const card = side.locator(".card.open");
  await expect(card).toContainText("Which beta?");
  await expect(page.locator(".pop.show .th")).toHaveCount(0);
  await card.getByRole("textbox", { name: "Reply" }).fill("Ours. I'll say so.");
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(side.locator(".card", { hasText: "Which beta?" })).toContainText("Ours. I'll say so.");
  await expect(side.locator(".card.open").getByRole("textbox", { name: "Reply" })).toHaveValue("");
  await side.locator(".card.open").getByRole("button", { name: "✓ Resolve" }).click();
  await expect(side.locator(".card", { hasText: "Which beta?" })).toHaveCount(0);
  await side.getByRole("button", { name: "✓ Resolved" }).click();
  await expect(side.locator(".card.resolved", { hasText: "Which beta?" })).toBeVisible();
  // The toolbar panel's switch, under More, says so too.
  await p.reload();
  await p.getByRole("button", { name: "More" }).click();
  await expect(p.getByRole("switch", { name: "Keep comments beside the page" })).toBeChecked();
});

test("the toolbar button shows comment mode: green, saying on when there are no comments", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const tab = await tabOf(worker, page);
  const badge = () =>
    worker.evaluate(
      async (t) => ({
        text: await chrome.action.getBadgeText({ tabId: t }),
        colour: (await chrome.action.getBadgeBackgroundColor({ tabId: t })).slice(0, 3).join(","),
      }),
      tab,
    );
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await expect.poll(badge).toEqual({ text: "on", colour: "47,125,74" });
  await page.bringToFront();
  await page.keyboard.press("Escape");
  await expect.poll(badge).toEqual({ text: "", colour: "83,74,183" });
});

test("Show Pipeup's button on pages brings the corner button back", async ({ context, worker, id }) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await settings.getByRole("switch", { name: /Show Pipeup's own button/ }).check();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get("settings")).settings))
    .toEqual({
      showButton: true,
    });
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await expect(page.locator(".launch .mode")).toBeVisible();
});

test("after the extension is reloaded or updated, the old Pipeup takes itself off the page", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await expect(page.locator("pipeup-root")).toHaveCount(0, { timeout: 5000 });
});

test("in the side panel, a whole card opens its thread, and a comment on a picture says what it's on", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  await (
    await panel(context, worker, id, page)
  )
    .getByRole("button", { name: "Comment on this page" })
    .click();
  await writeComment(page, "Make the logo bigger?", "#logo");
  const side = await sidePanel(context, worker, id, page);
  const card = side.locator(".card", { hasText: "Make the logo bigger?" });
  await expect(card).toContainText("On a picture · Lumen logo");
  // A click on the card's words, not only its first line, opens it.
  await card.getByText("Make the logo bigger?").click();
  await expect(side.locator(".card.open")).toContainText("Make the logo bigger?");
  await expect(side.locator(".card.open").getByRole("textbox", { name: "Reply" })).toBeVisible();
});

test("the toolbar button is Pipeup's violet bubble, whatever the browser's or the system's look", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  const p = await panel(context, worker, id, page);
  await p.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  // One bubble, no light or dark pair, and nothing about the look is kept.
  const found = await p.evaluate(async () =>
    Promise.all(
      ["toolbar-32", "toolbar-light-32", "toolbar-dark-32"].map((f) =>
        fetch(`icons/${f}.png`).then(
          (r) => r.ok,
          () => false, // a file the package doesn't have: the browser refuses the fetch rather than answering 404
        ),
      ),
    ),
  );
  expect(found).toEqual([true, false, false]);
  expect(await worker.evaluate(async () => (await chrome.storage.local.get("dark")).dark)).toBeUndefined();
  // The violet bubble, in the manifest, is what the toolbar shows.
  const icon = await worker.evaluate(() => chrome.runtime.getManifest().action?.default_icon);
  expect(icon).toEqual({ 16: "icons/toolbar-16.png", 32: "icons/toolbar-32.png" });
});

test("one shortcut: Alt+Shift+C is the browser's command for Comment on this page; the menu's own has no default key", async ({
  worker,
}) => {
  const commands = await worker.evaluate(() => chrome.runtime.getManifest().commands);
  expect(commands?.comment?.suggested_key?.default).toBe("Alt+Shift+C");
  expect(commands?._execute_action?.suggested_key).toBeUndefined();
  expect(Object.keys(commands ?? {}).sort()).toEqual(["_execute_action", "comment"]);
});

test("on a dark site with white links, the box keeps Pipeup's violet and its field stays transparent", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}dark-site.html`);
  const p = await panel(context, worker, id, page);
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await page.bringToFront();
  await expect(page.locator(".launch")).toBeAttached();
  const at = (await page.locator("#p1").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  const box = page.frameLocator(".draft .line iframe").locator(".box");
  await expect(box).toBeFocused();
  // The accent is Pipeup's own, not the site's white link colour: the Comment button is violet.
  const send = page.locator(".draft .send");
  const [bg, layer] = await page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    return [
      getComputedStyle(root.querySelector(".draft .send")!).backgroundColor,
      root.querySelector(".layer")!.className,
    ];
  });
  expect(layer).toContain("dark");
  expect(bg).not.toMatch(/rgb\(2[2-5]\d, 2[2-5]\d, 2[2-5]\d\)/);
  await expect(send).toBeVisible();
  // The field's frame and its element agree on the dark scheme, so the browser paints no white backdrop.
  const frame = page.locator(".draft .line iframe");
  expect(await frame.evaluate((f) => getComputedStyle(f).colorScheme)).toBe("dark");
  expect(await box.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");
});

test("on a page with Pipeup built in, the shortcut goes to the page's own Pipeup, and the menu says to use it", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}built-in-on.html`);
  await expect(page.locator(".launch")).toBeAttached();
  await expect(page.locator(".launch .mode.on")).toHaveCount(0);
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#built-in")).toBeVisible();
  await expect(p.locator("#built-in kbd")).toHaveText(/C$|Shift\+Alt\+C/);
  // What the shortcut does: the same path the browser's command takes.
  const tab = await tabOf(worker, page);
  await page.bringToFront();
  const ok = await p.evaluate((tabId) => chrome.runtime.sendMessage({ type: "comment", tabId }), tab);
  expect(ok).toEqual({ ok: true });
  // The page's own Pipeup took it: its comment mode is on, and there is still one Pipeup, the page's.
  await expect(page.locator(".launch .mode.on")).toBeAttached();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await expect(page.locator("pipeup-root")).not.toHaveAttribute("data-pipeup-extension", "");
});

test("a root left by a cut-off copy of the extension isn't Pipeup built in: it is taken off and Pipeup starts", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}plain.html`);
  // What an orphan leaves: the extension's own root, marked, with no copy behind it to answer.
  await page.evaluate(() => {
    const root = document.createElement("pipeup-root");
    root.setAttribute("data-pipeup-extension", "");
    document.body.append(root);
  });
  const p = await panel(context, worker, id, page);
  await expect(p.locator("#built-in")).toBeHidden();
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await page.bringToFront();
  await expect(page.locator(".launch")).toBeAttached();
  // One root, the live one, marked as the extension's.
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await expect(page.locator("pipeup-root")).toHaveAttribute("data-pipeup-extension", "");
});

test("a site's script whose name only contains “pipeup” isn't Pipeup built in: the extension offers itself", async ({
  context,
  worker,
  id,
}) => {
  const page = await context.newPage();
  await page.goto(`${PAGES}lookalike.html`);
  const p = await panel(context, worker, id, page);
  await expect(p.getByRole("button", { name: "Comment on this page" })).toBeVisible();
  await expect(p.locator("#built-in")).toBeHidden();
  await p.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  // Reopened, the panel is Pipeup's menu: the extension's own Pipeup is never mistaken for the page's.
  const again = await panel(context, worker, id, page);
  await expect(again.getByRole("switch", { name: /Commenting/ })).toBeVisible();
  await expect(again.locator("#built-in")).toBeHidden();
});
