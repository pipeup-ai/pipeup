import { expect, test, type Page } from "@playwright/test";
import {
  control,
  focusInPipeup,
  HOLD_KEY,
  open,
  openAll,
  openMenu,
  quoteSpot,
  seedText,
  showComments,
  toggleCommenting,
} from "./helpers";

// From the click-path review of 0.8.0-beta.2: Tab from a comment box moves on, typed words are never lost unless
// the reviewer throws them away (with Undo), keys Pipeup acts on stay with it, and focus never drops to the page.

const shortcut = (page: Page) => page.keyboard.press("Shift+Alt+KeyC");
const draftLine = (page: Page) => page.locator(".draft").getByRole("textbox", { name: "Comment" });

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

/** Records the keys the page hears, going down and coming up. */
const hearKeys = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    w.heard = [];
    for (const t of ["keydown", "keyup"])
      document.addEventListener(t, (e) => w.heard.push(`${t}:${(e as KeyboardEvent).key}`));
  });
const heard = (page: Page) => page.evaluate(() => (window as any).heard as string[]);

test("Tab from an empty comment box closes it and moves the cursor to the next block in one press; Shift+Tab to the one before", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".draft")).toHaveCount(0);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".draft")).toHaveCount(0);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
});

test("a box with words: Tab goes through Cancel and Comment, then on to the next block; the box waits beside its block, and Enter elsewhere goes back to it", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Meant for the title");
  await page.keyboard.press("Tab");
  expect((await focusInPipeup(page)).text).toBe("Cancel");
  await page.keyboard.press("Tab");
  expect((await focusInPipeup(page)).text).toBe("Comment");
  // On, not to the naming bar, a bubble or the comment control.
  await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  // The box waits with its words, dimmed, and its block keeps a faint outline.
  await expect(draftLine(page)).toHaveValue("Meant for the title");
  await expect(page.locator(".draft")).toHaveClass(/\bwait\b/);
  await expect(page.locator(".pkw.show")).toHaveCount(1);
  // Enter on another block goes back to the waiting box, and says so.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(draftLine(page)).toBeFocused();
  await expect(page.locator(".toast.show")).toContainText("Finish or cancel this comment first");
  await expect(page.locator(".pkw.show")).toHaveCount(0);
  await expect(page.locator(".namebar.show")).toContainText("Q3 plan");
  // It is sent to the block it was written on, and the cursor is back there.
  await page.keyboard.press("Enter");
  await expect
    .poll(() => cursorOn(page))
    .toMatchObject({ block: "h1", label: expect.stringContaining("1 comment") });
});

test("Esc away from a waiting box never throws its words away; Esc in the box does, with Undo", async ({
  page,
}) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keep these words");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "p1" });
  await page.keyboard.press("Escape");
  await expect(draftLine(page)).toHaveValue("Keep these words");
  // Back in the box, Esc throws them away, and Undo brings them back with the caret in the box.
  await draftLine(page).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".draft")).toHaveCount(0);
  const undo = page.locator(".toast.show").getByRole("button", { name: "Undo" });
  await expect(page.locator(".toast.show")).toContainText("Comment discarded");
  await undo.click();
  await expect(draftLine(page)).toHaveValue("Keep these words");
  await expect(draftLine(page)).toBeFocused();
});

test("clicking a second block moves an empty box there with the caret in it", async ({ page }) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.locator("#p1").click();
  await expect(draftLine(page)).toBeFocused();
  await page.locator("h2").click();
  await expect(page.locator(".namebar.show")).toContainText("Risks");
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.type("Typed");
  await expect(draftLine(page)).toHaveValue("Typed");
});

test("a box with words: a click on another block goes back to it, and says so", async ({ page }) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.locator("#p1").click();
  await page.keyboard.type("About the plan");
  await page.locator("h2").click();
  await expect(draftLine(page)).toBeFocused();
  await expect(draftLine(page)).toHaveValue("About the plan");
  await expect(page.locator(".toast.show")).toContainText("Finish or cancel this comment first");
});

test("a reply being written is kept when its pop-up closes, and when the window crosses into the column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  const line = page.locator(".pop.show .rbox textarea");
  await expect(line).toBeFocused();
  await page.keyboard.type("Half a thought");
  // A click elsewhere closes it; opening it again brings the words back.
  await page.mouse.click(700, 760);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.mouse.click(spot.x, spot.y);
  await expect(line).toHaveValue("Half a thought");
  // Wide enough for the column: the same thread opens there, with the same words.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".th.on .rbox textarea")).toHaveValue("Half a thought");
});

test("Esc in a reply with words throws them away first, with Undo; the thread stays open, and the next Esc closes it", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  const line = th.locator(".rbox textarea");
  await expect(line).toBeFocused();
  await page.keyboard.type("Not sure yet");
  await page.keyboard.press("Escape");
  await expect(line).toHaveValue("");
  await expect(th).toHaveClass(/\bon\b/);
  await expect(page.locator(".toast.show")).toContainText("Reply discarded");
  await page.locator(".toast.show").getByRole("button", { name: "Undo" }).click();
  await expect(line).toHaveValue("Not sure yet");
  await expect(line).toBeFocused();
  await line.fill("");
  await page.keyboard.press("Escape");
  await expect(th).not.toHaveClass(/\bon\b/);
});

test("a double-click on Delete deletes nothing: its second question ignores the click that asked it", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Delete" }).dblclick();
  await expect(th.getByRole("menuitem", { name: "Delete for everyone" })).toBeVisible();
  await expect(page.locator(".th")).toHaveCount(1);
});

test("from the keyboard, React and choosing an emoji keep focus on the card", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  const react = th.locator(".root").getByRole("button", { name: "React" });
  await react.focus();
  await page.keyboard.press("Enter");
  expect((await focusInPipeup(page)).cls).toContain("rxo");
  await page.keyboard.press("Enter");
  await expect(th.locator(".rx")).toHaveCount(1);
  await expect(react).toBeFocused();
});

test("a comment's ⋯ menu moves with the arrow keys, and Esc closes it (not the thread) with focus back on ⋯", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  const more = th.locator(".root").getByRole("button", { name: "More" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(th.getByRole("menuitem", { name: "Copy thread" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(th.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(th.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(th.locator(".pm")).toHaveCount(0);
  await expect(th).toHaveClass(/\bon\b/);
  await expect(more).toBeFocused();
});

test("resolving a thread from the keyboard moves focus to the next thread, never the page", async ({
  page,
}) => {
  // Outside comment mode (in it, focus goes back to the block cursor).
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Which pricing work?");
  const first = page.locator(".th", { hasText: "Is 20% realistic?" });
  await first.locator(".tx").first().click();
  await first.locator(".root").getByRole("button", { name: "Resolve" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".th", { hasText: "Is 20% realistic?" })).toHaveCount(0);
  await expect.poll(() => focusInPipeup(page)).toMatchObject({ cls: expect.stringContaining("opn") });
  expect(
    await page.evaluate(() =>
      document.querySelector("pipeup-root")!.shadowRoot!.activeElement!.getAttribute("data-thread"),
    ),
  ).toBe(await page.evaluate(() => (window as any).pu.document.threads()[1].id));
});

test("a closed card's hidden actions can't be pressed: a tap there opens the card", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.mouse.move(0, 0);
  const acts = page.locator(".th .root .acts");
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  await page.locator(".th").hover();
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("auto");
});

test("the line to a new comment in All comments goes when the panel closes", async ({ page }) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.locator("#p2").click();
  await control(page).click();
  await expect(page.locator(".all.show .draft")).toHaveCount(1);
  await expect(page.locator(".cx.show")).toHaveCount(1);
  await page.locator(".all.show").getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".all.show")).toHaveCount(0);
  await expect(page.locator(".cx.show")).toHaveCount(0);
});

test("letting go of Space brings the block cursor's outline back", async ({ page }) => {
  await open(page, "doc.html");
  await shortcut(page);
  await expect.poll(() => cursorOn(page)).toMatchObject({ block: "h1" });
  await expect(page.locator(".pick.show")).toHaveCount(1);
  await page.keyboard.down(HOLD_KEY);
  await expect(page.locator(".pick.show")).toHaveCount(0);
  await page.keyboard.up(HOLD_KEY);
  await expect(page.locator(".pick.show")).toHaveCount(1);
});

test("double-clicking words in comment mode selects them without opening a box on the paragraph", async ({
  page,
}) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  const p = await page.locator("#p1").evaluate((el) => {
    const r = document.createRange();
    const n = el.firstChild!;
    const i = n.textContent!.indexOf("onboarding");
    r.setStart(n, i);
    r.setEnd(n, i + 4);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  await expect(page.locator(".draft")).toHaveCount(0);
  // Esc clears the selection first; comment mode stays on.
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(true);
  await expect(control(page)).toHaveClass(/\bon\b/);
});

test("keys used in the menu never reach the page; ← and → on the comment control still do", async ({
  page,
}) => {
  await open(page, "doc.html");
  await hearKeys(page);
  await control(page).focus();
  await page.keyboard.press("ArrowRight");
  expect(await heard(page)).toEqual(["keydown:ArrowRight", "keyup:ArrowRight"]);
  await page.keyboard.press("Enter");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await page.evaluate(() => ((window as any).heard = []));
  await page.keyboard.press("ArrowUp");
  await page.getByRole("menuitem", { name: "Copy comments" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  expect(await heard(page)).toEqual([]);
});

test("the arrows move into a menu opened with the mouse", async ({ page }) => {
  await open(page, "doc.html");
  await openMenu(page);
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitemcheckbox", { name: /Start commenting/ })).toBeFocused();
});

test("what is typed in a comment box never reaches the page, going down or coming up", async ({ page }) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.locator("#p1").click();
  await hearKeys(page);
  await page.keyboard.type("a b");
  await expect(draftLine(page)).toHaveValue("a b");
  expect(await heard(page)).toEqual([]);
});

test("the Esc that leaves comment mode is Pipeup's: the page never hears it", async ({ page }) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.mouse.click(900, 700);
  await hearKeys(page);
  await page.keyboard.press("Escape");
  await expect(control(page)).not.toHaveClass(/\bon\b/);
  expect(await heard(page)).toEqual([]);
});

test("Esc on Copy comments' choices folds them before it closes the menu", async ({ page }) => {
  await open(page, "doc.html");
  await openMenu(page);
  const copy = page.getByRole("menuitem", { name: "Copy comments" });
  await copy.click();
  await expect(copy).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(copy).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
});

test("screen readers hear when a reply is sent", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.locator(".th .tx").first().click();
  await page.keyboard.type("Yes");
  await page.keyboard.press("Enter");
  await expect(page.locator("div.sr[aria-live]")).toHaveText("Reply sent");
});

test("in All comments, a thread resolved from the keyboard hands focus to the next row", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Which pricing work?");
  await openAll(page);
  const rows = page.locator(".all .cd");
  await rows.first().locator("button.mi").focus();
  await rows.first().getByRole("button", { name: "Resolve" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".all .cd")).toHaveCount(1);
  await expect.poll(() => focusInPipeup(page)).toMatchObject({ cls: expect.stringContaining("mi") });
});
