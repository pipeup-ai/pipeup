import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  control,
  fixture,
  open,
  openAll,
  openMenu,
  seedElement,
  seedText,
  seedView,
  settled,
  showComments,
} from "./helpers";

/**
 * What is seen, not just what is there: contrast, colour, opacity and layout, measured in the page. Each test here
 * failed before its fix. Helpers in the page (window.__k): colours read through a canvas so any format reads the same,
 * WCAG luminance and contrast, and the colour actually behind an element (its own and its ancestors' backgrounds,
 * through Pipeup's shadow root, composited over white).
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const blend = (top: number[], under: number[]) => {
      const a = top[3] ?? 1;
      return [0, 1, 2].map((i) => top[i]! * a + under[i]! * (1 - a)).concat(1);
    };
    const behind = (el: Element): number[] => {
      const stack: number[][] = [];
      for (
        let e: Element | null = el;
        e;
        e = e.parentElement ?? ((e.getRootNode() as ShadowRoot).host as Element | undefined) ?? null
      ) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3]! > 0) stack.push(c);
        if (c[3]! >= 0.99) break;
      }
      return stack.reduceRight((under, c) => blend(c, under), [255, 255, 255, 1]);
    };
    /** How an element's words read against what is behind them. */
    const reads = (el: Element) => ratio(rgba(getComputedStyle(el).color), behind(el));
    (window as any).__k = { rgba, lum, ratio, blend, behind, reads };
  });
});

const reads = (l: Locator) => l.evaluate((el) => (window as any).__k.reads(el) as number);

/** Chooses Theme › `want` from the menu (which stays open), then closes the menu. */
async function theme(page: Page, want: "Automatic" | "Light" | "Dark"): Promise<void> {
  await openMenu(page);
  const row = page.locator(".menu .mi", { hasText: "Theme" });
  for (let i = 0; i < 3 && !(await row.textContent())!.includes(want); i++) await row.click();
  await expect(row).toContainText(want);
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
}

/**
 * Every highlighted passage on the page, with how well its words read on the highlight painted over its own
 * background, and the strength of that highlight (it fades in).
 */
const highlighted = (page: Page) =>
  page.evaluate(() => {
    const k = (window as any).__k;
    const rules = [...document.adoptedStyleSheets].flatMap((s) => [...s.cssRules]);
    const out: { words: string; name: string; alpha: number; ratio: number }[] = [];
    for (const [name, hl] of CSS.highlights) {
      if (!name.startsWith("pipeup-")) continue;
      const rule = rules.find((r) => r.cssText.startsWith(`::highlight(${name})`));
      const paint = k.rgba(/background-color:\s*([^;]+);/.exec(rule!.cssText)![1]);
      for (const r of hl as unknown as Set<Range>) {
        const el = r.startContainer.parentElement!;
        const ground = k.behind(el);
        out.push({
          words: r.toString(),
          name,
          alpha: paint[3],
          ratio: k.ratio(k.rgba(getComputedStyle(el).color), k.blend(paint, ground)),
        });
      }
    }
    return out;
  });
/** The least readable highlighted passage, once every highlight has eased in to its full strength. */
async function leastReadable(page: Page, count: number): Promise<number> {
  let least = 0;
  await expect
    .poll(async () => {
      const all = await highlighted(page);
      // Full strength: two reads in a row agree (the fade-in rewrites the rules every frame).
      await page.waitForTimeout(350);
      const again = await highlighted(page);
      least = Math.min(...again.map((h) => h.ratio));
      return all.length === count && JSON.stringify(all) === JSON.stringify(again);
    })
    .toBe(true);
  return least;
}

test.describe("highlights read over any colour (LK-02, sites-05)", () => {
  test("light words on a dark footer or a blue button stay readable on a light page, at rest and open", async ({
    page,
  }) => {
    await page.goto(fixture("controls.html"));
    await page.evaluate(async () => {
      const f = document.createElement("footer");
      f.id = "ft";
      f.style.cssText = "background:#1d1d1f;color:#f2f2f2;padding:20px";
      f.textContent = "Cancel anytime. No card needed.";
      document.body.append(f);
      const w = window as any;
      w.pu = await w.Pipeup.mount({});
    });
    await seedText(page, "#ft", "Cancel anytime", "Is this true?");
    await seedText(page, "#cta", "free trial", "How long?");
    await seedText(page, "h1", "Answers in minutes", "Too bold?");
    expect(await leastReadable(page, 3)).toBeGreaterThanOrEqual(4.5);
    // The page's own dark words keep their pale highlight; the light words get the deep one.
    const names = Object.fromEntries((await highlighted(page)).map((h) => [h.words, h.name]));
    expect(names).toEqual({
      "Cancel anytime": "pipeup-quote-d",
      "free trial": "pipeup-quote-d",
      "Answers in minutes": "pipeup-quote",
    });
    // Pointed at, the stronger highlight still reads.
    const spot = await page.evaluate(() => {
      const r = [...CSS.highlights.get("pipeup-quote-d")!].find((r) => r.toString() === "free trial")!;
      const b = (r as Range).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await page.mouse.move(spot.x, spot.y);
    await expect
      .poll(async () => (await highlighted(page)).find((h) => h.words === "free trial")?.name)
      .toBe("pipeup-on-d");
    expect(await leastReadable(page, 3)).toBeGreaterThanOrEqual(4.5);
  });

  test("Theme › Light on a dark page leaves its highlighted words readable", async ({ page }) => {
    await page.goto(fixture("doc.html"));
    await page.evaluate(async () => {
      document.body.style.background = "#141414";
      document.body.style.color = "#bbb";
      const w = window as any;
      w.pu = await w.Pipeup.mount({});
    });
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await expect(page.locator(".layer")).toHaveClass(/dark/);
    expect(await leastReadable(page, 1)).toBeGreaterThanOrEqual(4.5);
    await theme(page, "Light");
    await expect(page.locator(".layer")).not.toHaveClass(/dark/);
    expect(await leastReadable(page, 1)).toBeGreaterThanOrEqual(4.5);
    // And Theme › Dark on a light page.
    await page.evaluate(() => {
      document.body.style.background = "#fff";
      document.body.style.color = "#222";
    });
    await theme(page, "Dark");
    await expect(page.locator(".layer")).toHaveClass(/dark/);
    await expect.poll(async () => (await highlighted(page))[0]?.name).toBe("pipeup-quote");
    expect(await leastReadable(page, 1)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("forced colours keep every state visible (LK-03)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
  });
  /** A switch as drawn: its outline, track and knob, and how they stand out from the menu behind and each other. */
  const drawn = (sw: Locator) =>
    sw.evaluate((el) => {
      const k = (window as any).__k;
      const s = getComputedStyle(el);
      const menu = k.behind(el.parentElement!);
      const track = k.blend(k.rgba(s.backgroundColor), menu);
      return {
        border: parseFloat(s.borderTopWidth),
        edge: k.ratio(k.rgba(s.borderTopColor), menu),
        knob: k.ratio(k.rgba(getComputedStyle(el, "::after").backgroundColor), track),
        track: s.backgroundColor,
      };
    });

  test("switches, the comment control in comment mode, the filters and your own reaction all show", async ({
    page,
  }) => {
    await open(page, "doc.html");
    const id = await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await page.evaluate(async (id) => {
      const w = window as any;
      const t = w.pu.document.threads().find((t: any) => t.id === id);
      await w.pu.document.react(t.root.id, "👍");
    }, id);
    await openMenu(page);
    const hide = page.getByRole("menuitemcheckbox", { name: "Hide comments" });
    const off = await drawn(hide.locator(".sw"));
    expect(off.border).toBeGreaterThanOrEqual(1);
    expect(off.edge).toBeGreaterThanOrEqual(3);
    expect(off.knob).toBeGreaterThanOrEqual(3);
    await hide.click();
    await expect(hide).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await drawn(hide.locator(".sw"))).knob).toBeGreaterThanOrEqual(3);
    const on = await drawn(hide.locator(".sw"));
    expect(on.track).not.toBe(off.track);
    await hide.click();
    await page.keyboard.press("Escape");

    // Comment mode shows on the control itself.
    const corner = () => page.locator(".launch").evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await corner();
    await showComments(page);
    const highlight = await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.cssText = "forced-color-adjust:none;color:Highlight";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(before).not.toBe(highlight);
    await expect.poll(corner).toBe(highlight);

    // An "on" filter's word reads on its fill; "off" isn't filled.
    await openAll(page);
    const forYou = page.getByRole("button", { name: "For you" });
    await forYou.click();
    await expect(forYou).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => reads(forYou)).toBeGreaterThanOrEqual(4.5);
    await expect(forYou).toHaveCSS("background-color", highlight);
    await expect(page.getByRole("button", { name: "Resolved", exact: true })).not.toHaveCSS(
      "background-color",
      highlight,
    );
    await forYou.click();
    await page.getByRole("button", { name: "Close" }).click();

    // Your own reaction is marked.
    await page.locator(".th").first().click();
    const mine = page.locator(".th .rx[aria-pressed=true]");
    await expect(mine).toHaveCSS("background-color", highlight);
    expect(await reads(mine.locator(".n"))).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("the page's accent is used only when its words read (LK-05)", () => {
  const accentOf = (page: Page) =>
    page.locator(".layer").evaluate((el) => el.style.getPropertyValue("--pu-accent"));
  const withStyle = async (page: Page, css: string) => {
    await page.goto(fixture("doc.html"));
    await page.evaluate(async (css) => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.append(s);
      const w = window as any;
      w.pu = await w.Pipeup.mount({});
    }, css);
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  };
  /** Words drawn in or on the accent: the reply's Cancel and Reply, and For you turned on. */
  const accentWords = async (page: Page) => {
    await page.locator(".th").first().click();
    await page.keyboard.type("Sounds right");
    const row = page.locator(".th.on .rbox");
    await expect(row.locator(".send")).toHaveClass(/show/);
    const out: number[] = [];
    // Each is read once its colours have eased in.
    for (const l of [row.locator(".cnl"), row.locator(".send")]) {
      await settled(l);
      out.push(await reads(l));
    }
    await page.keyboard.press("Escape");
    await openAll(page);
    const forYou = page.getByRole("button", { name: "For you" });
    await forYou.click();
    await expect(forYou).toHaveAttribute("aria-pressed", "true");
    await settled(forYou);
    out.push(await reads(forYou));
    return out;
  };

  test("a mid-blue link colour (3.7 to 1 on white) gives way to Pipeup's own accent", async ({ page }) => {
    await withStyle(page, "a { color: #3b82f6 }");
    expect(await accentOf(page)).toBe("#534AB7");
    for (const r of await accentWords(page)) expect(r).toBeGreaterThanOrEqual(4.5);
  });

  test("an author's pale --pipeup-accent gives way; a readable one is used, in the look where it reads", async ({
    page,
  }) => {
    await withStyle(page, "html { --pipeup-accent: #f5c400 }");
    expect(await accentOf(page)).toBe("#534AB7");
    for (const r of await accentWords(page)) expect(r).toBeGreaterThanOrEqual(4.5);

    await withStyle(page, "html { --pipeup-accent: #0b5394 }");
    expect(await accentOf(page)).toBe("#0b5394");
    // Dark navy can't be read on the dark look's surface: there Pipeup's own accent for dark is used.
    await theme(page, "Dark");
    await expect.poll(() => accentOf(page)).toBe("#9A94EE");
  });
});

test("each comment, and the box it is written in, reads in its own direction (LK-07)", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "new onboarding flow", "هل هذا صحيح؟ نعم، 20% في يوليو.");
  await seedText(page, "#p3", "pricing work", "Who owns pricing?");
  const tx = page.locator(".th .root > .tx");
  await expect(tx.first()).toHaveCSS("direction", "rtl");
  await expect(tx.nth(1)).toHaveCSS("direction", "ltr");
  // Right to left, the words sit against the right edge.
  const gap = await tx.first().evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return el.getBoundingClientRect().right - r.getBoundingClientRect().right;
  });
  expect(gap).toBeLessThan(2);
  await page.locator(".th").first().click();
  const reply = page.locator(".th.on .rbox textarea");
  await reply.fill("שלום, זה נכון");
  await expect(reply).toHaveCSS("direction", "rtl");
  await reply.fill("Hello");
  await expect(reply).toHaveCSS("direction", "ltr");
});

test("a long comment shows its first lines and 'more' at rest, all of it once open (LK-04)", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "new onboarding flow", "Is the date right? ".repeat(110));
  await seedText(page, "#p3", "pricing work", "Who owns pricing?");
  const long = page.locator(".th", { hasText: "Is the date right?" });
  const more = long.locator(".mr");
  await expect(long).toHaveClass(/\blong\b/);
  await expect(more).toHaveCSS("opacity", "1");
  const box = await long.boundingBox();
  expect(box!.height).toBeLessThan(170);
  // The thread after it sits level with its words, as threads should.
  const short = page.locator(".th", { hasText: "Who owns pricing?" });
  const words = await page.locator("#p3").boundingBox();
  await expect.poll(async () => (await short.boundingBox())!.y).toBeLessThan(words!.y + 10);
  // Opened, all of it shows and "more" goes.
  await long.click();
  await expect(more).toHaveCSS("opacity", "0");
  const tx = long.locator(".root > .tx");
  await expect.poll(() => tx.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThan(2);
  expect((await long.boundingBox())!.height).toBeGreaterThan(500);
});

test.describe("keyboard focus is plainly marked (KB-09)", () => {
  for (const look of ["Light", "Dark"] as const) {
    test(`menu rows, All comments cards and a card's actions show a 3 to 1 focus ring (${look})`, async ({
      page,
    }) => {
      await open(page, "doc.html");
      await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
      await theme(page, look);
      /** The focused element's ring, and how it stands out from what is behind it. */
      const ring = () =>
        page.evaluate(() => {
          const k = (window as any).__k;
          const a = document.querySelector("pipeup-root")!.shadowRoot!.activeElement as HTMLElement;
          const s = getComputedStyle(a);
          return {
            cls: a.className,
            width: s.outlineStyle === "none" ? 0 : parseFloat(s.outlineWidth),
            ratio: k.ratio(k.rgba(s.outlineColor), k.behind(a)),
          };
        });
      await control(page).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".menu.show")).toHaveCount(1);
      for (const key of ["ArrowUp", "ArrowUp"]) {
        const r = await ring();
        expect(r.cls).toContain("mi");
        expect(r.width).toBeGreaterThanOrEqual(2);
        expect(r.ratio).toBeGreaterThanOrEqual(3);
        await page.keyboard.press(key);
      }
      await page.keyboard.press("Escape");
      // All comments, from the keyboard: focus lands on the first card.
      await control(page).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: /All comments/ }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".all.show")).toHaveCount(1);
      await expect.poll(async () => (await ring()).cls).toBe("mi");
      expect((await ring()).width).toBeGreaterThanOrEqual(2);
      expect((await ring()).ratio).toBeGreaterThanOrEqual(3);
      // Then into the card's own actions.
      await page.keyboard.press("Tab");
      const r = await ring();
      expect(r.cls).toContain("ib");
      expect(r.width).toBeGreaterThanOrEqual(2);
      expect(r.ratio).toBeGreaterThanOrEqual(3);
    });
  }
});

test("the other-slides dot reads on the comment control in comment mode (SL-10)", async ({ page }) => {
  await open(page, "deck.html");
  await seedView(page, "[data-pipeup-id=s2-q4]", "Bar on two", { slide: "2" });
  await showComments(page);
  const dot = page.locator(".launch .mode .dot");
  await expect(dot).toHaveCSS("opacity", "1");
  // Once the control has eased into comment mode's colour (and the dot into its own).
  await settled(page.locator(".launch"));
  await settled(dot);
  const ratio = await dot.evaluate((el) => {
    const k = (window as any).__k;
    return k.ratio(k.rgba(getComputedStyle(el).backgroundColor), k.behind(el.closest(".launch")!));
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
});

test("the count fits inside its bubble at 10, 99 and 99+, at a readable size (MD-13, LK-18)", async ({
  page,
}) => {
  await open(page, "doc.html");
  for (const [n, text] of [
    [10, "10"],
    [99, "99"],
    [120, "99+"],
  ] as const) {
    await page.evaluate(async (n) => {
      const w = window as any;
      const at = document.querySelector("#p2")!;
      for (let i = w.pu.document.threads().length; i < n; i++)
        await w.pu.document.comment(w.Pipeup.describeElement(at, document.body), `Note ${i}`);
    }, n);
    const num = page.locator(".launch .mode .n.on");
    await expect(num).toHaveText(text);
    await page.waitForTimeout(400);
    // The words' ink (measured from the font, around its baseline), and the clear space between it and the outline.
    const fit = await num.evaluate((n) => {
      const root = n.getRootNode() as ShadowRoot;
      const r = document.createRange();
      r.selectNodeContents(n);
      const box = r.getBoundingClientRect();
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      n.append(probe);
      const base = probe.getBoundingClientRect().top;
      probe.remove();
      const cs = getComputedStyle(n);
      const c = document.createElement("canvas").getContext("2d")!;
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      c.letterSpacing = cs.letterSpacing;
      const m = c.measureText(n.textContent!);
      const t = {
        left: box.left - m.actualBoundingBoxLeft,
        right: box.left + m.actualBoundingBoxRight,
        top: base - m.actualBoundingBoxAscent,
        bottom: base + m.actualBoundingBoxDescent,
      };
      const svg = [...root.querySelectorAll<SVGSVGElement>(".cnt>svg")].find(
        (s) => getComputedStyle(s).opacity === "1",
      )!;
      const path = svg.querySelector("path")!;
      const to = path.getScreenCTM()!.inverse();
      const clear = (d: number) => {
        for (let i = 0; i <= 8; i++) {
          const x = t.left - d + ((t.right - t.left + 2 * d) * i) / 8;
          const y = t.top - d + ((t.bottom - t.top + 2 * d) * i) / 8;
          for (const [px, py] of [
            [x, t.top - d],
            [x, t.bottom + d],
            [t.left - d, y],
            [t.right + d, y],
          ]) {
            const p = new DOMPoint(px, py).matrixTransform(to);
            if (path.isPointInStroke(p) || !path.isPointInFill(p)) return false;
          }
        }
        return true;
      };
      return { size: parseFloat(cs.fontSize), clear: clear(1) };
    });
    expect(fit.size).toBeGreaterThanOrEqual(10);
    expect(fit.clear).toBe(true);
  }
});

/**
 * Samples what `read` returns every frame while `act` runs, for `ms` milliseconds. `read` runs in the page with
 * Pipeup's shadow root.
 */
async function frames<T>(
  page: Page,
  read: (root: ShadowRoot) => T,
  act: () => Promise<void>,
  ms = 1200,
): Promise<T[]> {
  await page.evaluate(
    ({ src, ms }) => {
      const w = window as any;
      const root = document.querySelector("pipeup-root")!.shadowRoot!;
      const fn = new Function("root", `return (${src})(root)`);
      w.__frames = [];
      const t0 = performance.now();
      const tick = () => {
        w.__frames.push(fn(root));
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { src: read.toString(), ms },
  );
  await act();
  await page.waitForTimeout(ms + 100);
  return page.evaluate(() => (window as any).__frames);
}

test.describe("lists and menus ease (LK-08, LK-09, LK-10, LK-16)", () => {
  test("All comments' filters fold cards away and back, and a card eases open and closed", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await seedText(page, "#p2", "second designer", "Who is hiring?");
    await seedText(page, "#p3", "pricing work", "Who owns pricing?");
    await openAll(page);
    await expect(page.locator(".all .cd")).toHaveCount(3);
    await settled(page.locator(".all"));
    const cards = (root: ShadowRoot) =>
      [...root.querySelectorAll<HTMLElement>(".list .cd")].map((c) => ({
        o: +getComputedStyle(c).opacity,
        h: c.getBoundingClientRect().height,
      }));
    const forYou = page.getByRole("button", { name: "For you" });
    // Away: in the frames between all three showing and none, the cards are part faded and part folded.
    const away = await frames(page, cards, () => forYou.click());
    expect(away.at(-1)).toEqual([]);
    expect(away.some((f) => f.length === 3 && f.some((c) => c.o > 0.05 && c.o < 0.95))).toBe(true);
    expect(away.some((f) => f.length === 3 && f.some((c) => c.h > 5 && c.h < 60))).toBe(true);
    // Back: they arrive unseen and grow.
    const back = await frames(page, cards, () => forYou.click());
    expect(back.find((f) => f.length === 3)!.every((c) => c.o < 0.5)).toBe(true);
    expect(back.at(-1)!.every((c) => c.o === 1)).toBe(true);
    // Opening a card: its height eases, no frame jumps more than a third of the way.
    const height = (root: ShadowRoot) =>
      [...root.querySelectorAll<HTMLElement>(".list .cd")].map((c) => c.getBoundingClientRect().height)[0]!;
    const opening = await frames(page, height, () => page.locator(".all .cd").first().click());
    const total = opening.at(-1)! - opening[0]!;
    expect(total).toBeGreaterThan(40);
    const steps = opening.slice(1).map((h, i) => h - opening[i]!);
    expect(Math.max(...steps)).toBeLessThan(total / 3);
    // Closing (a click on its top line) eases too.
    const closing = await frames(page, height, () => page.locator(".all .cd.open .root > .hdr .who").click());
    const down = closing.slice(1).map((h, i) => closing[i]! - h);
    expect(closing[0]! - closing.at(-1)!).toBeGreaterThan(40);
    expect(Math.max(...down)).toBeLessThan((closing[0]! - closing.at(-1)!) / 3);
  });

  test("a sent comment takes its box's place in the column; nothing jumps", async ({ page }) => {
    await open(page, "doc.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await seedText(page, "#p3", "pricing work", "Who owns pricing?");
    await showComments(page);
    const b = (await page.locator("#p2").boundingBox())!;
    await page.mouse.click(b.x + 40, b.y + 10);
    await expect(page.locator(".th.on .draft")).toHaveCount(1);
    await page.keyboard.type("Posted words");
    await page.waitForTimeout(400);
    const tops = (root: ShadowRoot) =>
      [...root.querySelectorAll<HTMLElement>(".col > .th")].map((el) => ({
        draft: !!el.querySelector(".draft"),
        words: el.querySelector(".root > .tx")?.textContent ?? "",
        top: Math.round(el.getBoundingClientRect().top),
        o: +getComputedStyle(el).opacity,
      }));
    const seen = await frames(page, tops, () => page.keyboard.press("Enter"));
    const draftTop = seen[0]!.find((c) => c.draft)!.top;
    const posted = seen.flatMap((f) => f.filter((c) => c.words === "Posted words" && c.o > 0));
    expect(posted.length).toBeGreaterThan(0);
    for (const c of posted) expect(Math.abs(c.top - draftTop)).toBeLessThanOrEqual(2);
    // The threads already there never move more than a few px in a frame.
    for (const words of ["Is this the plan?", "Who owns pricing?"]) {
      const ys = seen.map((f) => f.find((c) => c.words === words)?.top).filter((y) => y !== undefined);
      const steps = ys.slice(1).map((y, i) => Math.abs(y! - ys[i]!));
      expect(Math.max(...steps)).toBeLessThan(12);
    }
  });

  test("with reduced motion, column threads only move while unseen, and a new comment's box fades in", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "doc.html");
    await seedText(page, "#p2", "second designer", "Who is hiring?");
    await seedText(page, "#p3", "pricing work", "Who owns pricing?");
    await showComments(page);
    await page.waitForTimeout(400);
    const cards = (root: ShadowRoot) =>
      [...root.querySelectorAll<HTMLElement>(".col > .th")].map((el) => ({
        draft: !!el.querySelector(".draft"),
        words: el.querySelector(".root > .tx")?.textContent ?? "",
        top: el.getBoundingClientRect().top,
        o: +getComputedStyle(el).opacity,
      }));
    const b = (await page.locator("#p1").boundingBox())!;
    const seen = await frames(page, cards, () => page.mouse.click(b.x + 40, b.y + 10), 900);
    const drafts = seen.map((f) => f.find((c) => c.draft)).filter(Boolean);
    expect(drafts[0]!.o).toBeLessThan(0.5);
    let moved = 0;
    for (const words of ["Who is hiring?", "Who owns pricing?"])
      for (let i = 1; i < seen.length; i++) {
        const was = seen[i - 1]!.find((c) => c.words === words);
        const now = seen[i]!.find((c) => c.words === words);
        if (!was || !now || Math.abs(now.top - was.top) < 0.5) continue;
        moved++;
        expect(Math.max(was.o, now.o)).toBeLessThan(0.05);
      }
    expect(moved).toBeGreaterThan(0);
  });

  test("the menu fades out whole when All comments is chosen, and ⋯ changes in place on Delete", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await openMenu(page);
    await page.waitForTimeout(400);
    const menu = (root: ShadowRoot) => {
      const m = root.querySelector<HTMLElement>(".menu")!;
      const r = m.getBoundingClientRect();
      return { o: +getComputedStyle(m).opacity, h: Math.round(r.height), bottom: Math.round(r.bottom) };
    };
    const seen = await frames(page, menu, () => page.getByRole("menuitem", { name: /All comments/ }).click());
    const showing = seen.filter((f) => f.o > 0.02);
    expect(showing.length).toBeGreaterThan(1);
    // It keeps its rows and its place, apart from its own small eased drop as it fades.
    for (const f of showing) {
      expect(f.h).toBe(seen[0]!.h);
      expect(Math.abs(f.bottom - seen[0]!.bottom)).toBeLessThanOrEqual(6);
    }
    await page.getByRole("button", { name: "Close" }).click();

    await page.locator(".th").first().click();
    await page.locator(".th.on .root button[aria-label=More]").click();
    await expect(page.locator(".th.on .pm")).toHaveCount(1);
    await page.waitForTimeout(400);
    const pm = (root: ShadowRoot) => {
      const m = root.querySelector<HTMLElement>(".th.on .pm");
      return m ? +getComputedStyle(m).opacity : -1;
    };
    const asked = await frames(page, pm, () => page.getByRole("menuitem", { name: "Delete" }).click());
    await expect(page.getByRole("menuitem", { name: "Delete for everyone" })).toHaveCount(1);
    expect(Math.min(...asked)).toBeGreaterThan(0.95);
  });
});

test.describe("words match the controls (MD-16, T18, MD-14)", () => {
  test("Resolve's message names ✓ Resolved; the Theme tooltip says Automatic once", async ({ page }) => {
    await open(page, "doc.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await page.locator(".th").first().click();
    await page.locator(".th.on button[aria-label=Resolve]").click();
    const toast = page.locator(".toast.show");
    await expect(toast).toContainText("✓ Resolved in All comments");
    await expect(toast).not.toContainText("Show resolved");
    await openMenu(page);
    const tip = await page.locator(".menu .mi", { hasText: "Theme" }).locator(".tt").textContent();
    expect(tip!.match(/Automatic/g)).toHaveLength(1);
  });

  test("For you's tooltip goes once it is on, so its message can be read", async ({ page }) => {
    await open(page, "doc.html");
    await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
    await openAll(page);
    const forYou = page.getByRole("button", { name: "For you" });
    const tipShown = () => forYou.evaluate((el) => getComputedStyle(el, "::after").opacity);
    await forYou.hover();
    await expect.poll(tipShown).toBe("1");
    await forYou.click();
    await expect(page.locator(".list .sec")).toHaveText("No comments mention you");
    await expect.poll(tipShown).toBe("0");
  });
});

test("a short name uses the card's width while its actions are hidden, and the card keeps its size (MD-15)", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Samantha Lee-Hartley" });
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  const th = page.locator(".th").first();
  const who = th.locator(".root .who");
  await expect(who).toHaveText("Samantha Lee-Hartley");
  // At rest the whole name shows.
  await expect.poll(() => who.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  const rest = (await th.boundingBox())!;
  // Pointed at, the actions ease in over the end of the line; the card stays the same size.
  await th.hover();
  await expect(th.locator(".acts")).toHaveCSS("opacity", "1");
  const hovered = (await th.boundingBox())!;
  expect(hovered.height).toBe(rest.height);
  expect(hovered.width).toBe(rest.width);
});

test("a look that differs from the page keeps cards and the corner solid (LK-19)", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await seedText(page, "#p3", "pricing work", "Who owns pricing?");
  await theme(page, "Dark");
  await expect(page.locator(".layer")).toHaveClass(/flip/);
  // The corner's glass is solid in the dark look on a white page, and its count reads.
  const corner = page.locator(".launch");
  await expect
    .poll(() => corner.evaluate((el) => (window as any).__k.rgba(getComputedStyle(el).backgroundColor)[3]))
    .toBe(1);
  expect(await reads(page.locator(".launch .mode"))).toBeGreaterThanOrEqual(4.5);
  // A new comment dims the other threads: their cards stay dark (not grey), their words dim.
  await showComments(page);
  const b = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(b.x + 40, b.y + 10);
  const dim = page.locator(".th.dim").first();
  await expect(dim).toHaveCount(1);
  await page.waitForTimeout(400);
  const seen = await dim.evaluate((el) => {
    const k = (window as any).__k;
    const card = k.rgba(getComputedStyle(el).backgroundColor);
    return {
      opacity: +getComputedStyle(el).opacity,
      card: k.lum(card),
      words: +getComputedStyle(el.lastElementChild!).opacity,
    };
  });
  expect(seen.opacity).toBe(1);
  expect(seen.card).toBeLessThan(0.05);
  expect(seen.words).toBeLessThan(0.6);
});

test("the column's long-comment mark and actions sit on the card's own colour in both looks", async ({
  page,
}) => {
  await page.goto(fixture("doc.html"));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  await seedElement(page, "#p2", "Check this");
  for (const look of ["Light", "Dark"] as const) {
    await theme(page, look);
    const th = page.locator(".th").first();
    await th.hover();
    await expect(th.locator(".acts")).toHaveCSS("opacity", "1");
    const same = await th.evaluate((el) => {
      const acts = el.querySelector(".acts")!;
      return getComputedStyle(acts).backgroundImage.includes(getComputedStyle(el).backgroundColor);
    });
    expect(same).toBe(true);
  }
});
