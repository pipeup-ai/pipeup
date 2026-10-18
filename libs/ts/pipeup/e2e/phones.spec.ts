import { expect, test, type Locator, type Page } from "@playwright/test";
import { control, focusInPipeup, open, seedElement, seedText } from "./helpers";

/** Phones held both ways, by touch: what Pipeup shows fits the screen, keeps clear of the control and suits a finger. */

type Box = { x: number; y: number; width: number; height: number };
const phone = (width: number, height: number) => ({
  viewport: { width, height },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

/** Everything of Pipeup's has stopped moving (a box easing in is still scaled down a little). */
const still = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector("pipeup-root")!
            .shadowRoot!.getAnimations()
            .filter((a) => a.playState === "running").length,
      ),
    )
    .toBe(0);
const boxOf = async (l: Locator): Promise<Box> => {
  await l.waitFor();
  await still(l.page());
  return (await l.boundingBox())!;
};
/** Wholly inside the window. */
const inWindow = (b: Box, page: Page) => {
  const vp = page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
};
/** The two boxes don't overlap. */
const apart = (a: Box, b: Box) =>
  a.x + a.width <= b.x + 0.5 ||
  b.x + b.width <= a.x + 0.5 ||
  a.y + a.height <= b.y + 0.5 ||
  b.y + b.height <= a.y + 0.5;

/** The smallest side of every visible match: what a finger has to hit. */
const sides = (l: Locator) =>
  l.evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[inert]");
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          name: e.getAttribute("aria-label") || e.textContent!.trim(),
          side: Math.min(r.width, r.height),
        };
      }),
  );
const fingerSized = async (l: Locator, atLeast = 1) => {
  await still(l.page());
  const s = await sides(l);
  expect(s.length).toBeGreaterThanOrEqual(atLeast);
  for (const t of s) expect(t.side, t.name).toBeGreaterThanOrEqual(44);
};

/** Taps a spot as a finger would. */
const tapAt = (page: Page, x: number, y: number) => page.touchscreen.tap(x, y);

/** Comment mode on from the menu by touch; a tap outside closes the menu (and in comment mode does only that). */
async function commentMode(page: Page): Promise<void> {
  await control(page).tap();
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
  await tapAt(page, 2, 2);
  await expect(page.locator(".menu.show")).toHaveCount(0);
}

/** The middle of the first highlighted words. */
const quoteAt = (page: Page) =>
  page.evaluate(() => {
    const r = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top, bottom: r.bottom };
  });

/** A finger resting on a spot for `ms`, then lifted (a long press). */
async function longPress(page: Page, l: Locator, ms = 700): Promise<void> {
  const b = (await l.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const at = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("a small phone (320 × 568)", () => {
  test.use(phone(320, 568));

  test("the naming bar fits the screen and every icon can be tapped; its words shorten first", async ({
    page,
  }) => {
    await open(page, "phone-site.html");
    await commentMode(page);
    for (const id of ["hero", "feature-save"]) {
      const block = (await page.locator(`[data-pipeup-id=${id}]`).boundingBox())!;
      await tapAt(page, block.x + 6, Math.max(block.y + 6, 40));
      const bar = page.locator(".namebar.show");
      await expect(bar).toBeVisible();
      inWindow(await boxOf(bar), page);
      await fingerSized(bar.locator(".nb:not([hidden])"), 2);
      // Pin is there, on screen, and a tap at its middle reaches it.
      const pin = bar.getByRole("button", { name: "Pin" });
      inWindow((await pin.boundingBox())!, page);
      const hit = await pin.evaluate((b) => {
        const r = b.getBoundingClientRect();
        return b.contains(
          (b.getRootNode() as ShadowRoot).elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      });
      expect(hit).toBe(true);
      await page.getByRole("button", { name: "Cancel" }).tap();
    }
  });

  test("a comment box on a block taller than the screen is never under the comment control", async ({
    page,
  }) => {
    await open(page, "phone-site.html");
    await commentMode(page);
    const hero = (await page.locator("[data-pipeup-id=hero]").boundingBox())!;
    await tapAt(page, hero.x + 6, hero.y + 40);
    const box = page.locator(".pop.show");
    await box.locator("textarea").fill("Too much space above the title?");
    const b = await boxOf(box);
    inWindow(b, page);
    expect(apart(b, (await control(page).boundingBox())!)).toBe(true);
    // Its Comment button takes a tap all the way to its right edge.
    const send = box.getByRole("button", { name: "Comment", exact: true });
    const hit = await send.evaluate((s) => {
      const r = s.getBoundingClientRect();
      return (s.getRootNode() as ShadowRoot).elementFromPoint(r.right - 3, r.y + r.height / 2) === s;
    });
    expect(hit).toBe(true);
    // The naming bar is on screen too, clear of the box.
    const bar = await boxOf(page.locator(".namebar.show"));
    inWindow(bar, page);
    expect(apart(bar, b)).toBe(true);
  });

  test("a thread opened from its bubble is never under the comment control", async ({ page }) => {
    await open(page, "phone-site.html");
    await seedElement(page, "[data-pipeup-id=hero]", "Too much space above the title?");
    await page.locator(".bub").first().tap();
    const pop = page.locator(".pop.show");
    await expect(pop).toContainText("Too much space");
    const b = await boxOf(pop);
    inWindow(b, page);
    expect(apart(b, (await control(page).boundingBox())!)).toBe(true);
  });

  test("bubbles at the window's edge are wholly on screen, with room for a finger round them", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await seedElement(page, "#p2", "Is this the plan?");
    const bub = page.locator(".bub").first();
    await expect(bub).toHaveClass(/\bin\b/);
    const b = await boxOf(bub);
    inWindow(b, page);
    // The finger's target is 44 px round the bubble's middle, all of it on screen.
    const middle = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    expect(middle.x + 22).toBeLessThanOrEqual(320);
    const reach = await bub.evaluate(
      (el, m) =>
        [
          [m.x - 20, m.y],
          [m.x + 20, m.y],
          [m.x, m.y - 20],
          [m.x, m.y + 20],
        ].map(([x, y]) => (el.getRootNode() as ShadowRoot).elementFromPoint(x!, y!) === el),
      middle,
    );
    expect(reach).toEqual([true, true, true, true]);
  });
});

test.describe("a phone (375 × 812)", () => {
  test.use(phone(375, 812));

  test("Pin waits for the next tap and drops the pin there; from the keyboard it still pins the centre", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await commentMode(page);
    await page.locator("[data-pipeup-id=q4-bar]").tap();
    const bar = page.locator(".namebar.show");
    await bar.getByRole("button", { name: "Pin" }).tap();
    // Nothing is pinned yet: the bar asks for the spot.
    await expect(bar).toContainText("Tap where to pin");
    await expect(page.locator(".pop.show .draft .ctx")).not.toContainText("Pin on");
    await expect(page.locator(".bub.ghost")).toHaveCount(0);
    // Where the browser says the finger landed (it may nudge a tap towards something to press).
    await page.evaluate(() =>
      window.addEventListener("click", (e) => ((window as any).tapped = { x: e.clientX, y: e.clientY }), {
        capture: true,
        once: true,
      }),
    );
    const p2 = (await page.locator("#p2").boundingBox())!;
    await tapAt(page, p2.x + 100, p2.y + p2.height / 2);
    await expect(page.locator(".pop.show .draft .ctx")).toContainText("Pin on paragraph");
    // The pin is where the finger was (its tail is at the spot).
    const spot = (await page.evaluate(() => (window as any).tapped)) as { x: number; y: number };
    const ghost = await boxOf(page.locator(".bub.ghost"));
    expect(Math.abs(ghost.x + 2 - spot.x)).toBeLessThan(3);
    expect(Math.abs(ghost.y + ghost.height - spot.y)).toBeLessThan(3);
    await page.getByRole("button", { name: "Cancel" }).tap();

    // From the keyboard, Pin pins the block's centre at once.
    await page.locator("[data-pipeup-id=q4-bar]").tap();
    await page.locator(".namebar.show").getByRole("button", { name: "Pin" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".pop.show .draft .ctx")).toContainText("Pin on Q4 bar");
  });

  test("comment mode's hint says how to use it by touch, waits for the menu, stays, and Done leaves in one tap", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await control(page).tap();
    await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
    // Nothing of Pipeup's covers it: it waits while the menu is open.
    await page.waitForTimeout(300);
    await expect(page.locator(".toast.show")).toHaveCount(0);
    await tapAt(page, 2, 2);
    const hint = page.locator(".toast.show");
    await expect(hint).toContainText("Tap what you want to comment on");
    await expect(hint).not.toContainText(/Tab|Option|Space|Esc|⇧⌥C|Shift\+Alt/);
    const h = await boxOf(hint);
    const c = (await control(page).boundingBox())!;
    expect(apart(h, c)).toBe(true);
    expect(h.x + h.width).toBeLessThanOrEqual(c.x);
    const done = hint.getByRole("button", { name: "Done" });
    await fingerSized(done);
    // It stays while comment mode is on, and a comment box opened meanwhile keeps clear of it.
    await page.waitForTimeout(4500);
    await expect(hint).toContainText("Tap what you want to comment on");
    await page.locator("#p3").tap();
    await expect(page.locator(".pop.show textarea")).toBeVisible();
    await expect(hint).toBeVisible();
    expect(apart(await boxOf(page.locator(".pop.show")), await boxOf(hint))).toBe(true);
    // Done: comment mode ends in one tap.
    await done.tap();
    await expect(control(page)).not.toHaveClass(/\bon\b/);
    await expect(page.locator(".toast.show")).toHaveCount(0);
    await expect(page.locator(".namebar.show")).toHaveCount(0);
  });

  test("on a touch-only screen the menu and the panel's footer show no keyboard shortcut", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await control(page).tap();
    const start = page.getByRole("menuitemcheckbox", { name: "Start commenting" });
    await expect(start).toBeVisible();
    expect(await start.innerText()).not.toMatch(/⇧⌥C|Shift\+Alt\+C/);
    await page.getByRole("menuitem", { name: /All comments/ }).tap();
    const sw = page.locator(".all.show").getByRole("switch", { name: /Comment/ });
    await expect(sw).toBeVisible();
    expect(await sw.innerText()).not.toMatch(/⇧⌥C|Shift\+Alt\+C/);
  });

  test("everything a finger presses is at least 44 px across", async ({ page }) => {
    await open(page, "phone.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await commentMode(page);
    // A new comment: its naming bar, who you are (the avatar and "add your name"), Cancel and Comment.
    await page.locator("#p2").tap();
    await fingerSized(page.locator(".namebar.show .nb:not([hidden])"), 2);
    const draft = page.locator(".pop.show .draft");
    await fingerSized(draft.locator("button.me, .say button"), 2);
    await draft.locator("textarea").fill("Six is tight.");
    await fingerSized(draft.locator(".bts button"), 2);
    await draft.getByRole("button", { name: "Cancel" }).tap();
    // The selection's comment icon.
    await page.evaluate(() => {
      const t = document.querySelector("#p3")!.firstChild!;
      const r = document.createRange();
      r.setStart(t, 10);
      r.setEnd(t, 30);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(r);
    });
    await expect(page.locator(".selbar.show")).toHaveCount(1);
    await fingerSized(page.locator(".selbar.show button"));
    await page.evaluate(() => getSelection()!.removeAllRanges());
    // A thread: its actions, React's quick row, a reaction and the ⋯ menu.
    const q = await quoteAt(page);
    await tapAt(page, q.x, q.y);
    const pop = page.locator(".pop.show");
    await expect(pop).toContainText("Is this the plan?");
    await fingerSized(pop.locator(".acts .ib"), 3);
    await pop.getByRole("button", { name: "React" }).tap();
    await fingerSized(pop.locator(".rxo"), 6);
    await pop.locator(".rxo", { hasText: "👍" }).tap();
    await fingerSized(pop.locator(".rx"));
    await pop.getByRole("button", { name: "More" }).first().tap();
    await fingerSized(pop.locator(".pm button"), 1);
    // All comments: its filters, Close, and the footer's switch and ⋯.
    await control(page).tap();
    const all = page.locator(".all.show");
    await expect(all).toBeVisible();
    await fingerSized(all.locator(".hd button"), 3);
    await fingerSized(all.locator(".pf button"), 2);
  });

  test("opening a thread by touch leaves the reply box to be tapped, so no keyboard rises", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    const q = await quoteAt(page);
    await tapAt(page, q.x, q.y);
    await expect(page.locator(".pop.show")).toContainText("Is this the plan?");
    expect((await focusInPipeup(page)).tag).not.toBe("TEXTAREA");
    // Tapped, it takes the words.
    await page.locator(".pop.show textarea").tap();
    expect((await focusInPipeup(page)).tag).toBe("TEXTAREA");
    // In All comments too: the thread moves in open, and opens again from its card, with no keyboard either time.
    await page.locator(".pop.show textarea").blur();
    await control(page).tap();
    await page.getByRole("menuitem", { name: /All comments/ }).tap();
    const opened = page.locator(".all.show .cd.open");
    await expect(opened).toContainText("Is this the plan?");
    expect((await focusInPipeup(page)).tag).not.toBe("TEXTAREA");
    await opened.locator(".who").first().tap();
    await expect(opened).toHaveCount(0);
    await page.locator(".all.show .mi").first().tap();
    await expect(opened).toContainText("Is this the plan?");
    expect((await focusInPipeup(page)).tag).not.toBe("TEXTAREA");
  });

  test("the selection's comment icon sits at the window's right edge, level with the words: the phone's own menu goes above or below them", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await commentMode(page);
    const sel = await page.evaluate(() => {
      const t = document.querySelector("#p1")!.firstChild!;
      const i = t.textContent!.indexOf("pricing changes");
      const r = document.createRange();
      r.setStart(t, i);
      r.setEnd(t, i + "pricing changes".length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(r);
      const b = r.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    });
    const icon = page.locator(".selbar.show");
    await expect(icon).toHaveCount(1);
    const b = await boxOf(icon);
    expect(b.y).toBeLessThan(sel.bottom);
    expect(b.y + b.height).toBeGreaterThan(sel.top);
    expect(b.x + b.width).toBeGreaterThan(page.viewportSize()!.width - 8);
    inWindow(b, page);
  });

  test("a long press on a reaction says who gave it, and leaves the reaction be", async ({ page }) => {
    await open(page, "phone.html", { name: "Sam" });
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    const q = await quoteAt(page);
    await tapAt(page, q.x, q.y);
    const pop = page.locator(".pop.show");
    await pop.getByRole("button", { name: "React" }).tap();
    await pop.locator(".rxo", { hasText: "👍" }).tap();
    const chip = pop.locator(".rx").first();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    const names = chip.locator(".rc");
    await expect(names).toBeHidden();
    await longPress(page, chip);
    await expect(names).toBeVisible();
    await expect(names).toHaveText("You");
    // Seen, not just there: nothing clips it or is drawn over it (it takes no taps, so it is asked for a moment).
    await still(page);
    const onTop = await names.evaluate((rc: HTMLElement) => {
      const r = rc.getBoundingClientRect();
      rc.style.pointerEvents = "auto";
      const top = (rc.getRootNode() as ShadowRoot).elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      rc.style.pointerEvents = "";
      return Number(getComputedStyle(rc).opacity) === 1 && top === rc;
    });
    expect(onTop).toBe(true);
    // Still given: the long press took nothing back.
    await expect(pop.locator(".rx").first()).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(() => (window as any).pu.document.threads()[0].root.reactions[0].by.length),
    ).toBe(1);
    // The next touch puts the names away.
    await tapAt(page, 2, 2);
    await expect(names).toBeHidden();
  });

  test("on a phone, an open card in All comments keeps where it is, and a comment moved there keeps what it's on", async ({
    page,
  }) => {
    await open(page, "phone-site.html");
    await seedElement(page, "[data-pipeup-id=feature-listen]", "Which voices?");
    await control(page).tap();
    await page.getByRole("menuitem", { name: /All comments/ }).tap();
    const card = page.locator(".all.show .cd").first();
    await expect(card.locator(".ctx")).toContainText("Listen");
    await page.locator(".all.show .mi").first().tap();
    const opened = page.locator(".all.show .cd.open");
    await expect(opened).toContainText("Which voices?");
    await expect(opened.locator(".ctx")).toBeVisible();
    await expect(opened.locator(".ctx")).toContainText("Listen");
    await page.locator(".all.show").getByRole("button", { name: "Close" }).tap();

    // A comment being written moves into the panel with what it is on.
    await commentMode(page);
    await page.locator("#readers").tap();
    await page.locator(".pop.show textarea").fill("Is 63% right?");
    await control(page).tap();
    const moved = page.locator(".all.show .cd.new");
    await expect(moved.locator("textarea")).toHaveValue("Is 63% right?");
    await expect(moved.locator(".ctx")).toBeVisible();
    await expect(moved.locator(".ctx")).toContainText("48k weekly readers");
  });

  test("messages keep clear of the finger-sized comment control", async ({ page }) => {
    await open(page, "phone.html");
    await seedElement(page, "#p2", "Is this the plan?");
    await page.locator(".bub").first().tap();
    await page.locator(".pop.show").getByRole("button", { name: "Resolve", exact: true }).tap();
    const toast = page.locator(".toast.show");
    await expect(toast).toContainText("Resolved");
    const t = await boxOf(toast);
    const c = (await control(page).boundingBox())!;
    expect(apart(t, c)).toBe(true);
    expect(t.x + t.width).toBeLessThanOrEqual(c.x - 4);
  });

  test("turning the phone with a thread open brings the thread and its words back into view", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await seedText(page, "#p3", "the pricing work slips", "Which month?");
    const q = await quoteAt(page);
    await tapAt(page, q.x, q.y);
    const pop = page.locator(".pop.show");
    await expect(pop).toContainText("Which month?");
    await pop.locator("textarea").fill("August, I think");
    await page.setViewportSize({ width: 812, height: 375 });
    // The words it is about, wherever the turn left them.
    const words = () =>
      page.evaluate(() => {
        const t = document.querySelector("#p3")!.firstChild!;
        const i = t.textContent!.indexOf("the pricing work slips");
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + "the pricing work slips".length);
        const b = r.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= innerHeight;
      });
    await expect.poll(words).toBe(true);
    await page.waitForTimeout(500);
    inWindow(await boxOf(pop), page);
    inWindow((await pop.locator("textarea").boundingBox())!, page);
    await expect(pop.locator("textarea")).toHaveValue("August, I think");
  });
});

test.describe("a phone on its side (568 × 320)", () => {
  test.use(phone(568, 320));

  test("the menu fits the window, and scrolls when Copy comments opens", async ({ page }) => {
    await open(page, "phone.html");
    await control(page).tap();
    const menu = page.locator(".menu.show");
    const m = await boxOf(menu);
    inWindow(m, page);
    const c = (await control(page).boundingBox())!;
    expect(m.y + m.height).toBeLessThanOrEqual(c.y);
    await page.getByRole("menuitem", { name: "Copy comments" }).tap();
    await expect(page.getByRole("menuitem", { name: "As Markdown" })).toBeVisible();
    await page.waitForTimeout(400);
    inWindow(await boxOf(menu), page);
    // Copy comments (to fold the choices away) is still on screen, and every row can be scrolled to.
    inWindow((await page.getByRole("menuitem", { name: "Copy comments" }).boundingBox())!, page);
    const start = page.getByRole("menuitemcheckbox", { name: "Start commenting" });
    await start.scrollIntoViewIfNeeded();
    inWindow((await start.boundingBox())!, page);
    expect(await menu.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  });
});

for (const [width, height] of [
  [375, 812],
  [568, 320],
  [320, 568],
] as const)
  test.describe(`a deck on a phone (${width} × ${height})`, () => {
    test.use(phone(width, height));

    test("comment mode's touch hint sits above the deck's own slide controls, which still work, and Done leaves", async ({
      page,
    }) => {
      await open(page, "phone-deck.html");
      await commentMode(page);
      const hint = page.locator(".toast.show");
      await expect(hint).toContainText("Tap what you want to comment on");
      const h = await boxOf(hint);
      inWindow(h, page);
      // Neither the hint nor the comment control covers the deck's "← 1 / 3 →" bar along the bottom.
      const bar = (await page.locator("#bar").boundingBox())!;
      const c = (await control(page).boundingBox())!;
      expect(apart(h, bar)).toBe(true);
      expect(apart(c, bar)).toBe(true);
      expect(apart(h, c)).toBe(true);
      // The deck's own arrows still turn the slide in comment mode.
      await page.locator("#next").tap();
      await expect(page.locator("#count")).toHaveText("2 / 3");
      await hint.getByRole("button", { name: "Done" }).tap();
      await expect(control(page)).not.toHaveClass(/\bon\b/);
      await expect(page.locator(".toast.show")).toHaveCount(0);
    });
  });

test.describe("a reveal.js deck on a phone by touch (375 × 812)", () => {
  // Not isMobile: the fixture has no viewport tag, and its slides scale to whatever the window is.
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("comment mode's touch hint sits above the deck's arrows, slide number and progress bar", async ({
    page,
  }) => {
    await open(page, "reveal-deck.html");
    await commentMode(page);
    const hint = page.locator(".toast.show");
    await expect(hint).toContainText("Tap what you want to comment on");
    const h = await boxOf(hint);
    inWindow(h, page);
    for (const sel of [".controls", ".slide-number", ".progress"])
      expect(apart(h, (await page.locator(`.reveal > ${sel}`).boundingBox())!), sel).toBe(true);
  });
});

test.describe("a touch tablet (1024 × 768)", () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test("a tap on a closed card in the column opens it: its hidden Resolve, React and ⋯ take no tap", async ({
    page,
  }) => {
    await open(page, "doc.html", { name: "Sam" });
    await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
    const card = page.locator(".th");
    await expect(card).toContainText("Is 20% realistic?");
    await expect(card).not.toHaveClass(/\bwait\b/);
    const acts = card.locator(".root .acts");
    for (const name of ["Resolve", "React", "More"]) {
      await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
      await still(page);
      const b = (await card.getByRole("button", { name, exact: true }).boundingBox())!;
      await tapAt(page, b.x + b.width / 2, b.y + b.height / 2);
      await expect(card, name).toHaveClass(/\bon\b/);
      expect(
        await page.evaluate(
          () => (window as any).pu.document.threads().filter((t: any) => t.resolved).length,
        ),
        name,
      ).toBe(0);
      await expect(card.locator(".rxq, .pm"), name).toHaveCount(0);
      // A tap on the page's blank space closes it, and takes the finger off the card.
      await tapAt(page, 1000, 700);
      await expect(card).not.toHaveClass(/\bon\b/);
    }
  });
});

test.describe("a page zoomed far in (320 × 256)", () => {
  test.use({ viewport: { width: 320, height: 256 } });

  test("the menu fits the window and scrolls", async ({ page }) => {
    await open(page, "phone.html");
    await control(page).click();
    const menu = page.locator(".menu.show");
    inWindow(await boxOf(menu), page);
    const start = page.getByRole("menuitemcheckbox", { name: "Start commenting" });
    await start.scrollIntoViewIfNeeded();
    inWindow((await start.boundingBox())!, page);
    const name = page.locator(".menu.show .mi").first();
    await name.scrollIntoViewIfNeeded();
    inWindow((await name.boundingBox())!, page);
  });
});

// iPhones: taps reach Pipeup, the menu gets out of the way, and the on-screen keyboard never covers the box.
test.describe("an iPhone's taps and keyboard", () => {
  test.use(phone(375, 812));

  /** Click listeners on the page's body: Safari on iOS sends a tap on words as a click only when something listens. */
  const bodyClicks = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    const { result } = await cdp.send("Runtime.evaluate", { expression: "document.body" });
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId! });
    await cdp.detach();
    return listeners.filter((l) => l.type === "click").length;
  };

  test("while Pipeup waits for a tap on the page, the page's body listens for clicks; at rest it doesn't", async ({
    page,
  }) => {
    await open(page, "phone.html");
    const rest = await bodyClicks(page);
    await control(page).tap();
    await expect.poll(() => bodyClicks(page)).toBe(rest + 1);
    await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
    await expect(page.locator(".menu.show")).toHaveCount(0, { timeout: 2000 });
    expect(await bodyClicks(page)).toBe(rest + 1);
    await page.locator(".toast.show").getByRole("button", { name: "Done" }).tap();
    await expect.poll(() => bodyClicks(page)).toBe(rest);
    // Words marked with a comment can be tapped to open it.
    await seedText(page, "#p1", "July", "Is July firm?");
    await expect.poll(() => bodyClicks(page)).toBe(rest + 1);
  });

  test("Start commenting by touch closes the menu once the switch has moved, so the next tap picks a block", async ({
    page,
  }) => {
    await open(page, "phone.html");
    await control(page).tap();
    await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).tap();
    await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.locator(".menu.show")).toHaveCount(0, { timeout: 2000 });
    await page.locator("#p3").tap();
    await expect(page.locator(".pop.show textarea")).toBeVisible();
  });

  test("with the on-screen keyboard up, the box and its buttons sit above it, beside what it is about, and the control steps aside", async ({
    page,
  }) => {
    // The keyboard shrinks only the visual viewport, as on iOS: a stand-in that can be told the keyboard's height.
    await page.addInitScript(() => {
      const w = window as any;
      w.kb = 0;
      const vv = new EventTarget();
      const props: Record<string, () => number> = {
        width: () => innerWidth,
        height: () => innerHeight - w.kb,
        offsetTop: () => 0,
        offsetLeft: () => 0,
        pageTop: () => scrollY,
        pageLeft: () => 0,
        scale: () => 1,
      };
      for (const [k, get] of Object.entries(props)) Object.defineProperty(vv, k, { get });
      Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
      w.keyboard = (h: number) => {
        w.kb = h;
        vv.dispatchEvent(new Event("resize"));
      };
    });
    await open(page, "phone.html");
    // A page long enough to scroll what is commented on up into view.
    await page.evaluate(() => {
      const gap = document.createElement("div");
      gap.style.height = "700px";
      document.getElementById("p3")!.before(gap);
      const after = document.createElement("div");
      after.style.height = "900px";
      document.querySelector("article")!.append(after);
    });
    await commentMode(page);
    await page.locator("#p3").scrollIntoViewIfNeeded();
    await page.locator("#p3").tap();
    const box = page.locator(".pop.show");
    await expect(box.locator("textarea")).toBeVisible();
    await box.locator("textarea").focus();
    await page.evaluate(() => (window as any).keyboard(420));
    const top = 812 - 420;
    await expect(page.locator(".launch")).toHaveCSS("opacity", "0");
    await expect
      .poll(async () => {
        const b = (await box.boundingBox())!;
        const send = (await box.getByRole("button", { name: "Comment" }).boundingBox())!;
        const block = (await page.locator("#p3").boundingBox())!;
        return b.y >= 0 && send.y + send.height <= top && block.y >= 0 && apart(b, block);
      })
      .toBe(true);
    // The keyboard goes: so does the stepping aside.
    await page.evaluate(() => (window as any).keyboard(0));
    await expect(page.locator(".launch")).not.toHaveCSS("opacity", "0");
  });
});
