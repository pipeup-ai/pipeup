import { expect, test, type Page } from "@playwright/test";
import {
  bodySnapshot,
  commenting,
  control,
  focusInPipeup,
  leaveReply,
  open,
  seedElement,
  seedText,
  settled,
  toggleCommenting,
} from "./helpers";

const shortcut = (page: Page) => page.keyboard.press("Shift+Alt+KeyC");

/** The block cursor's marker that has focus: its label words, and the page block it is named after. */
async function cursorOn(page: Page): Promise<{ label: string; block: string } | null> {
  return page.evaluate(() => {
    const a = document.querySelector("pipeup-root")!.shadowRoot!.activeElement;
    if (!a?.matches(".km")) return null;
    const el = a.ariaLabelledByElements?.[1]?.matches("span")
      ? a.ariaDescribedByElements?.at(-1)
      : a.ariaLabelledByElements?.[1];
    return { label: a.firstElementChild!.textContent!, block: el ? el.id || el.tagName.toLowerCase() : "" };
  });
}
/** What screen readers were last told. */
const said = (page: Page) => page.locator(".sr[aria-live]");

test("the shortcut puts the block cursor on the first block in view, with the keyboard hint; Enter comments on it", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await commenting(page);
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 1 of 8", block: "h1" });
  await expect(page.locator(".pick.show.kf")).toHaveCount(1);
  await expect(page.locator(".toast.show")).toHaveText(
    "Tab moves between blocks · ↑ ↓ change level · Enter comments · Esc to finish · F7 selects text",
  );
  await expect(page.locator(".toast")).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator(".draft").getByRole("textbox", { name: "Comment" })).toBeFocused();
  await expect(said(page)).toHaveText("Commenting on Heading · Q3 plan");
});

test("the block cursor starts on the block that has focus", async ({ page }) => {
  await open(page, "controls.html");
  await page.locator("#cta").focus();
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Link, 2 of 8", block: "cta" });
});

test("Esc on the cursor leaves comment mode and gives focus back; so does the shortcut", async ({ page }) => {
  await open(page, "controls.html");
  await page.locator("#cta").focus();
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "cta" });
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await expect(page.locator("#cta")).toBeFocused();
  await expect(page.locator(".pick.show")).toHaveCount(0);
  await expect(said(page)).toHaveText("Comment mode off");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "cta" });
  await shortcut(page);
  await commenting(page, false);
  await expect(page.locator("#cta")).toBeFocused();
  await expect(said(page)).toHaveText("Comment mode off");
});

test("with nothing focused before, Esc leaves comment mode with focus on the Comment control", async ({
  page,
}) => {
  await open(page, "controls.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await expect(control(page)).toBeFocused();
});

test("Start commenting chosen from the keyboard closes the menu and puts the cursor on the page; Esc goes to the control", async ({
  page,
}) => {
  await open(page, "doc.html");
  await control(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toBeFocused();
  await page.keyboard.press("Enter");
  await commenting(page);
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await page.keyboard.press("Escape");
  await expect(control(page)).toBeFocused();
});

test("Start commenting chosen with the mouse leaves the menu open and starts no cursor", async ({ page }) => {
  await open(page, "doc.html");
  await control(page).click();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await commenting(page);
  await expect(page.locator(".menu.show")).toHaveCount(1);
  expect(await cursorOn(page)).toBeNull();
  await expect(page.locator(".toast.show")).toContainText("Click anything to comment");
});

test("after a pointer click the shortcut brings the cursor back; after a mouse start it leaves", async ({
  page,
}) => {
  await open(page, "controls.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "title" });
  await page.locator("#card").click();
  await expect(page.locator(".draft")).toHaveCount(1);
  await page.keyboard.press("Escape");
  // It comes back on the block clicked last.
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "card" });
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await toggleCommenting(page);
  await shortcut(page);
  await commenting(page, false);
});

test("with the cursor not in use, Enter and Space on page controls do what the page does; a click is still swallowed", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.evaluate(() => {
    document
      .querySelector("header")!
      .insertAdjacentHTML(
        "beforeend",
        '<input id="cb" type="checkbox" aria-label="Agree"><a id="later" href="#later">Later</a>',
      );
  });
  await toggleCommenting(page);
  await page.locator("#go").focus();
  await page.keyboard.press("Enter");
  await page.locator("#cb").focus();
  await page.keyboard.press("Space");
  await page.locator("#later").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).fired)).toEqual(["go"]);
  await expect(page.locator("#cb")).toBeChecked();
  expect(page.url()).toMatch(/#later$/);
  await expect(page.locator(".draft")).toHaveCount(0);
  // A pointer's click on the same control is still comment mode's.
  await page.locator("#go").click();
  expect(await page.evaluate(() => (window as any).fired)).toEqual(["go"]);
  // The same once the keyboard's cursor is put away.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await commenting(page, false);
  // Comment mode with no block cursor out.
  await toggleCommenting(page);
  await commenting(page);
  await page.locator("#go").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).fired)).toEqual(["go", "go"]);
});

test("a page with nothing to comment on gets no cursor, and says so", async ({ page }) => {
  await open(page, "doc.html");
  await page.evaluate(() => document.querySelector("article")!.remove());
  await shortcut(page);
  await commenting(page);
  await expect(page.locator(".toast.show")).toHaveText("Nothing here to comment on");
  expect(await cursorOn(page)).toBeNull();
});

/** Records which keys the page's own document hears on keyup. */
const hearKeyups = (page: Page) =>
  page.evaluate(() => {
    (window as any).ups = [];
    document.addEventListener("keyup", (e) => (window as any).ups.push(e.key));
  });
const ups = async (page: Page, key: string) =>
  (await page.evaluate(() => (window as any).ups as string[])).filter((k) => k === key);

for (const key of ["Enter", "Space", "Escape"]) {
  test(`the page never hears the keyup of ${key} once the cursor took it`, async ({ page }) => {
    await open(page, "doc.html");
    await shortcut(page);
    await expect.poll(() => cursorOn(page)).not.toBeNull();
    await hearKeyups(page);
    await page.keyboard.press(key);
    if (key === "Escape") await expect(page.locator(".pick.show")).toHaveCount(0);
    else await expect(page.locator(".draft")).toHaveCount(1);
    expect(await ups(page, key === "Space" ? " " : key)).toEqual([]);
  });
}

test("a keyup the cursor took but never heard does not swallow a later keyup the page should hear", async ({
  page,
}) => {
  await open(page, "controls.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  await hearKeyups(page);
  // Enter is taken on the marker, and its keyup is lost on the way (focus left the window).
  await page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    root.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }),
    );
  });
  await expect(page.locator(".draft")).toHaveCount(1);
  await page.locator("#email").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => ups(page, "Enter")).toEqual(["Enter"]);
});

test("with the cursor put away by a click and nothing left to land on, the shortcut leaves comment mode", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  await page.locator("article p").first().click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector("article")!.remove());
  await page.waitForTimeout(500);
  await shortcut(page);
  await commenting(page, false);
});

test("the cursor never lands on a block that was just removed", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await page.keyboard.press("Escape");
  // Removed and the shortcut pressed in the same instant, before Pipeup has noticed the change.
  await page.evaluate(() => {
    document.querySelector("h1")!.remove();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyC", key: "C", shiftKey: true, altKey: true, bubbles: true }),
    );
  });
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  expect(
    await page.evaluate(() => {
      const a = document.querySelector("pipeup-root")!.shadowRoot!.activeElement as any;
      return [...(a.ariaLabelledByElements ?? [])].every((e) => e.isConnected);
    }),
  ).toBe(true);
});

test("Enter on a button that never submits does not let a later form submit through", async ({ page }) => {
  await open(page, "controls.html");
  await page.evaluate(() => {
    document
      .querySelector("header")!
      .insertAdjacentHTML(
        "beforeend",
        '<form id="f"><button id="nb" type="button">Plain</button><input id="ti" aria-label="Name"></form>',
      );
    (window as any).submits = 0;
    document.addEventListener("submit", (e) => {
      e.preventDefault();
      (window as any).submits++;
    });
  });
  await toggleCommenting(page);
  await page.locator("#nb").focus();
  await page.keyboard.press("Enter");
  await page.locator("#ti").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).submits)).toBe(0);
});

test("a cursor put away and brought back after the page changed names its block by the level it is now on", async ({
  page,
}) => {
  await open(page, "doc.html");
  await page.evaluate(() => {
    document
      .querySelector("article")!
      .insertAdjacentHTML("beforeend", '<section id="sec" tabindex="0" data-pipeup-id="sec">Notes</section>');
    document.querySelector<HTMLElement>("#sec")!.focus();
  });
  await shortcut(page);
  await expect.poll(async () => (await cursorOn(page))?.label).toMatch(/^Section, \d+ of \d+/);
  await page.keyboard.press("Escape");
  // The section now has a block inside it, so it is a level higher than when the cursor left it.
  await page.evaluate(() =>
    document.querySelector("#sec")!.insertAdjacentHTML("beforeend", '<p data-pipeup-id="in">Inside</p>'),
  );
  // Pipeup notices the change and drops what it knew of the page's blocks.
  await page.waitForTimeout(500);
  await shortcut(page);
  expect((await cursorOn(page))?.label).toMatch(/^Section, [1-9]\d* of \d+/);
});

test("a block's name counts the open comments on it or inside it", async ({ page }) => {
  await open(page, "doc.html");
  await seedElement(page, "#p1", "First");
  await seedElement(page, "#p1", "Second");
  await page.evaluate(() => document.querySelector<HTMLElement>("#p1")!.setAttribute("tabindex", "0"));
  await page.locator("#p1").focus();
  await shortcut(page);
  await expect
    .poll(async () => (await cursorOn(page))?.label)
    .toMatch(/^Paragraph, \d+ of \d+, has 2 comments$/);
  await page.keyboard.press("Escape");
  await page.locator("#p2").evaluate((el) => (el.tabIndex = 0));
  await seedElement(page, "#p2", "Only");
  await page.locator("#p2").focus();
  await page.keyboard.press("Escape");
  await shortcut(page);
  await expect
    .poll(async () => (await cursorOn(page))?.label)
    .toMatch(/^Paragraph, \d+ of \d+, has 1 comment$/);
});

test("the cursor in use never changes the page's DOM or layout", async ({ page }) => {
  await open(page, "doc.html");
  const before = await bodySnapshot(page);
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  await page.keyboard.press("Enter");
  await expect(page.locator(".draft")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect(await bodySnapshot(page)).toBe(before);
});

/** Which of the two markers has focus (they take turns, so every move is a real focus change). */
const marker = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    return [...root.querySelectorAll(".km")].indexOf(root.activeElement!);
  });

test("Tab and Shift+Tab walk the smallest blocks in page order and wrap; the page never hears them", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 1 of 8", block: "h1" });
  await page.evaluate(() => {
    (window as any).heard = [];
    document.addEventListener("keydown", (e) => e.key !== "Shift" && (window as any).heard.push(e.key));
  });
  const first = await marker(page);
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Paragraph, 2 of 8", block: "p1" });
  expect(await marker(page)).not.toBe(first);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Link, 8 of 8", block: "a" });
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 8" });
  expect(await page.evaluate(() => (window as any).heard)).toEqual([]);
});

test("↑ goes to the block around it and Tab walks that level; ↓ comes back to the block it came from", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 5 of 8" });
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Revenue chart, 4 of 6" });
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 5 of 6", block: "h2" });
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 1 of 1" });
  await page.keyboard.press("ArrowUp");
  await expect(said(page)).toHaveText("Nothing around it");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Revenue chart, 4 of 6" });
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 5 of 8" });
  await page.keyboard.press("ArrowDown");
  await expect(said(page)).toHaveText("Nothing inside it");
});

test("the naming bar is a group after the cursor and before the control; Around it and Inside it move the cursor", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await page.keyboard.press("Tab");
  const bar = page.getByRole("group", { name: "Chosen block" });
  await expect(bar).toBeVisible();
  expect(
    await page.evaluate(() => {
      const root = document.querySelector("pipeup-root")!.shadowRoot!;
      const q = (sel: string) => root.querySelector(sel)!;
      return [
        q(".km").compareDocumentPosition(q(".namebar")),
        q(".namebar").compareDocumentPosition(q(".launch")),
      ].map((p) => p & 4);
    }),
  ).toEqual([4, 4]);
  // At a block with nothing inside, Inside it is hidden.
  await expect(bar.getByRole("button", { name: "Inside it" })).toBeHidden();
  await bar.getByRole("button", { name: "Around it" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 1 of 1" });
  await bar.getByRole("button", { name: "Inside it" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Paragraph, 2 of 8", block: "p1" });
});

test("with the cursor not in use, Enter in a page text field submits its form and opens no draft", async ({
  page,
}) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  await page.locator("#email").focus();
  await page.keyboard.type("me@example.test");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => (window as any).fired)).toEqual(["submit"]);
  await expect(page.locator(".draft")).toHaveCount(0);
  // A pointer's click on the form's button is still comment mode's.
  await page.locator("#join").click();
  expect(await page.evaluate(() => (window as any).fired)).toEqual(["submit"]);
});

test("on a reveal.js deck the deck hears no key the cursor takes; → still moves the slide and the cursor follows", async ({
  page,
}) => {
  await open(page, "reveal.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 3" });
  await page.evaluate(() => ((window as any).heard = []));
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Section, 1 of 2" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Paragraph, 2 of 3" });
  // Esc on the marker leaves comment mode; the deck doesn't hear it. The shortcut starts the cursor afresh.
  await page.keyboard.press("Escape");
  await commenting(page, false);
  expect(await page.evaluate(() => (window as any).heard)).toEqual([]);
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 3" });
  await page.evaluate(() => ((window as any).heard = []));
  const was = await marker(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-pipeup-id=r2]")).toHaveClass(/present/);
  // The cursor lands again on the new slide's first block, on the other marker.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("pipeup-root")!.shadowRoot!.activeElement?.ariaLabelledByElements?.[1]
            ?.textContent,
      ),
    )
    .toBe("Two");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 3" });
  expect(await marker(page)).not.toBe(was);
  expect(await page.evaluate(() => (window as any).heard)).toEqual([
    "document ArrowRight",
    "window ArrowRight",
  ]);
  // Space comments on the block; the deck doesn't hear it either.
  await page.keyboard.press("Space");
  await expect(page.locator(".draft").getByRole("textbox", { name: "Comment" })).toBeFocused();
  expect(await page.evaluate(() => (window as any).heard)).toEqual([
    "document ArrowRight",
    "window ArrowRight",
  ]);
});

test("Tab, Shift+Tab, ↑ and ↓ never land on a block that has left the page", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 1 of 8", block: "h1" });
  await page.evaluate(() => document.getElementById("p1")!.remove());
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).not.toMatchObject({ block: "p1" });
  const on = await cursorOn(page);
  expect(on?.label).toMatch(/ of 7$/);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  expect((await cursorOn(page))?.label).toMatch(/ of 7$/);
  expect(await page.evaluate(() => document.getElementById("p1"))).toBeNull();
});

test("with a box open, Around it then Inside it comes back to the block it was on", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 5 of 8" });
  await page.keyboard.press("Enter");
  const lbl = page.locator(".namebar .lbl");
  const bar = page.getByRole("group", { name: "Chosen block" });
  await expect(page.locator(".draft").getByRole("textbox", { name: "Comment" })).toBeFocused();
  // The bars differ in height, so the outline's height says which one the box is on.
  const height = async () => {
    await settled(page.locator(".pick.show"));
    return Math.round((await page.locator(".pick.show").boundingBox())!.height);
  };
  const was = await height();
  await bar.getByRole("button", { name: "Around it" }).click();
  await expect(lbl).toHaveText("Revenue chart");
  expect(await height()).toBeGreaterThan(was);
  await bar.getByRole("button", { name: "Inside it" }).click();
  await expect.poll(height).toBe(was);
});

test("Tab after the cursor's own block was removed goes to the first block, Shift+Tab to the last", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Paragraph, 2 of 8", block: "p1" });
  await page.evaluate(() => document.getElementById("p1")!.remove());
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 7" });
  await page.evaluate(() => document.getElementById("p2")!.remove());
  await page.evaluate(() => document.querySelector("h1")!.remove());
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Link, 5 of 5" });
});

test("⌘, Ctrl or Alt with ↑ or ↓ is the page's, not the cursor's", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 8" });
  await page.evaluate(() => {
    (window as any).heard = [];
    document.addEventListener(
      "keydown",
      (e) => e.key.startsWith("Arrow") && (window as any).heard.push(e.key),
    );
  });
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Control+ArrowDown");
  await page.keyboard.press("Meta+ArrowUp");
  expect(await page.evaluate(() => (window as any).heard)).toEqual(["ArrowDown", "ArrowDown", "ArrowUp"]);
  expect((await cursorOn(page))?.label).toBe("Heading, 1 of 8");
});

const draftLine = (page: Page) => page.locator(".draft").getByRole("textbox", { name: "Comment" });

for (const fixture of ["doc.html", "controls.html"])
  test(`Enter comments, Enter sends, and focus is back on the cursor's block, which has 1 comment (${fixture})`, async ({
    page,
  }) => {
    await open(page, fixture);
    await shortcut(page);
    await page.keyboard.press("Tab");
    const before = (await cursorOn(page))!;
    await page.keyboard.press("Enter");
    await expect(draftLine(page)).toBeFocused();
    await page.keyboard.type("Too vague");
    await page.keyboard.press("Enter");
    await expect.poll(() => cursorOn(page)).toEqual({ ...before, label: `${before.label}, has 1 comment` });
    // The new thread is open; moving on closes it.
    await expect(page.locator(".th.on, .pop.show [data-thread]")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.locator(".th.on, .pop.show [data-thread]")).toHaveCount(0);
  });

test("Esc in the draft cancels it and focus is back on the cursor", async ({ page }) => {
  await open(page, "controls.html");
  await shortcut(page);
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 1 of 8", block: "title" });
});

test("Shift+Enter opens the block's threads in page order, one per press, wrapping; Esc returns to the cursor", async ({
  page,
}) => {
  await open(page, "doc.html");
  // Written in the reverse of page order: the element comes first, then the pin, then the words inside.
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedElement(page, "#p1", "Pinned", { x: 0.5, y: 0.8 });
  await seedElement(page, "#p1", "On the paragraph");
  await shortcut(page);
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Paragraph, 2 of 8, has 3 comments" });
  for (const [n, words] of [
    [1, "On the paragraph"],
    [2, "Pinned"],
    [3, "Is 20% realistic?"],
    [1, "On the paragraph"],
  ] as const) {
    await page.keyboard.press("Shift+Enter");
    await expect(page.locator(".th.on")).toContainText(words);
    await expect(said(page)).toHaveText(`Comment ${n} of 3 on this block`);
    expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
    await page.keyboard.press("Escape");
    await expect(page.locator(".th.on")).toHaveCount(0);
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  }
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Enter");
  await expect(said(page)).toHaveText("No comments on this block");
  await expect(page.locator(".th.on")).toHaveCount(0);
});

test("a screen reader's activate on page text comments there and moves the cursor there", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  // NVDA and JAWS in browse mode send a click with no pointer (detail 0).
  await page.locator("#p2").dispatchEvent("click");
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p2" });
});

test("a draft with words on a slide that went away is returned to by Enter, with focus in it", async ({
  page,
}) => {
  await open(page, "reveal.html");
  await shortcut(page);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keep me");
  await leaveReply(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 3" });
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(draftLine(page)).toHaveValue("Keep me");
  expect(await page.evaluate(() => (window as any).slid)).toEqual([1, 0]);
});

test("the cursor moved off the draft's block lets go of it: ↑ moves the cursor, Esc leaves, the draft waits", async ({
  page,
}) => {
  await open(page, "reveal.html");
  await shortcut(page);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keep me");
  await leaveReply(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Heading, 1 of 3" });
  // ↑ moves the cursor to the slide around it; the draft stays on slide one's heading.
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Section, 1 of 2" });
  await expect(page.locator(".draft .ctx")).toHaveText("Heading · One");
  // Esc leaves comment mode properly: no marker keeps an invisible focus, and the draft is kept.
  await page.keyboard.press("Escape");
  await commenting(page, false);
  expect(await cursorOn(page)).toBeNull();
  await expect(page.locator(".pick.show")).toHaveCount(0);
  await expect(draftLine(page)).toHaveValue("Keep me");
  // The shortcut starts the cursor again, and Enter returns to the draft on slide one.
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(draftLine(page)).toHaveValue("Keep me");
  expect(await page.evaluate(() => (window as any).slid)).toEqual([1, 0]);
});

test("without the cursor, focus after sending is in the new thread's reply line", async ({ page }) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  await page.locator("#card").click();
  await draftLine(page).fill("Plain?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
});

test("a fresh landing starts at the landing block's level, not the one the cursor left", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 1 of 1" });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    document.querySelector("article")!.remove();
    const box = "<section style='padding:10px'>";
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section style='padding:10px'><p id="pa">Alpha</p>${box}${box}${box}<p id="pb">Beta</p></section></section></section></section>`,
    );
  });
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "pa" });
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "pb" });
});

test("Shift+Enter starts again at the first thread after the cursor moved by a screen reader's activate", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedElement(page, "#p1", "One");
  await seedElement(page, "#p1", "Two");
  await seedElement(page, "#p2", "Other");
  await shortcut(page);
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  await page.keyboard.press("Shift+Enter");
  await expect(said(page)).toHaveText("Comment 1 of 2 on this block");
  await page.keyboard.press("Escape");
  await page.locator("#p2").dispatchEvent("click");
  await page.keyboard.press("Escape");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p2" });
  await page.locator("#p1").dispatchEvent("click");
  await page.keyboard.press("Escape");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  await page.keyboard.press("Shift+Enter");
  await expect(said(page)).toHaveText("Comment 1 of 2 on this block");
});

test("Shift+Enter with words in the draft goes back to the draft; one thread announces no count", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedElement(page, "#p1", "Only");
  await shortcut(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Enter");
  await expect(page.locator(".th.on")).toContainText("Only");
  await expect(said(page)).not.toHaveText(/of 1/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Draft words");
  await leaveReply(page);
  await page.locator(".km:not([inert])").focus();
  await page.keyboard.press("Shift+Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(draftLine(page)).toHaveValue("Draft words");
});

test("bubbles are in page order and say what they are on; Esc in the thread a bubble opened returns to it", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedElement(page, "[data-pipeup-id=tile-teams]", "Teams?");
  await seedElement(page, "#title", "Headline");
  await toggleCommenting(page);
  await expect(page.locator(".bub.in")).toHaveCount(2);
  expect(
    await page.locator(".bub").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual([
    "Comment on Heading · Answers in minutes, not meetings.: Headline",
    "Comment on Teams tile: Teams?",
  ]);
  const bubble = page.getByRole("button", { name: "Comment on Teams tile: Teams?" });
  await bubble.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(bubble).toBeFocused();
});

test("closed column threads open from their button, in page order; Esc returns to the button", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p2", "second designer", "Why wait?");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await toggleCommenting(page);
  const buttons = page.locator(".th .opn");
  await expect(buttons).toHaveCount(2);
  expect(await buttons.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
    "Open thread: Is 20% realistic?, 0 replies",
    "Open thread: Why wait?, 0 replies",
  ]);
  const first = page.getByRole("button", { name: "Open thread: Is 20% realistic?, 0 replies" });
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".th.on")).toContainText("Is 20% realistic?");
  await expect(page.locator(".th.on .rbox textarea")).toBeFocused();
  await expect(page.locator(".th.on .opn")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".th.on")).toHaveCount(0);
  await expect(first).toBeFocused();
});

test("the empty draft's hidden Send button takes no Tab stop", async ({ page }) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  await page.locator("#card").click();
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.press("Tab");
  expect((await focusInPipeup(page)).cls).not.toContain("send");
  await draftLine(page).fill("Words");
  await expect(page.locator(".pop.show .send")).not.toHaveAttribute("inert", "");
});

test("sending a reply with the Send button keeps focus in the reply line", async ({ page }) => {
  await open(page, "controls.html");
  await seedElement(page, "#title", "Headline");
  await toggleCommenting(page);
  await page.getByRole("button", { name: /Comment on Heading/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
  await page.keyboard.type("A reply");
  await page.keyboard.press("Tab");
  await expect(page.locator(".pop.show .send")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .rbox textarea")).toBeFocused();
});

test("Resolve on a thread opened from the cursor puts focus back on the marker", async ({ page }) => {
  await open(page, "doc.html");
  await seedElement(page, "#p1", "On the paragraph");
  await shortcut(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Enter");
  await expect(page.locator(".th.on")).toContainText("On the paragraph");
  await page.getByRole("button", { name: "Resolve" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".th.on")).toHaveCount(0);
  await expect(page.locator(".km:not([inert])")).toBeFocused();
});

test("a column thread that moves in the order keeps its focus", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p2", "second designer", "Why wait?");
  await toggleCommenting(page);
  const second = page.getByRole("button", { name: "Open thread: Why wait?, 0 replies" });
  await second.focus();
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(page.locator(".th .opn")).toHaveCount(2);
  await expect(page.locator(".th .opn").nth(1)).toHaveAttribute("aria-label", /Why wait/);
  await expect(second).toBeFocused();
});

test("Resolve on a thread opened from a bubble puts focus on the Comment control", async ({ page }) => {
  await open(page, "controls.html");
  await seedElement(page, "#title", "Headline");
  await toggleCommenting(page);
  await page.getByRole("button", { name: /Comment on Heading/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Resolve" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".launch .mode")).toBeFocused();
});

test("a selection made without the mouse shows its icon once it settles, is said once, and Enter comments on it", async ({
  page,
}) => {
  await open(page, "doc.html");
  // Comment mode with no block cursor out.
  await toggleCommenting(page);
  await commenting(page);
  // Focus is on the page, as with caret browsing (closing the menu left it on the Comment control).
  await page.evaluate(() =>
    (document.querySelector("pipeup-root")!.shadowRoot!.activeElement as HTMLElement).blur(),
  );
  /** Selects `words` in #p1 by script: no mouseup or keyup, as caret browsing or a screen reader would. */
  const select = (words: string) =>
    page.evaluate((words) => {
      const text = document.querySelector("#p1")!.firstChild as Text;
      const i = text.data.indexOf(words);
      getSelection()!.setBaseAndExtent(text, i, text, i + words.length);
    }, words);
  await select("onboarding");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  await expect(said(page)).toHaveText("Enter comments on the selected words");
  await said(page).evaluate((el) => (el.textContent = ""));
  await select("onboarding flow");
  await page.waitForTimeout(400);
  await expect(said(page)).toHaveText("");
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(page.locator(".draft .ctx")).toHaveText("\u201conboarding flow\u201d");
});

test("Pin on the bar starts a pin draft at the block's centre; with a block draft open it keeps the words", async ({
  page,
}) => {
  await open(page, "controls.html");
  await shortcut(page);
  const pin = page.getByRole("group", { name: "Chosen block" }).getByRole("button", { name: "Pin" });
  await pin.focus();
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(page.locator(".pop.show .draft .ctx")).toHaveText(
    "Pin on heading \u00b7 Answers in minutes, not meetings.",
  );
  const ghost = page.locator(".bub.ghost.in");
  await expect(ghost).toHaveCount(1);
  await settled(ghost);
  const [g, t] = [await ghost.boundingBox(), await page.locator("#title").boundingBox()];
  // The pin's point (its bottom left corner) is the block's centre.
  expect(Math.abs(g!.x + 2 - (t!.x + t!.width / 2))).toBeLessThan(3);
  expect(Math.abs(g!.y + g!.height - (t!.y + t!.height / 2))).toBeLessThan(3);
  await page.keyboard.press("Escape");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "title" });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Words");
  await pin.focus();
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(draftLine(page)).toHaveValue("Words");
  await expect(page.locator(".pop.show .draft .ctx")).toHaveText(
    "Pin on heading \u00b7 Answers in minutes, not meetings.",
  );
  await expect(said(page)).toHaveText("Pin on heading \u00b7 Answers in minutes, not meetings.");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => cursorOn(page))
    .toMatchObject({ block: "title", label: "Heading, 1 of 8, has 1 comment" });
  expect(await page.evaluate(() => (window as any).pu.document.threads()[0].anchor.point)).toEqual({
    x: 0.5,
    y: 0.5,
  });
});

test("a new selection after the last was cleared is said again, once", async ({ page }) => {
  await open(page, "doc.html");
  // Comment mode with no block cursor out.
  await toggleCommenting(page);
  await commenting(page);
  const select = (words: string) =>
    page.evaluate((words) => {
      const text = document.querySelector("#p1")!.firstChild as Text;
      const i = text.data.indexOf(words);
      getSelection()!.setBaseAndExtent(text, i, text, i + words.length);
    }, words);
  await select("onboarding");
  await expect(said(page)).toHaveText("Enter comments on the selected words");
  await page.evaluate(() => getSelection()!.removeAllRanges());
  await expect(page.locator(".selbar.show")).toHaveCount(0);
  await said(page).evaluate((el) => (el.textContent = ""));
  await select("pricing");
  await expect(said(page)).toHaveText("Enter comments on the selected words");
});

test("a mouse drag that pauses is not a settled selection until the button is released", async ({ page }) => {
  await open(page, "doc.html");
  // Comment mode with no block cursor out.
  await toggleCommenting(page);
  await commenting(page);
  const [a, b] = await page.evaluate(() => {
    const text = document.querySelector("#p1")!.firstChild as Text;
    const at = (i: number) => {
      const r = document.createRange();
      r.setStart(text, i);
      r.setEnd(text, i + 1);
      const q = r.getBoundingClientRect();
      return { x: q.left + 1, y: q.top + q.height / 2 };
    };
    const i = text.data.indexOf("onboarding");
    return [at(i), at(i + 10)];
  });
  await said(page).evaluate((el) => (el.textContent = ""));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.waitForTimeout(500);
  await expect(page.locator(".selbar.show")).toHaveCount(0);
  await expect(said(page)).toHaveText("");
  await page.mouse.up();
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  await expect(said(page)).toHaveText("");
});

test("Enter on a focused link does what the page expects, even with a settled selection", async ({
  page,
}) => {
  await open(page, "doc.html");
  // Comment mode with no block cursor out.
  await toggleCommenting(page);
  await commenting(page);
  await page.evaluate(() => {
    const text = document.querySelector("#p1")!.firstChild as Text;
    const i = text.data.indexOf("onboarding");
    getSelection()!.setBaseAndExtent(text, i, text, i + 10);
  });
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  await page.evaluate(() => (document.querySelector("a[href='#risks']") as HTMLElement).focus());
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#risks");
  await expect(page.locator(".draft")).toHaveCount(0);
});

test("the control's name says when comment mode is on", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, 1 open");
  await shortcut(page);
  await expect(control(page)).toHaveAttribute("aria-label", "Comment, comment mode on, 1 open");
});

/** The focused marker as the browser's accessibility tree has it (Playwright's own names don't follow element references). */
async function axCursor(page: Page): Promise<{ role: string; name: string; description: string }> {
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: 'document.querySelector("pipeup-root").shadowRoot.activeElement',
  });
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
    objectId: result.objectId!,
    fetchRelatives: false,
  });
  const n = nodes[0]!;
  return {
    role: String(n.role?.value ?? ""),
    name: String(n.name?.value ?? ""),
    description: String(n.description?.value ?? ""),
  };
}

test("screen readers hear the cursor's place and the block's own words: short blocks in the name, long ones as the description", async ({
  page,
}) => {
  await open(page, "doc.html");
  await page.evaluate(() =>
    document
      .querySelector("#p2")!
      .insertAdjacentHTML(
        "afterend",
        '<img id="pic" alt="Revenue by month" width="120" height="60" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
      ),
  );
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  // The first landing also says how to move and how to leave.
  expect(await axCursor(page)).toEqual({
    role: "button",
    name: "Heading, 1 of 9 Q3 plan",
    description:
      "Tab moves between blocks · ↑ ↓ change level · Enter comments · Esc to finish · F7 selects text",
  });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const p2 = await axCursor(page);
  expect(p2.name).toBe(
    "Paragraph, 3 of 9 The team stays at six people through the end of the quarter. Hiring a second designer moves to Q4.",
  );
  expect(p2.description).toBe("");
  await page.keyboard.press("Tab");
  expect((await axCursor(page)).name).toBe("Image, 4 of 9 Revenue by month");
  await page.keyboard.press("ArrowUp");
  const article = await axCursor(page);
  expect(article.name).toBe("Block, 1 of 1 Q3 plan We will launch the new onboardi…");
  expect(article.description).toContain("Hiring a second designer moves to Q4.");
});

test("a whole keyboard session leaves the page's DOM untouched: no tabindex, id or aria written", async ({
  page,
}) => {
  await open(page, "doc.html");
  const html = () =>
    page.evaluate(() => {
      const copy = document.documentElement.cloneNode(true) as HTMLElement;
      copy.querySelector("pipeup-root")?.remove();
      return copy.outerHTML;
    });
  const before = await html();
  await page.evaluate(() => {
    const host = () => document.querySelector("pipeup-root");
    (window as any).changed = [];
    new MutationObserver((records) => {
      for (const r of records) if (!host()?.contains(r.target)) (window as any).changed.push(r.type);
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
  await shortcut(page);
  for (const key of ["Tab", "ArrowUp", "ArrowDown", "Enter"]) await page.keyboard.press(key);
  await page.keyboard.type("Fine");
  await page.keyboard.press("Enter");
  await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Paragraph, 2 of 8, has 1 comment" });
  for (const key of ["Shift+Enter", "Escape", "Escape", "Escape"]) await page.keyboard.press(key);
  await commenting(page, false);
  expect(await page.evaluate(() => (window as any).changed)).toEqual([]);
  expect(await html()).toBe(before);
});

test("in forced colours the cursor's focus and Pipeup's buttons draw with Highlight; with reduced motion the outline never glides", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await open(page, "doc.html");
  // The system's Highlight colour, as this browser resolves it.
  const highlight = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.cssText = "forced-color-adjust:none;color:Highlight";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  await shortcut(page);
  await expect(page.locator(".pick.kf")).toHaveCSS("border-top-width", "3px");
  await expect(page.locator(".pick.kf")).toHaveCSS("border-top-style", "solid");
  await expect(page.locator(".pick.kf")).toHaveCSS("border-top-color", highlight);
  // The draft's "add your name" link draws its focus with Highlight too.
  await page.keyboard.press("Enter");
  const name = page.locator(".draft .say button");
  await name.focus();
  await expect(name).toHaveCSS("outline-style", "solid");
  await expect(name).toHaveCSS("outline-width", "2px");
  await expect(name).toHaveCSS("outline-color", highlight);
  await draftLine(page).focus();
  await page.keyboard.press("Escape");
  await expect.poll(() => cursorOn(page)).not.toBeNull();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    await expect(page.locator(".pick.glide")).toHaveCount(0);
  }
  const around = page.getByRole("group", { name: "Chosen block" }).getByRole("button", { name: "Around it" });
  await around.focus();
  await expect(around).toHaveCSS("outline-style", "solid");
  await expect(around).toHaveCSS("outline-width", "2px");
  await expect(around).toHaveCSS("outline-color", highlight);
});

test.describe("Tab in comment mode, however it was turned on", () => {
  test("turned on with the mouse, the first Tab starts the cursor on the first block in view, Shift+Tab too", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await toggleCommenting(page);
    await commenting(page);
    expect(await cursorOn(page)).toBeNull();
    await expect(page.locator(".toast.show")).toContainText("Tab between blocks");
    await page.keyboard.press("Tab");
    await expect.poll(() => cursorOn(page)).toEqual({ label: "Heading, 1 of 8", block: "h1" });
    await page.keyboard.press("Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
    // Esc leaves comment mode, and focus goes to the Comment control.
    await page.keyboard.press("Escape");
    await commenting(page, false);
    await expect(control(page)).toBeFocused();
    await toggleCommenting(page);
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  });

  test("Tab from the open menu after Start commenting closes the menu and starts the cursor", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await control(page).click();
    await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
    await commenting(page);
    await expect(page.locator(".menu.show")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.locator(".menu.show")).toHaveCount(0);
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  });

  test("after a click and Esc out of the comment box, Tab carries on after the clicked block, Shift+Tab before it", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await shortcut(page);
    await page.keyboard.press("Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
    await page.locator("#p2").click();
    await expect(draftLine(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await commenting(page);
    await page.keyboard.press("Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 4 of 8" });
    await page.locator("#p2").click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
    // The page never heard Tab.
    expect(await page.evaluate(() => location.hash)).toBe("");
  });

  test("after a comment sent from a click, Tab still goes through the thread's own buttons", async ({
    page,
  }) => {
    await open(page, "doc.html", { name: "Sam" });
    await toggleCommenting(page);
    await page.locator("#p2").click();
    await page.keyboard.type("Looks right");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Reply" })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await cursorOn(page)).toBeNull();
  });

  test("the mouse moving onto another block takes the outline from the cursor; Tab carries on from there", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await shortcut(page);
    await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
    const p2 = (await page.locator("#p2").boundingBox())!;
    await page.mouse.move(p2.x + 20, p2.y + 5);
    await page.mouse.move(p2.x + 40, p2.y + 8);
    await expect.poll(() => cursorOn(page)).toBeNull();
    await page.keyboard.press("Tab");
    await expect.poll(() => cursorOn(page)).toMatchObject({ label: "Block, 4 of 8" });
  });

  test("blocks below the fold of a scrolling pane and inside inline component tags are still stops", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await page.evaluate(() => {
      document.querySelector("article")!.innerHTML = `
        <div style="height:200px;overflow-x:hidden;overflow-y:auto;border:1px solid #ccc">
          <p id="top" style="height:150px;margin:0">Top</p><p id="below" style="height:150px;margin:0">Below the fold</p>
        </div>
        <x-card><div><p id="inside">Inside a component tag</p></div></x-card>`;
    });
    await shortcut(page);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push((await cursorOn(page))?.block ?? "");
      await page.keyboard.press("Tab");
    }
    expect(seen).toEqual(expect.arrayContaining(["top", "below", "inside"]));
  });

  test("the cursor never stops on keys or words inside a line, icons inside a link, or what is clipped or takes no pointer", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await page.evaluate(() => {
      const div = document.createElement("div");
      div.innerHTML = `
        <p id="keys">Press <span style="display:inline-flex;gap:2px"><kbd style="border:1px solid #999">A</kbd><kbd style="border:1px solid #999">B</kbd></span> to start, <code style="background:#eee">npm i</code>.</p>
        <p id="links"><a id="gh" href="#gh"><svg width="20" height="20" aria-hidden="true"><rect width="20" height="20"/></svg>GitHub</a></p>
        <div id="show" data-pipeup-id="show" style="overflow:hidden;width:300px;height:80px;border:1px solid #ccc">
          <div style="display:flex;width:900px;pointer-events:none">
            <p style="width:300px;margin:0;background:#eef">One</p><p style="width:300px;margin:0;background:#fee">Two</p>
          </div>
        </div>`;
      document.querySelector("article")!.append(div);
    });
    await shortcut(page);
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      await expect.poll(() => cursorOn(page)).not.toBeNull();
      seen.push((await cursorOn(page))!.block);
    }
    expect(seen).toContain("keys");
    expect(seen).toContain("gh");
    expect(seen).toContain("show");
    expect(seen.filter((b) => ["kbd", "span", "code", "svg", "rect"].includes(b))).toEqual([]);
  });
});

test("Tab from the block cursor closes the empty comment box left open, as a click elsewhere does", async ({
  page,
}) => {
  await open(page, "controls.html");
  await shortcut(page);
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await leaveReply(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(".pop.show")).toHaveCount(0);
});
