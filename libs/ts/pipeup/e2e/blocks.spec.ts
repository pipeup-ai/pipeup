import { expect, test, type Page } from "@playwright/test";
import { SHORTCUT } from "../src/ui/shortcut";
import { commenting, open, settled, toggleCommenting } from "./helpers";

async function commentMode(page: Page): Promise<void> {
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.move(5, 790);
}
const bar = (page: Page) => page.locator(".namebar.show");

test("clicking a block names it in a bar that never covers it", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(bar(page)).toContainText("Button · Start free");
  await settled(bar(page));
  const b = (await bar(page).boundingBox())!;
  const go = (await page.locator("#go").boundingBox())!;
  expect(b.y + b.height <= go.y || b.y >= go.y + go.height).toBe(true);
});

test("Parent steps out to the containing block, and goes when there is none", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await bar(page).getByRole("button", { name: "Select the block around it" }).click();
  await expect(bar(page)).toContainText("Hero");
  const o = page.locator(".pick.show");
  await settled(o);
  const box = (await o.boundingBox())!;
  const hero = (await page.locator("header").boundingBox())!;
  expect(Math.abs(box.y + 4 - hero.y)).toBeLessThan(2);
  expect(Math.abs(box.height - 8 - hero.height)).toBeLessThan(2);
  await expect(bar(page).getByRole("button", { name: "Select the block around it" })).toBeHidden();
});

const textbox = (page: Page) => page.locator(".pop.show .draft").getByRole("textbox", { name: "Comment" });
const expand = (page: Page) => bar(page).getByRole("button", { name: "Select the block around it" });

test("one click on a block opens the comment box on it, with focus, and the bar has no comment button", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  const draft = page.locator(".pop.show .draft");
  await expect(draft.locator(".ctx")).toHaveText("Button · Start free");
  await expect(textbox(page)).toBeFocused();
  await expect(bar(page)).toContainText("Button · Start free");
  await expect(bar(page).getByRole("button")).toHaveCount(1);
  await expect(bar(page).getByRole("button", { name: "Comment" })).toHaveCount(0);
  await expect(page.locator(".pick.on")).toHaveCount(1);
});

test("posting from the one-click box makes an element comment on that block", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await textbox(page).fill("Say Start free trial, like the link");
  await textbox(page).press("Enter");
  await expect(page.locator(".bub.in")).toHaveCount(1);
  const target = await page.evaluate(() => {
    const w = window as any;
    const t = w.pu.document.threads()[0];
    return { id: w.Pipeup.resolveAnchor(t.anchor, document.body).element?.id, quote: t.anchor.quote };
  });
  expect(target.id).toBe("go");
  expect(target.quote).toBeUndefined();
  await expect(page.locator(".pick.on")).toHaveCount(0);
});

test("the expand icon moves the open box to the surrounding block, keeping its words, focus and caret", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await textbox(page).fill("Say Start free trial");
  await textbox(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 4));
  await expand(page).click();
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("Hero");
  await expect(page.locator(".pop.show .draft")).toHaveCount(1);
  await expect(textbox(page)).toHaveValue("Say Start free trial");
  await expect(textbox(page)).toBeFocused();
  const caret = await textbox(page).evaluate((el: HTMLTextAreaElement) => [
    el.selectionStart,
    el.selectionEnd,
  ]);
  expect(caret).toEqual([4, 4]);
  await textbox(page).press("Enter");
  const tag = await page.evaluate(() => {
    const w = window as any;
    return w.Pipeup.resolveAnchor(w.pu.document.threads()[0].anchor, document.body).element?.tagName;
  });
  expect(tag).toBe("HEADER");
});

test("the expand icon, used from the keyboard, leaves the caret in the box", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await textbox(page).fill("abc");
  await textbox(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 1));
  await expand(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("Hero");
  await expect(textbox(page)).toBeFocused();
  expect(await textbox(page).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(1);
});

test("the box and the outline glide to the surrounding block; nothing snaps", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(page.locator(".pop.show"));
  await page.evaluate(() => {
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    const w = window as any;
    w.seen = { left: false, top: false, pick: false };
    const watch = () => {
      for (const a of (root.querySelector(".pop") as HTMLElement).getAnimations() as CSSTransition[]) {
        if (a.transitionProperty === "left") w.seen.left = true;
        if (a.transitionProperty === "top") w.seen.top = true;
      }
      if ((root.querySelector(".pick") as HTMLElement).getAnimations().length) w.seen.pick = true;
      requestAnimationFrame(watch);
    };
    watch();
  });
  await expand(page).click();
  await expect.poll(() => page.evaluate(() => (window as any).seen.pick)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as any).seen.left || (window as any).seen.top))
    .toBe(true);
});

test("with reduced motion the box fades out before it moves to the surrounding block", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(page.locator(".pop.show"));
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".pop") as HTMLElement;
    let at = `${el.style.left},${el.style.top}`;
    w.moves = [];
    w.watch = new MutationObserver(() => {
      const now = `${el.style.left},${el.style.top}`;
      if (now !== at) w.moves.push(Number(getComputedStyle(el).opacity));
      at = now;
    });
    w.watch.observe(el, { attributes: true, attributeFilter: ["style"] });
  });
  await expand(page).click();
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("Hero");
  await settled(page.locator(".pop.show"));
  const moves = await page.evaluate(() => {
    const w = window as any;
    w.watch.disconnect();
    return w.moves as number[];
  });
  expect(moves.length).toBeGreaterThan(0);
  for (const opacity of moves) expect(opacity).toBeLessThan(0.5);
});

test("with reduced motion, closing the box right after expanding leaves nothing behind", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(page.locator(".pop.show"));
  await expand(page).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(page.locator(".pop")).toHaveJSProperty("inert", true);
});

test("with reduced motion the box keeps its old name until it has faded out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(page.locator(".pop.show"));
  await page.evaluate(() => {
    const w = window as any;
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    const pop = root.querySelector(".pop") as HTMLElement;
    const ctx = root.querySelector(".pop .ctx") as HTMLElement;
    w.named = [];
    new MutationObserver(() => {
      if (ctx.textContent!.startsWith("Hero")) w.named.push(Number(getComputedStyle(pop).opacity));
    }).observe(ctx, { childList: true, characterData: true, subtree: true });
  });
  await expand(page).click();
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("Hero");
  const named = await page.evaluate(() => (window as any).named as number[]);
  expect(named.length).toBeGreaterThan(0);
  for (const opacity of named) expect(opacity).toBeLessThan(0.5);
});

type Rect = { x: number; y: number; width: number; height: number };
const meets = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [width, height] of [
  [375, 520],
  [1280, 800],
] as const) {
  test(`the box follows its block while the page scrolls (${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "controls.html", { name: "Sam" });
    await commentMode(page);
    await page.locator("#go").click();
    const pop = page.locator(".pop.show");
    await settled(pop);
    const before = (await pop.boundingBox())!;
    await page.evaluate(async () => {
      scrollBy(0, 40);
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    });
    const after = (await pop.boundingBox())!;
    expect(Math.abs(before.y - after.y - 40)).toBeLessThan(1);
  });
}

for (const [width, height] of [
  [375, 420],
  [1280, 800],
  [375, 300],
  [1280, 300],
] as const) {
  test(`the box never covers its block or the naming bar (${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "controls.html", { name: "Sam" });
    await commentMode(page);
    await page.locator("#go").click();
    const pop = page.locator(".pop.show");
    await settled(pop);
    await settled(bar(page));
    const box = (await pop.boundingBox())!;
    expect(meets(box, (await page.locator("#go").boundingBox())!)).toBe(false);
    expect(meets(box, (await bar(page).boundingBox())!)).toBe(false);
    expect(box.y >= 0 && box.y + box.height <= height).toBe(true);
  });
}

test("the box doesn't repeat the block's name while the naming bar shows it, and takes no space for it", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(bar(page)).toContainText("Button · Start free");
  await expect(page.locator(".pop.show .draft .ctx")).toBeHidden();
  const draft = (await page.locator(".pop.show .draft").boundingBox())!;
  const row = (await page.locator(".pop.show .draft .row").boundingBox())!;
  expect(row.y - draft.y).toBeLessThan(2);
});

test("a draft with no naming bar keeps its label, as one left open after leaving comment mode", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(page.locator(".pop.show .draft .ctx")).toBeHidden();
  await toggleCommenting(page);
  await expect(page.locator(".pop.show .draft .ctx")).toBeVisible();
  await expect(page.locator(".pop.show .draft .ctx")).toHaveText("Button · Start free");
});

test("the comment-mode hint fades after about four seconds", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await toggleCommenting(page);
  await expect(page.locator(".toast.show")).toContainText("Esc to finish");
  await page.waitForTimeout(3000);
  await expect(page.locator(".toast.show")).toHaveCount(1);
  await page.waitForTimeout(1500);
  await expect(page.locator(".toast.show")).toHaveCount(0);
});

test("the comment-mode hint goes as soon as a block is clicked, and doesn't return", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await toggleCommenting(page);
  await page.mouse.move(5, 790);
  await expect(page.locator(".toast.show")).toContainText("Esc to finish");
  await page.locator("#go").click();
  await expect(page.locator(".toast.show")).toHaveCount(0, { timeout: 300 });
  await page.waitForTimeout(500);
  await expect(page.locator(".toast.show")).toHaveCount(0);
});

/** Clicks #go in a 300px-tall window (the box opens above it), then scrolls 100px so the box must go below. */
async function flipWhileSampling(page: Page): Promise<{ top: number; opacity: number }[]> {
  await page.setViewportSize({ width: 1280, height: 300 });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(page.locator(".pop.show"));
  await page.evaluate(() => {
    const w = window as any;
    const pop = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".pop") as HTMLElement;
    w.samples = [];
    const tick = () => {
      w.samples.push({
        top: pop.getBoundingClientRect().top,
        opacity: Number(getComputedStyle(pop).opacity),
      });
      requestAnimationFrame(tick);
    };
    tick();
    scrollBy(0, 100);
  });
  await page.waitForTimeout(900);
  return page.evaluate(() => (window as any).samples);
}

test("when scrolling flips the box to the other side of its block, it eases across", async ({ page }) => {
  const samples = await flipWhileSampling(page);
  const start = samples[0]!.top;
  const end = samples[samples.length - 1]!.top;
  expect(Math.abs(end - start)).toBeGreaterThan(40);
  const lo = Math.min(start, end) + 6;
  const hi = Math.max(start, end) - 6;
  expect(samples.filter((x) => x.top > lo && x.top < hi).length).toBeGreaterThan(3);
});

test("with reduced motion a flip cross-fades: the box moves only while unseen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const samples = await flipWhileSampling(page);
  expect(samples.some((x) => x.opacity > 0.05 && x.opacity < 0.95)).toBe(true);
  const start = samples[0]!.top;
  const end = samples[samples.length - 1]!.top;
  expect(Math.abs(end - start)).toBeGreaterThan(40);
  for (const x of samples)
    if (Math.abs(x.top - start) > 1 && Math.abs(x.top - end) > 1) throw new Error("moved visibly");
  expect(samples[samples.length - 1]!.opacity).toBe(1);
});

test("clicking another block moves an empty box there; a box with words keeps them and stays put", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await page.locator("#mrr").click();
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("MRR");
  await expect(page.locator(".pop.show .draft")).toHaveCount(1);
  await textbox(page).fill("Keep me");
  await page.locator("#go").click();
  await expect(page.locator(".pop.show .draft .ctx")).toContainText("MRR");
  await expect(textbox(page)).toHaveValue("Keep me");
});

test("Escape closes the box and the chosen block together; the next Escape leaves comment mode", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(textbox(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator(".pick.on")).toHaveCount(0);
  await commenting(page);
  await page.keyboard.press("Escape");
  await commenting(page, false);
});

test("in a document column, a block's draft sits level with the block", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("[data-pipeup-id=q4-bar]").click();
  await expect(bar(page)).toContainText("Q4 bar");
  const draft = page.locator(".th.on", { has: page.locator(".draft") });
  await expect(draft).toHaveCount(1);
  await settled(draft);
  const q4 = (await page.locator("[data-pipeup-id=q4-bar]").boundingBox())!;
  expect(Math.abs((await draft.boundingBox())!.y - (q4.y - 4))).toBeLessThan(6);
});

test("the bar keeps to its block while the page scrolls, and glides when Parent moves it", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  await expect(page.locator(".namebar.glide")).toHaveCount(0);
  // Tracking scroll: in place on the very next frames, no lag.
  const gap = await page.evaluate(async () => {
    scrollBy(0, 40);
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const b = document
      .querySelector("pipeup-root")!
      .shadowRoot!.querySelector(".namebar")!
      .getBoundingClientRect();
    return document.getElementById("go")!.getBoundingClientRect().top - b.bottom;
  });
  expect(Math.abs(gap - 10)).toBeLessThan(1);
  await bar(page).getByRole("button", { name: "Select the block around it" }).click();
  await expect(page.locator(".namebar.show.glide")).toHaveCount(1);
});

test("the bar fades out with the exit timing", async ({ page }) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  await page.keyboard.press("Escape");
  const t = await page.locator(".namebar").evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(t.split(",")[0]?.trim()).toBe("0.2s");
});

/** Pipeup's focused element (inside its shadow root), described by the nearest bar it sits in. */
const focusedBar = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector("pipeup-root")!.shadowRoot!.activeElement;
    return a?.closest(".namebar,.selbar")?.className ?? null;
  });

test("hidden bars take no focus: Tab never lands on the naming bar or the selection bar", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(bar(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(bar(page)).toHaveCount(0);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await focusedBar(page)).toBeNull();
  }
});

test("with reduced motion the bar fades out before Parent moves it, never moving while visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".namebar") as HTMLElement;
    let at = `${el.style.left},${el.style.top}`;
    w.moves = [];
    w.watch = new MutationObserver(() => {
      const now = `${el.style.left},${el.style.top}`;
      if (now !== at) w.moves.push(Number(getComputedStyle(el).opacity));
      at = now;
    });
    w.watch.observe(el, { attributes: true, attributeFilter: ["style"] });
  });
  await bar(page).getByRole("button", { name: "Select the block around it" }).click();
  await expect(bar(page)).toContainText("Hero");
  await settled(bar(page));
  const moves = await page.evaluate(() => {
    const w = window as any;
    w.watch.disconnect();
    return w.moves as number[];
  });
  expect(moves.length).toBeGreaterThan(0);
  for (const opacity of moves) expect(opacity).toBe(0);
});

test("when the expand icon goes at the top block, focus stays in the box; long labels can be read in full", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await expect(bar(page).locator(".lbl")).toHaveAttribute("title", "Button · Start free");
  await expand(page).focus();
  await page.keyboard.press("Enter");
  await expect(bar(page)).toContainText("Hero");
  await expect(expand(page)).toBeHidden();
  await expect(textbox(page)).toBeFocused();
});

interface ExitSample {
  opacity: number;
  transform: string;
  at: string;
}
/**
 * Leaves comment mode with a block chosen, sampling the outline and the bar every frame until both are gone.
 * Returns each one's samples after leaving, and how long after leaving the last of them left the page.
 */
async function leaveAndWatch(
  page: Page,
): Promise<{ pick: ExitSample[]; bar: ExitSample[]; goneAfter: number }> {
  await page.evaluate(() => {
    const w = window as any;
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    const els = [root.querySelector(".pick"), root.querySelector(".namebar")] as HTMLElement[];
    const mode = root.querySelector(".launch .mode")!;
    w.exit = { pick: [], bar: [], goneAfter: -1 };
    let left = 0;
    const tick = () => {
      if (!left && !mode.classList.contains("on")) left = performance.now();
      if (left) {
        els.forEach((el, i) => {
          if (!el.isConnected) return;
          const s = getComputedStyle(el);
          w.exit[i ? "bar" : "pick"].push({
            opacity: Number(s.opacity),
            transform: s.transform,
            at: `${el.style.left},${el.style.top}`,
          });
        });
        if (els.every((el) => !el.isConnected)) {
          w.exit.goneAfter = performance.now() - left;
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await toggleCommenting(page);
  await expect.poll(() => page.evaluate(() => (window as any).exit.goneAfter)).toBeGreaterThanOrEqual(0);
  return page.evaluate(() => (window as any).exit);
}

test("leaving comment mode fades the outline and the bar out with the exit timing, then removes them", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  const exit = await leaveAndWatch(page);
  // Removed only once the 0.2 s fade has run, passing through partly visible on the way.
  expect(exit.goneAfter).toBeGreaterThanOrEqual(150);
  expect(exit.pick.some((s) => s.opacity > 0 && s.opacity < 1)).toBe(true);
  expect(exit.bar.some((s) => s.opacity > 0 && s.opacity < 1)).toBe(true);
  await expect(page.locator(".pick, .namebar")).toHaveCount(0);
});

test("with reduced motion, leaving comment mode only fades the outline and bar: nothing moves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  const exit = await leaveAndWatch(page);
  expect(exit.goneAfter).toBeGreaterThanOrEqual(100);
  for (const samples of [exit.pick, exit.bar]) {
    expect(samples.some((s) => s.opacity > 0 && s.opacity < 1)).toBe(true);
    expect(new Set(samples.map((s) => s.at)).size).toBe(1);
  }
  for (const s of exit.bar) expect(s.transform).toBe("none");
});

test("re-entering comment mode while the last outline fades out leaves one working outline", async ({
  page,
}) => {
  await open(page, "controls.html", { name: "Sam" });
  await commentMode(page);
  await page.locator("#go").click();
  await settled(bar(page));
  await toggleCommenting(page);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page);
  // The box stayed open when comment mode was left; closing it frees the pointer to pick again.
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  await page.locator("#mrr").hover();
  await expect(page.locator(".pick.show")).toHaveCount(1);
  // Once the old ones have faded out and gone, exactly one outline and one bar remain, and they still work.
  await expect(page.locator(".pick")).toHaveCount(1);
  await expect(page.locator(".namebar")).toHaveCount(1);
  await page.locator("#mrr").click();
  await expect(bar(page)).toContainText("MRR tile");
});
