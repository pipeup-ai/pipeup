import { expect, type Locator, type Page } from "@playwright/test";

/** A fixture page as a file:// URL (the package is an ES module, so no __dirname). */
export const fixture = (name: string): string => new URL(`fixtures/${name}`, import.meta.url).href;

/** Opens a fixture and mounts Pipeup; the instance is window.pu. */
export async function open(page: Page, name: string, options: Record<string, unknown> = {}): Promise<void> {
  await page.goto(fixture(name));
  await page.evaluate(async (o) => {
    const w = window as any;
    w.pu = await w.Pipeup.mount(o);
  }, options);
}

const FIND_RANGE = `(el, words) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.data.indexOf(words);
    if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + words.length); return r; }
  }
  throw new Error('"' + words + '" not found');
}`;

/** Comments on some words through the API (no UI), returning the thread id. */
export async function seedText(page: Page, selector: string, words: string, text: string): Promise<string> {
  return page.evaluate(
    ({ selector, words, text, find }) => {
      const w = window as any;
      const range = new Function(`return ${find}`)()(document.querySelector(selector), words);
      return w.pu.document.comment(w.Pipeup.describeRange(range, document.body), text);
    },
    { selector, words, text, find: FIND_RANGE },
  );
}

export async function seedElement(
  page: Page,
  selector: string,
  text: string,
  point?: { x: number; y: number },
): Promise<string> {
  return page.evaluate(
    ({ selector, text, point }) => {
      const w = window as any;
      return w.pu.document.comment(
        w.Pipeup.describeElement(document.querySelector(selector), document.body, point ?? undefined),
        text,
      );
    },
    { selector, text, point: point ?? null },
  );
}

/** Selects words as a reader would and lets Pipeup notice (mouseup). */
export async function selectWords(page: Page, selector: string, words: string): Promise<void> {
  await page.evaluate(
    ({ selector, words, find }) => {
      const range = new Function(`return ${find}`)()(document.querySelector(selector), words);
      const sel = getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    },
    { selector, words, find: FIND_RANGE },
  );
}

/** The page's own DOM and layout, to prove Pipeup changed neither. */
export async function bodySnapshot(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      html: document.body.innerHTML,
      head: document.head.innerHTML,
      attrs: [...document.documentElement.attributes].map((a) => `${a.name}=${a.value}`),
      rects: [...document.body.querySelectorAll("*")].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map(Math.round);
      }),
    }),
  );
}

/** Captures clipboard writes in window.__copied (file:// pages can't be granted clipboard permissions). */
export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (t: string) => void (window as any).__copied.push(t) },
    });
  });
}

/** Waits for an element's transitions to finish, so its box is where it will rest (not mid-ease). */
export async function settled(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").length))
    .toBe(0);
}

/** What has keyboard focus inside Pipeup's shadow root (empty strings when nothing does). */
export async function focusInPipeup(
  page: Page,
): Promise<{ tag: string; cls: string; text: string; value: string }> {
  return page.evaluate(() => {
    const a = document.querySelector("pipeup-root")?.shadowRoot?.activeElement as HTMLElement | null;
    return {
      tag: a?.tagName ?? "",
      cls: a?.className ?? "",
      text: a?.textContent ?? "",
      value: (a as HTMLTextAreaElement | null)?.value ?? "",
    };
  });
}

/** The reader steps out of Pipeup's reply line (opening a thread puts the cursor there) without closing anything. */
export async function leaveReply(page: Page): Promise<void> {
  await page.evaluate(() =>
    (document.querySelector("pipeup-root")!.shadowRoot!.activeElement as HTMLElement | null)?.blur(),
  );
}

/** The comment control: one round button in the corner. */
export const control = (page: Page): Locator => page.locator(".launch .mode");

/** Opens the comment control's menu: a click on the one round button. */
export async function openMenu(page: Page): Promise<void> {
  await control(page).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
}

/** Turns comment mode on or off from the menu's Start commenting switch, then closes the menu with Esc. */
export async function toggleCommenting(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  // The menu stays open so the switch is seen to move.
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
}

/** Turns comment mode on with its shortcut (comments only show in comment mode), and waits for it. */
export async function showComments(page: Page): Promise<void> {
  await page.keyboard.press("Shift+Alt+KeyC");
  await commenting(page);
}

/** Turns Hide comments on (or off) from the menu's switch, then closes the menu with Esc. */
export async function hideComments(page: Page, on = true): Promise<void> {
  await openMenu(page);
  const sw = page.getByRole("menuitemcheckbox", { name: "Hide comments" });
  if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", String(on));
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
}

/** The middle of the first highlighted words on the page (a text comment's highlight). */
export const quoteSpot = (page: Page): Promise<{ x: number; y: number }> =>
  page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });

/** The key held to pause comment mode where the test runs: Command on a Mac, Ctrl elsewhere. */
export const holdKey = (page: Page): Promise<string> =>
  page.evaluate(() => (/Mac|iP(hone|ad|od)/.test(navigator.platform) ? "Meta" : "Control"));

/** Comment mode is on (or off): the control shows it. */
export async function commenting(page: Page, on = true): Promise<void> {
  if (on) await expect(control(page)).toHaveClass(/\bon\b/);
  else await expect(control(page)).not.toHaveClass(/\bon\b/);
}

/** The view saved with each thread, by its first words. */
export async function savedViews(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() =>
    Object.fromEntries(
      (window as any).pu.document.threads().map((t: any) => [t.root.text, t.anchor.view ?? null]),
    ),
  );
}

/** Comments on an element as if made in `view` (a slide, a tab), through the API, returning the thread id. */
export async function seedView(
  page: Page,
  selector: string,
  text: string,
  view: Record<string, string>,
): Promise<string> {
  return page.evaluate(
    ({ selector, text, view }) => {
      const w = window as any;
      return w.pu.document.comment(
        w.Pipeup.describeElement(document.querySelector(selector), document.body, undefined, view),
        text,
      );
    },
    { selector, text, view },
  );
}
