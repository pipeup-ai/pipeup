import { expect, test, type Page } from "@playwright/test";
import { SHORTCUT } from "../src/ui/shortcut";
import {
  commenting,
  control,
  leaveReply,
  open,
  seedElement,
  seedText,
  selectWords,
  settled,
  openMenu,
  showComments,
  toggleCommenting,
} from "./helpers";

const fired = (page: Page) => page.evaluate(() => (window as any).fired as string[]);
async function commentMode(page: Page): Promise<void> {
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 790);
}
type Box = { x: number; y: number; width: number; height: number };
/** The outline's box without its 4px padding, once it has stopped gliding. */
async function outlined(page: Page): Promise<Box> {
  const o = page.locator(".pick.show");
  await expect(o).toHaveCount(1);
  await settled(o);
  const b = (await o.boundingBox())!;
  return { x: b.x + 4, y: b.y + 4, width: b.width - 8, height: b.height - 8 };
}
const near = (a: Box, b: Box) =>
  [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every((d) => Math.abs(d) < 2);
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

test("the shortcut enters comment mode and Escape leaves; the menu's Comment item toggles it", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page);
  await expect(page.locator(".toast.show")).toContainText("Esc to finish");
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await toggleCommenting(page);
  await commenting(page);
  await toggleCommenting(page);
  await commenting(page, false);
});

test("the shortcut typed in a page textarea types its character and doesn't toggle comment mode", async ({
  page,
}) => {
  await open(page, "controls.html");
  await page.evaluate(() =>
    document.body.append(Object.assign(document.createElement("textarea"), { id: "ta" })),
  );
  await page.locator("#ta").focus();
  await page.evaluate(() => {
    (window as any).prevented = null;
    document.addEventListener(
      "keydown",
      (e) => setTimeout(() => ((window as any).prevented = e.defaultPrevented)),
      {
        once: true,
      },
    );
  });
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  // Option+Shift+C types "Ç" on a Mac. Playwright's synthetic keys insert no text with Alt held, so the proof
  // that the character goes in is that Pipeup leaves the keydown unprevented.
  await expect.poll(() => page.evaluate(() => (window as any).prevented)).not.toBeNull();
  expect(await page.evaluate(() => (window as any).prevented)).toBe(false);
  await commenting(page, false);
});

test("with comments hidden on load, the shortcut and Start commenting both start comment mode and show them", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a real number");
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page);
  await expect(page.locator(".layer.hidden")).toHaveCount(0);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page, false);
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  // Start commenting is never unavailable.
  await openMenu(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await commenting(page);
});

test("in comment mode nothing on the page fires, submits or navigates", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").click();
  await page.locator("#cta").click();
  await page.locator("#join").click();
  await page.locator("#email").click();
  await page.locator("#card").hover();
  expect(await fired(page)).toEqual([]);
  expect(page.url()).toMatch(/controls\.html$/);
  await expect(page.locator("#email")).not.toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await page.locator("#go").click();
  expect(await fired(page)).toContain("go");
});

test("areas marked to ignore keep working in comment mode", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#nav-btn").click();
  expect(await fired(page)).toEqual(["nav"]);
});

test("the outline finds the obvious block: a button, a marked tile, a card around plain text", async ({
  page,
}) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").hover();
  expect(near(await outlined(page), await box(page, "#go"))).toBe(true);
  await page.locator("#mrr").hover();
  expect(near(await outlined(page), await box(page, "[data-pipeup-id=tile-mrr]"))).toBe(true);
  await page.locator("#inner").hover();
  expect(near(await outlined(page), await box(page, "#card"))).toBe(true);
});

test("the outline glides between blocks instead of jumping", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").hover();
  await outlined(page);
  await page.locator("#mrr").hover();
  const gliding = await page
    .locator(".pick.show")
    .evaluate((el) => el.getAnimations().some((a) => a.playState === "running"));
  expect(gliding).toBe(true);
});

test("very large containers are never outlined", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#far").hover();
  await expect(page.locator(".pick.show")).toHaveCount(0);
});

test("clicking chooses a block: the outline stays on it while the pointer moves on", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").click();
  await expect(page.locator(".pick.on")).toHaveCount(1);
  await page.locator("#mrr").hover();
  expect(near(await outlined(page), await box(page, "#go"))).toBe(true);
});

test("selecting text still offers the comment icon in comment mode", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await selectWords(page, "#title", "in minutes");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
});

test("entering comment mode closes an open thread; Escape steps back one level at a time", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a real number");
  // A thread opened from All comments (comments show while it is open).
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page
    .locator(".all.show")
    .getByRole("menuitem", { name: /Use a real number/ })
    .click();
  await expect(page.locator(".pop.show")).toHaveCount(1);
  // The cursor is in the reply line, where shortcuts stay quiet: the reader steps out first.
  await leaveReply(page);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page);
  await page.mouse.move(5, 790);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.locator("#go").click();
  await expect(page.locator(".pick.on")).toHaveCount(1);
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show")).toHaveCount(1);
  await page.mouse.click(5, 790);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.locator("#go").click();
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show")).toHaveCount(1);
  // Opening a thread took the draft's place, and the block it was on let go with it.
  await expect(page.locator(".pick.on")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await commenting(page);
  await page.keyboard.press("Escape");
  await commenting(page, false);
});

test("with the menu open in comment mode, Escape closes only the menu", async ({ page }) => {
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").click();
  await openMenu(page);
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(page.locator(".pick.on")).toHaveCount(1);
  await commenting(page);
});

test("c typed in Pipeup's own reply line types c", async ({ page }) => {
  await open(page, "controls.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=tile-mrr]", "Use a real number");
  await page.locator(".bub.in").click();
  const reply = page.locator(".pop.show .rbox.always textarea");
  await reply.press("c");
  await expect(reply).toHaveValue("c");
  await commenting(page);
  await reply.press("Shift+Alt+KeyC");
  await commenting(page);
});

/** Fires a touch, a drag and a right-click at the page, as a phone or a mouse would. */
async function touchDragAndMenu(page: Page): Promise<void> {
  await page.locator("#card").click({ button: "right" });
  await page.evaluate(() => {
    const card = document.getElementById("card")!;
    const t = new Touch({ identifier: 1, target: card, clientX: 400, clientY: 300 });
    card.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t], changedTouches: [t] }),
    );
    document
      .getElementById("cta")!
      .dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true }));
  });
}

test("in comment mode the page's context menus, touches and drags don't fire; afterwards they do", async ({
  page,
}) => {
  await open(page, "controls.html");
  await commentMode(page);
  await touchDragAndMenu(page);
  await page.locator("#cta").dragTo(page.locator("#card"));
  expect(await fired(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await touchDragAndMenu(page);
  expect(await fired(page)).toEqual(expect.arrayContaining(["menu", "touch", "drag"]));
});

test("with reduced motion the outline fades out before it moves, never moving while visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html");
  await commentMode(page);
  await page.locator("#go").hover();
  expect(near(await outlined(page), await box(page, "#go"))).toBe(true);
  // Each time the outline moves, note how visible it was at that moment.
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".pick") as HTMLElement;
    let at = `${el.style.left},${el.style.top}`;
    w.moves = [];
    w.watch = new MutationObserver(() => {
      const now = `${el.style.left},${el.style.top}`;
      if (now !== at) w.moves.push(Number(getComputedStyle(el).opacity));
      at = now;
    });
    w.watch.observe(el, { attributes: true, attributeFilter: ["style"] });
  });
  await page.locator("#mrr").hover();
  await expect
    .poll(async () => near(await outlined(page), await box(page, "[data-pipeup-id=tile-mrr]")))
    .toBe(true);
  const moves = await page.evaluate(() => {
    const w = window as any;
    w.watch.disconnect();
    return w.moves as number[];
  });
  expect(moves.length).toBeGreaterThan(0);
  for (const opacity of moves) expect(opacity).toBe(0);
});

test("in comment mode a highlight previews and opens its thread, and shows nothing while a comment is written", async ({
  page,
}) => {
  await open(page, "controls.html");
  await seedText(page, "#title", "in minutes", "Tighten this");
  const spot = await page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  // Comments are hidden outside comment mode: nothing to preview.
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(100);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  await page.mouse.move(5, 790);
  await commentMode(page);
  // Comments only show in comment mode, so their highlights preview and open there.
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator(".tip.show")).toHaveCount(1);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator(".pop.show")).toContainText("Tighten this");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  // While a comment with words in it is being written, a highlight neither previews nor takes the click:
  // the same rule for both.
  await page.locator("#go").click();
  const box = page.locator(".pop.show .draft").getByRole("textbox", { name: "Comment" });
  await box.fill("Half a thought");
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(100);
  await expect(page.locator(".tip.show")).toHaveCount(0);
  await page.mouse.click(spot.x, spot.y);
  await expect(box).toHaveValue("Half a thought");
  await expect(page.locator(".pop.show")).not.toContainText("Tighten this");
  // An empty one takes neither: the highlight previews again.
  await box.fill("");
  await page.mouse.move(5, 790);
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator(".tip.show")).toHaveCount(1);
});

test("the shortcut on a focused menu item enters comment mode and closes the menu", async ({ page }) => {
  await open(page, "controls.html");
  await control(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page);
  await expect(page.locator(".menu.show")).toHaveCount(0);
});

test("a page shortcut that takes the same keys wins over comment mode", async ({ page }) => {
  await open(page, "controls.html");
  await page.evaluate(() =>
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyC") e.preventDefault();
    }),
  );
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await expect(page.locator(".toast.show")).toHaveCount(0);
  await commenting(page, false);
});

/** Drags the mouse across `words` inside `selector`, as a reader selecting them would (press, move, release). */
async function dragAcross(page: Page, selector: string, words: string): Promise<void> {
  const { from, to } = await page.evaluate(
    ({ selector, words }) => {
      const el = document.querySelector(selector)!;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        const i = n.data.indexOf(words);
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + words.length);
        const rects = [...r.getClientRects()];
        const a = rects[0]!;
        const b = rects[rects.length - 1]!;
        return {
          from: { x: a.left + 1, y: a.top + a.height / 2 },
          to: { x: b.right - 1, y: b.top + b.height / 2 },
        };
      }
      throw new Error(`"${words}" not found`);
    },
    { selector, words },
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test("in comment mode, dragging selects text inside tabindex=-1, details and label wrappers", async ({
  page,
}) => {
  await open(page, "wrapped.html");
  await commentMode(page);
  for (const [selector, words] of [
    ["#intro", "reads your documents"],
    ["#faq", "indexes each page"],
    ["#consent", "occasional product"],
  ] as const) {
    await dragAcross(page, selector, words);
    expect(await page.evaluate(() => getSelection()!.toString())).toContain(words);
    await expect(page.locator(".selbar.show")).toHaveCount(1);
    await page.evaluate(() => getSelection()!.removeAllRanges());
    await expect(page.locator(".selbar.show")).toHaveCount(0);
  }
  // A press on a real control is still kept from focusing it.
  await page.locator("#consent input").click();
  await expect(page.locator("#consent input")).not.toBeFocused();
  await expect(page.locator("#consent input")).not.toBeChecked();
});

test("after the layout switches to bubbles in comment mode, a click on a highlight opens its thread and picks no block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await commentMode(page);
  await expect(page.locator(".col")).toHaveCount(1);
  // Crossing the breakpoint rebuilds the comment views while comment mode stays on.
  await page.setViewportSize({ width: 760, height: 800 });
  await expect(page.locator(".col")).toHaveCount(0);
  await commenting(page);
  // Note every draft or chosen block that ever appears.
  await page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    const w = window as any;
    w.__picked = 0;
    new MutationObserver(() => {
      if (root.querySelector(".draft, .pick.on")) w.__picked++;
    }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });
  const at = await page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + 4, y: q.top + q.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".pop.show")).toContainText("Is 20% realistic?");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__picked)).toBe(0);
  await commenting(page);
});
