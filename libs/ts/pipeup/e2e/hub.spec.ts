import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  commenting,
  open,
  openAll,
  seedText,
  settled,
  showComments,
  stubClipboard,
  toggleCommenting,
} from "./helpers";

const panel = (page: Page) => page.locator(".all.show");

test.describe.configure({ mode: "parallel" });

/** A filter's fill and the colour of its words and icon. */
const paint = (b: Locator) =>
  b.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color }));
/** The accent colour as Pipeup paints it. */
const accent = (page: Page) =>
  page.evaluate(() => {
    const layer = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".layer")!;
    const probe = document.createElement("i");
    probe.style.color = "var(--pu-accent)";
    layer.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });

for (const look of ["light", "dark"] as const)
  test(`the panel's header has no title: @ For you and ✓ Resolved are pills, filled with the accent when on (${look})`, async ({
    page,
  }) => {
    await open(page, "doc.html");
    if (look === "dark") {
      await page.evaluate(() => document.documentElement.setAttribute("data-pipeup-theme", "dark"));
      await expect(page.locator(".layer")).toHaveClass(/dark/);
    }
    const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
    await page.evaluate((id) => (window as any).pu.document.resolve(id), id);
    await seedText(page, "#p2", "second designer", "Why Q4?");
    await openAll(page);
    const hd = panel(page).locator(".hd");
    await expect(hd).not.toContainText("All comments");
    // Each filter shows its icon and its word, and is named by its word.
    const at = hd.getByRole("button", { name: "For you", exact: true });
    const resolved = hd.getByRole("button", { name: "Resolved", exact: true });
    await expect(at).toHaveText("For you");
    await expect(at.locator("svg")).toHaveCount(1);
    await expect(resolved).toHaveText("Resolved");
    await expect(resolved.locator("svg")).toHaveCount(1);
    await expect(resolved).toHaveAttribute("aria-pressed", "false");
    // Off: grey words and icon, nothing behind them.
    await page.mouse.move(5, 700);
    await settled(resolved);
    const off = await paint(resolved);
    expect(off.bg).toBe("rgba(0, 0, 0, 0)");
    await expect(panel(page).locator(".cd")).toHaveCount(1);
    await resolved.click();
    await expect(resolved).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).locator(".cd")).toHaveCount(2);
    // On: a soft fill of the accent, the words and icon in the accent. The change eases.
    await page.mouse.move(5, 700);
    await settled(resolved);
    const on = await paint(resolved);
    expect(on.bg).not.toBe(off.bg);
    expect(on.color).not.toBe(off.color);
    expect(on.color).toBe(await accent(page));
    expect(await resolved.evaluate((e) => getComputedStyle(e).transitionProperty)).toContain(
      "background-color",
    );
    // Hovering an off filter shows a light fill, not the on one.
    await at.hover();
    await expect.poll(async () => (await paint(at)).bg).not.toBe("rgba(0, 0, 0, 0)");
    await settled(at);
    expect((await paint(at)).bg).not.toBe(on.bg);
    // Each has a tooltip that says what it does, easing in on hover.
    const tip = () =>
      at.evaluate((e) => [getComputedStyle(e, "::after").opacity, getComputedStyle(e, "::after").content]);
    await expect.poll(async () => (await tip())[0]).toBe("1");
    expect((await tip())[1]).toBe('"Only comments that mention you"');
    // For you shows even when nobody mentions this reviewer; on, it says so rather than showing everything.
    await at.click();
    await expect(at).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page)).toContainText("No comments mention you");
    await at.click();
    // Nothing wraps: the header is one line inside the panel, and across a narrow screen.
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await expect.poll(() => hd.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      expect((await hd.boundingBox())!.height).toBeLessThan(50);
      for (const b of [at, resolved]) expect((await b.boundingBox())!.height).toBeLessThan(32);
    }
  });

/** Answers Delete's second question as a person would: after a moment (a press within half a second is ignored). */
const confirmDelete = async (scope: Locator) => {
  await scope.page().waitForTimeout(550);
  await scope.getByRole("menuitem", { name: "Delete for everyone" }).click();
};

test("hovering a closed card in the panel shows its actions; they work without opening it, and nothing moves", async ({
  page,
}) => {
  await stubClipboard(page);
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await openAll(page);
  await page.mouse.move(5, 700);
  const card = panel(page).locator(".cd").first();
  const next = panel(page).locator(".cd").nth(1);
  const acts = card.locator(".root .acts");
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await settled(panel(page));
  const was = [(await card.boundingBox())!, (await next.boundingBox())!];
  // Hovered, its actions ease in at its top right, and neither it nor the card below moves.
  await card.hover();
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  expect(await acts.evaluate((e) => getComputedStyle(e).transitionProperty)).toContain("opacity");
  expect([(await card.boundingBox())!, (await next.boundingBox())!]).toEqual(was);
  const box = was[0]!;
  for (const name of ["React", "Resolve", "More"]) {
    const b = (await card.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(b.y - box.y).toBeLessThan(20);
    expect(b.x).toBeGreaterThan(box.x + box.width / 2);
  }
  // React: the quick row opens inside the closed card; a choice reacts, and the card stays closed.
  await card.getByRole("button", { name: "React", exact: true }).click();
  await card.getByRole("button", { name: "Thumbs up" }).click();
  await expect(card.locator(".rest")).toContainText("👍 1");
  await expect(panel(page).locator(".cd.open")).toHaveCount(0);
  // ⋯: Copy thread, and Edit and Delete on your own comment. Edit puts the words in a box in the closed card.
  await card.hover();
  await card.getByRole("button", { name: "More", exact: true }).click();
  await expect(card.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await card.getByRole("menuitem", { name: "Copy thread" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied.length)).toBe(1);
  await card.getByRole("button", { name: "More", exact: true }).click();
  await card.getByRole("menuitem", { name: "Edit" }).click();
  const edit = card.locator(".edit textarea");
  await expect(edit).toBeFocused();
  await edit.fill("Is 20% realistic for Q3?");
  await page.keyboard.press("Enter");
  await expect(card.locator(".root > .tx")).toHaveText("Is 20% realistic for Q3? (edited)");
  await expect(panel(page).locator(".cd.open")).toHaveCount(0);
  // Resolve: the thread is resolved from the closed card, which eases out of the list without opening.
  await card.hover();
  await card.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).pu.document.threads().filter((t: any) => t.resolved).length),
    )
    .toBe(1);
  await expect(panel(page).locator(".cd")).toHaveCount(1);
  await expect(panel(page).locator(".cd")).toContainText("Why Q4?");
  await expect(panel(page).locator(".cd.open")).toHaveCount(0);
  // Clicking a closed card anywhere but its actions still opens it: its button lies over its words.
  await panel(page).locator(".cd").click();
  await expect(panel(page).locator(".cd.open")).toHaveCount(1);
});

test("a closed card's actions show when the keyboard reaches it (not after a click), and Escape there goes back to the card", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await openAll(page);
  await page.mouse.move(5, 700);
  const cards = panel(page).locator(".cd");
  const shown = (i: number) =>
    cards
      .nth(i)
      .locator(".acts")
      .evaluate((e) => getComputedStyle(e).opacity);
  // Opened with a click, the first card has focus, but its actions stay out of the way.
  await expect(cards.nth(0).locator(".mi")).toBeFocused();
  await expect.poll(() => shown(0)).toBe("0");
  await page.keyboard.press("ArrowDown");
  await expect(cards.nth(1).locator(".mi")).toBeFocused();
  await expect.poll(() => shown(1)).toBe("1");
  await page.keyboard.press("Tab");
  await expect(cards.nth(1).getByRole("button", { name: "React", exact: true })).toBeFocused();
  await expect.poll(() => shown(1)).toBe("1");
  await page.keyboard.press("Escape");
  await expect(cards.nth(1).locator(".mi")).toBeFocused();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator(".cd.open")).toHaveCount(0);
});

test("while the panel is open the comment control is its footer: who you are, Comment, and ⋯ for the menu", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
  const foot = panel(page).locator(".pf");
  await expect(foot).toContainText("Sam");
  // The control has stepped aside (out of sight and out of the keyboard's reach).
  await expect(page.locator(".launch")).toHaveAttribute("inert", "");
  await expect.poll(() => page.locator(".launch").evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  // Comment turns comment mode on, and the panel stays.
  const sw = foot.getByRole("switch", { name: /Comment/ });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(panel(page)).toBeVisible();
  // ⋯ opens the rest of the menu above the footer, without Comment and All comments (the footer has them).
  await foot.getByRole("button", { name: "More" }).click();
  const menu = page.locator(".menu.show");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy comments", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitemcheckbox", { name: "Hide comments" })).toBeVisible();
  await expect(menu.getByRole("menuitemcheckbox", { name: "Start commenting" })).toBeHidden();
  await expect(menu.getByRole("menuitem", { name: /All comments/ })).toBeHidden();
  const m = (await menu.boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual((await foot.boundingBox())!.y + 1);
  await page.keyboard.press("Escape");
  // Closing the panel brings the control back.
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".launch")).not.toHaveAttribute("inert", "");
});

test("with the panel open, a new comment is written in it, in page order, joined to its place by a line", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p3", "pricing work", "Too tight?");
  await openAll(page);
  await panel(page)
    .locator(".pf")
    .getByRole("switch", { name: /Comment/ })
    .click();
  await commenting(page);
  await page.mouse.move(5, 700);
  // A paragraph between the two threads: its new card sits between theirs.
  await page.locator("#p2").click();
  await expect(panel(page)).toBeVisible();
  const card = panel(page).locator(".cd.new");
  await expect(card).toHaveCount(1);
  const order = await panel(page)
    .locator(".cd")
    .evaluateAll((cards) =>
      cards.map((c) => (c.classList.contains("new") ? "new" : c.textContent!.slice(0, 40))),
    );
  expect(order[1]).toBe("new");
  const box = card.getByRole("textbox", { name: "Comment" });
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute("placeholder", "Comment or add others with @");
  await expect(page.locator(".cx.show")).toHaveCount(1);
  // Comment stays grey until there are words.
  await expect(card.locator(".send")).not.toHaveClass(/\bshow\b/);
  await page.keyboard.type("Say who the designer is");
  await expect(card.locator(".send")).toHaveClass(/\bshow\b/);
  await card.locator(".send").click();
  // Sent: it is a thread in the panel, open for a reply; the panel stays.
  await expect(panel(page).locator(".cd.new")).toHaveCount(0);
  await expect(panel(page).locator(".xr")).toContainText("Say who the designer is");
  await expect(panel(page).locator(".cd")).toHaveCount(3);
  await commenting(page);
});

test("a comment being written moves into the panel when it opens, and back when it closes, with its words", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 700);
  await page.locator("#p2").click();
  const box = page.getByRole("textbox", { name: "Comment" });
  await expect(box).toBeFocused();
  await page.keyboard.type("Half a thought");
  await openAll(page);
  await expect(panel(page).locator(".cd.new textarea")).toHaveValue("Half a thought");
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".th textarea[aria-label=Comment]")).toHaveValue("Half a thought");
});

test("a card shows who and how long ago; its actions show on hover; ⋯ edits and deletes your own comment", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await expect(th.locator(".root .who")).toHaveText("Sam");
  await expect(th.locator(".root .ago")).toHaveText("just now");
  await expect(th.locator(".root .ago")).toHaveAttribute("title", /\d/);
  const acts = th.locator(".root .acts");
  await page.mouse.move(5, 700);
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await th.hover();
  await expect.poll(() => acts.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  // Edit: the words go back in a box with Cancel and Save.
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Edit" }).click();
  const edit = th.locator(".root .edit textarea");
  await expect(edit).toBeFocused();
  await expect(edit).toHaveValue("Is 20% realistic?");
  await edit.fill("Is 20% realistic for Q3?");
  await page.keyboard.press("Enter");
  await expect(th.locator(".root > .tx")).toHaveText("Is 20% realistic for Q3? (edited)");
  // Delete asks once more.
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Delete" }).click();
  await expect(th.getByRole("menuitem", { name: "Delete for everyone" })).toBeVisible();
  await confirmDelete(th);
  await expect(page.locator(".toast.show")).toContainText("Deleted");
  await settled(page.locator(".toast.show"));
});

test("the footer's ⋯ menu shows on top of the panel", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await openAll(page);
  await panel(page).locator(".pf").getByRole("button", { name: "More" }).click();
  const menu = page.locator(".menu.show");
  await settled(menu);
  const b = (await menu.boundingBox())!;
  // What is drawn at the middle of the menu is the menu, not the panel behind it.
  const onTop = await page.evaluate(
    ({ x, y }) => {
      const at = document.querySelector("pipeup-root")!.shadowRoot!.elementFromPoint(x, y);
      return !!at?.closest(".menu");
    },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  expect(onTop).toBe(true);
});

test("an open card shows the words it's about once, and its top line closes it", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
  await panel(page)
    .getByRole("button", { name: /Is 20% realistic/ })
    .click();
  const card = panel(page).locator(".cd.open");
  await expect(card.locator(".ctx:visible")).toHaveCount(1);
  await expect(card.locator(".ctx:visible")).toHaveText("“20% lift”");
  await card.locator(".root > .hdr .who").click();
  await expect(panel(page).locator(".cd.open")).toHaveCount(0);
});

test("a deleted comment goes away; deleting a thread's first comment removes the thread", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate((id) => (window as any).pu.document.reply(id, "Second thoughts"), id);
  const th = page.locator(".th");
  await th.locator(".root .tx").first().click();
  const reply = th.locator(".rps .it");
  await expect(reply).toHaveCount(1);
  await reply.getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Delete" }).click();
  await confirmDelete(th);
  await expect(th.locator(".rps .it")).toHaveCount(0);
  await expect(th).not.toContainText("Deleted");
  await th.locator(".root").getByRole("button", { name: "More" }).click();
  await th.getByRole("menuitem", { name: "Delete" }).click();
  await confirmDelete(th);
  await expect(page.locator(".th")).toHaveCount(0);
  // Nothing is counted any more: the control's bubble fades back to the comment icon.
  await expect(page.locator(".launch .mode")).not.toHaveClass(/\bhas\b/);
});

test("the pulse on a thread's content follows it while opening it from the panel scrolls the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p3", "pricing work", "Too tight?");
  await openAll(page);
  await panel(page)
    .getByRole("button", { name: /Too tight/ })
    .click();
  await page.waitForTimeout(700);
  const pulse = page.locator(".pulse").first();
  await expect(pulse).toHaveCount(1);
  const p = (await pulse.boundingBox())!;
  const words = await page.evaluate(() => {
    const p3 = document.getElementById("p3")!;
    const text = [...p3.childNodes].find((n) => n.textContent!.includes("pricing work"))!;
    const range = document.createRange();
    const at = text.textContent!.indexOf("pricing work");
    range.setStart(text, at);
    range.setEnd(text, at + "pricing work".length);
    const r = range.getClientRects()[0]!;
    return { y: r.top, x: r.left };
  });
  expect(Math.abs(p.y + 4 - words.y)).toBeLessThan(3);
});

test("an open card's reply box stays steady while the panel updates (it never flashes)", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await openAll(page);
  await panel(page)
    .getByRole("button", { name: /Is 20% realistic/ })
    .click();
  const box = panel(page).locator(".xr .rbox .line");
  await expect(box.locator("textarea")).toBeFocused();
  await page.waitForTimeout(500);
  // Sample the box's buttons every frame while the pointer crosses another thread's highlight (which updates the panel).
  await page.evaluate(() => {
    const w = window as any;
    const bts = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".xr .rbox .bts")!;
    w.__op = [];
    const t0 = performance.now();
    const tick = () => {
      w.__op.push(Number(getComputedStyle(bts).opacity));
      if (performance.now() - t0 < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const spot = await page.evaluate(() => {
    for (const r of CSS.highlights.get("pipeup-quote")!)
      if (r.toString().includes("second")) {
        const q = (r as Range).getClientRects()[0]!;
        return { x: q.left + 10, y: q.top + 5 };
      }
    return null;
  });
  await page.mouse.move(spot!.x, spot!.y);
  await page.waitForTimeout(300);
  await page.mouse.move(5, 700);
  await page.waitForTimeout(700);
  const op = await page.evaluate(() => (window as any).__op as number[]);
  expect(op.length).toBeGreaterThan(20);
  expect(Math.min(...op)).toBeGreaterThan(0.95);
  await expect(box.locator("textarea")).toBeFocused();
});

test("a thread open on the page moves into the panel when it opens: it is never open twice", async ({
  page,
}) => {
  await open(page, "site.html", { name: "Sam" });
  await page.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=cta-trial]"), document.body),
      "Match the nav?",
    );
  });
  await page.locator(".bub").first().click();
  await expect(page.locator(".pop.show")).toContainText("Match the nav?");
  await openAll(page);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(panel(page).locator(".cd.open")).toContainText("Match the nav?");
  await expect(panel(page).locator(".cd.open textarea")).toBeFocused();
});
