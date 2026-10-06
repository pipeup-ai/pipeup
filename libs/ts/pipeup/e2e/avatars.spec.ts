import { expect, test, type Locator, type Page } from "@playwright/test";
import { open, seedText, selectWords, settled, showComments } from "./helpers";

const animal = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    return w.Pipeup.animalName(w.pu.document.me) as string;
  });

/** Boxes of a comment, its words and its avatar, relative to the viewport. */
const boxes = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const box = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(selector)!;
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, width: b.width };
    };
    const av = box.querySelector(":scope > .av");
    const measure = () => ({ box: r(box)!, words: r(box.querySelector(":scope > .tx"))!, av: r(av) });
    const withAvatar = measure();
    // Take the avatar out and measure again, in the same task: the words must not move or widen.
    const parent = av!.parentNode!;
    const next = av!.nextSibling;
    av!.remove();
    const without = measure();
    parent.insertBefore(av!, next);
    return { withAvatar, without, html: av!.outerHTML };
  }, selector);

test("each comment shows its writer's avatar at its top right, and the words never move for it", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic? This line is long enough to wrap.");
  await page.evaluate(
    (id) => (window as any).pu.document.reply(id, "Yes, if the second designer starts"),
    id,
  );
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  await settled(th.locator(".root > .av"));
  await settled(th.locator(".it > .av"));
  const me = await animal(page);
  await expect(th.locator(".av")).toHaveCount(2);
  for (const av of await th.locator(".av").all()) await expect(av).toHaveAttribute("data-animal", me);

  for (const selector of [".th .root", ".th .rps .it"]) {
    const { withAvatar: a, without: b, html } = await boxes(page, selector);
    // Top right of the comment, clear of the words.
    expect(Math.abs(a.av!.right - a.box.right)).toBeLessThan(1);
    expect(a.av!.top - a.box.top).toBeLessThan(8);
    expect(a.av!.left).toBeGreaterThanOrEqual(a.words.right);
    // The words keep their left edge and width without it.
    expect(b.words).toEqual(a.words);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  }

  // Adding a name: the avatar shows the initial, the hover detail the name; the words still don't move.
  const before = (await boxes(page, ".th .root")).withAvatar.words;
  await page.evaluate(() => ((window as any).pu.document.name = "Sam"));
  await expect(th.locator(".root > .av").last()).toHaveText("S");
  // The old face leaves once the new one covers it.
  await expect(th.locator(".root > .av")).toHaveCount(1);
  await settled(th.locator(".root > .av"));
  await th.locator(".root").hover();
  await expect(th.locator(".root .who")).toHaveText("Sam · just now");
  const after = await boxes(page, ".th .root");
  expect(after.withAvatar.words).toEqual(before);
  expect(after.without.words).toEqual(before);
});

test("an avatar eases in and stays put while the thread re-renders", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const av = page.locator(".th .root > .av");
  await expect(av).toHaveClass(/\bin\b/);
  expect(await av.evaluate((el) => getComputedStyle(el).transitionDuration)).toContain("0.26s");
  await av.evaluate((el) => ((el as any).__same = true));
  await page.locator(".th .tx").first().hover();
  await page.locator(".th .tx").first().click();
  expect(await av.evaluate((el) => (el as any).__same === true)).toBe(true);
});

test("the first comment needs no name; the draft says who you are and takes a name in place", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  const me = await animal(page);
  await selectWords(page, "#p1", "pricing changes");
  await page.locator(".selbar.show button").click();
  const draft = page.locator(".draft");
  await expect(draft.locator(".nf")).toHaveAttribute("inert", "");
  await expect(draft.locator(".say")).toHaveText(`You're ${me} · add your name`);
  await expect(draft.locator(".row .me .av")).toHaveAttribute("data-animal", me);
  const plane = await draft.locator(".send path").getAttribute("d");
  expect(plane).toBe("M21 12L3.5 4.5 6.2 12l-2.7 7.5zM6.2 12H13");

  await draft.getByRole("button", { name: "add your name" }).click();
  const field = draft.getByRole("textbox", { name: "Your name" });
  await expect(field).toBeFocused();
  await expect(draft.locator(".say")).toHaveAttribute("inert", "");
  await page.keyboard.type("Sam");
  await page.keyboard.press("Enter");
  await expect(draft.locator(".say")).toHaveText("Sam · change");
  await expect(draft.locator(".row .me .av").last()).toHaveText("S");
  await expect(draft.getByRole("textbox", { name: "Comment" })).toBeFocused();
  await expect(page.locator(".toast.show")).toContainText("New comments will say Sam");

  await page.keyboard.type("Which changes?");
  await page.keyboard.press("Enter");
  const th = page.locator(".th", { hasText: "Which changes?" });
  await th.locator(".root").hover();
  await expect(th.locator(".who").first()).toHaveText("Sam · just now");
  await expect(th.locator(".root > .av").last()).toHaveText("S");
});

test("one identity is the same animal after a reload", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  const first = await page.evaluate(() => (window as any).pu.document.me);
  const me = await animal(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.reload();
  await page.evaluate(async () => ((window as any).pu = await (window as any).Pipeup.mount()));
  await showComments(page);
  expect(await page.evaluate(() => (window as any).pu.document.me)).toBe(first);
  await expect(page.locator(".th .root > .av")).toHaveAttribute("data-animal", me);
});

/**
 * Samples, every frame for `ms`, the most opaque avatar in `spot` (a selector in Pipeup's shadow root) while
 * `change` runs. The spot must never be empty or see-through while the face changes.
 */
async function sampleSpot(
  page: Page,
  spot: string,
  change: () => Promise<void>,
  ms = 700,
): Promise<number[]> {
  await page.evaluate((spot) => {
    const w = window as any;
    const root = document.querySelector("pipeup-root")!.shadowRoot!;
    w.__samples = [];
    w.__sampling = true;
    const tick = () => {
      const els = [...root.querySelectorAll(spot)];
      w.__samples.push(els.reduce((m, el) => Math.max(m, Number(getComputedStyle(el).opacity)), 0));
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, spot);
  await change();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as any;
    w.__sampling = false;
    return w.__samples as number[];
  });
}

test("a changing avatar cross-fades: its spot is never empty or see-through", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const av = page.locator(".th .root > .av");
  await expect(av).toHaveClass(/\bin\b/);
  await settled(av);
  const thread = await sampleSpot(page, ".th .root > .av", () =>
    page.evaluate(() => void ((window as any).pu.document.name = "Sam")),
  );
  expect(thread.length).toBeGreaterThan(10);
  expect(Math.min(...thread)).toBeGreaterThan(0.95);
  await expect(page.locator(".th .root > .av")).toHaveCount(1);
  await expect(page.locator(".th .root > .av")).toHaveText("S");

  await page.mouse.click(900, 700);
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  const draft = page.locator(".draft");
  await settled(draft.locator(".me .av"));
  await draft.getByRole("button", { name: "change" }).click();
  await draft.getByRole("textbox", { name: "Your name" }).fill("Amy");
  const inDraft = await sampleSpot(page, ".draft .me .av", () =>
    draft.getByRole("textbox", { name: "Your name" }).press("Enter"),
  );
  expect(Math.min(...inDraft)).toBeGreaterThan(0.95);
  await expect(draft.locator(".me .av")).toHaveCount(1);
  await expect(draft.locator(".me .av")).toHaveText("A");
});

test("long names are cut short with an ellipsis, on one line", async ({ page }) => {
  await open(page, "doc.html", {
    name: "Bartholomew Montgomery-Fitzwilliam the Third of Somewhere Rather Far",
  });
  await showComments(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate((id) => (window as any).pu.document.reply(id, "Reply"), id);
  const th = page.locator(".th");
  await th.locator(".tx").first().click();
  const oneLine = (who: Locator) =>
    who.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        overflow: el.scrollWidth > el.clientWidth,
        ellipsis: s.textOverflow,
        wrap: s.whiteSpace,
        short: el.clientHeight < 24,
      };
    });
  const clipped = { overflow: true, ellipsis: "ellipsis", wrap: "nowrap", short: true };
  await th.locator(".root").hover();
  await expect.poll(() => oneLine(th.locator(".root .who"))).toEqual(clipped);
  await th.locator(".rps .it").hover();
  await expect.poll(() => oneLine(th.locator(".rps .who"))).toEqual(clipped);
  await page.mouse.click(900, 700);
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  const say = page.locator(".draft .say");
  const name = await say.locator(".nm").evaluate((el) => {
    const s = getComputedStyle(el);
    return { overflow: el.scrollWidth > el.clientWidth, ellipsis: s.textOverflow, wrap: s.whiteSpace };
  });
  expect(name).toMatchObject({ overflow: true, ellipsis: "ellipsis", wrap: "nowrap" });
  // The action stays whole and inside the line.
  const line = (await say.boundingBox())!;
  const action = (await say.getByRole("button", { name: "change" }).boundingBox())!;
  expect(action.x + action.width).toBeLessThanOrEqual(line.x + line.width + 0.5);
  expect(line.height).toBeLessThan(30);
});
