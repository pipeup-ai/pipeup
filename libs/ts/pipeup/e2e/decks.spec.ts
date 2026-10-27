import { expect, test, type Page } from "@playwright/test";
import {
  control,
  open,
  openAll,
  openMenu,
  copyAs,
  leaveReply,
  savedViews,
  seedView,
  selectWords,
  settled,
  stubClipboard,
  toggleCommenting,
} from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Rect> =>
  (await page.locator(selector).first().boundingBox())!;
const meets = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const draft = (page: Page) => page.locator(".pop.show .draft");

test("a reveal.js deck's own arrows, progress bar and slide number keep working in comment mode", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  await page.evaluate(() => (window as any).Reveal.slide(1));
  await toggleCommenting(page);
  const at = () => page.evaluate(() => (window as any).Reveal.getIndices().h as number);
  // Pointed at, the deck's arrow is not offered as a block: no outline, no name.
  await page.locator(".navigate-left").hover();
  await expect(page.locator(".pick.show:not(.kf)")).toHaveCount(0);
  await page.locator(".navigate-left").click();
  expect(await at()).toBe(0);
  await page.locator(".navigate-right").click();
  expect(await at()).toBe(1);
  await page.locator(".progress").click({ position: { x: 20, y: 1 } });
  expect(await at()).toBe(2);
  await page.locator(".slide-number").click();
  // Nothing of Pipeup's opened over the deck: no comment box and no naming bar.
  await expect(draft(page)).toHaveCount(0);
  await expect(page.locator(".namebar.show")).toHaveCount(0);
});

test("on a deck with controls in the bottom-right corner, the comment control and its messages sit just above them", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  await settled(page.locator(".launch"));
  const mode = await box(page, ".launch");
  const arrows = await box(page, ".controls");
  const number = await box(page, ".slide-number");
  expect(meets(mode, number)).toBe(false);
  expect(meets(mode, arrows)).toBe(false);
  expect(mode.y + mode.height).toBeLessThanOrEqual(arrows.y + 1);
  // Comment mode's hint sits beside the control, clear of the deck's arrows.
  await page.keyboard.press("Shift+Alt+KeyC");
  const hint = page.locator(".toast.show");
  await expect(hint).toHaveCount(1);
  await settled(hint);
  expect(meets((await hint.boundingBox())!, arrows)).toBe(false);
});

test("a reveal.js deck refits beside All comments, and takes the space back when it closes", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  const slides = () => box(page, ".slides");
  const before = await slides();
  await openAll(page);
  await settled(page.locator(".all"));
  await expect
    .poll(async () => {
      const s = await slides();
      return s.x >= 0 && s.x + s.width <= 1280 - 320 + 1;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Close" }).click();
  await expect.poll(async () => Math.round((await slides()).width)).toBe(Math.round(before.width));
});

test("the example deck refits beside All comments on a 1024-wide window", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(new URL("../examples/review-deck.html", import.meta.url).href);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await openAll(page);
  await settled(page.locator(".all"));
  await expect
    .poll(async () => {
      const d = await box(page, ".deck");
      return d.x >= 0 && d.x + d.width <= 1024 - 320 + 1;
    })
    .toBe(true);
});

test("on a deck that scrolls, a slide scrolled into view can be commented on, and the block cursor starts there", async ({
  page,
}) => {
  await open(page, "scroll-deck.html");
  await page.evaluate(() => scrollTo(0, 300));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // The shortcut's block cursor starts on the first block in view, and the page stays where it is.
  await page.keyboard.press("Shift+Alt+KeyC");
  const two = await box(page, "h2");
  await expect.poll(async () => meets(await box(page, ".pick.show"), two)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(300);
  await page.keyboard.press("Escape");
  await toggleCommenting(page);
  // Slide 1 still covers most of the window; slide 2's words show below it, and can be commented on.
  await selectWords(page, "#s2p", "second slide");
  await page.locator(".selbar.show button").click();
  await expect(draft(page).getByRole("textbox", { name: "Comment" })).toBeFocused();
  await page.keyboard.type("Which second?");
  await page.keyboard.press("Enter");
  await expect.poll(() => savedViews(page)).toEqual({ "Which second?": { slide: "2" } });
  // So can its heading, with a click.
  await leaveReply(page);
  await page.locator("h2").first().click();
  await expect(draft(page).getByRole("textbox", { name: "Comment" })).toBeFocused();
  expect(meets((await draft(page).boundingBox())!, { x: 0, y: 0, width: 1280, height: 800 })).toBe(true);
});

test("copying gives the same words for a thread whether or not its slide shows, and names a slide's element plainly", async ({
  page,
}) => {
  await stubClipboard(page);
  await open(page, "deck.html");
  await seedView(page, "#s1p", "Say which quarter", { slide: "1" });
  const copy = async (as: "As Markdown" | "As text") => {
    await openMenu(page);
    await copyAs(page, as);
    return page.evaluate(() => (window as any).__copied.at(-1) as string);
  };
  const shown = await copy("As text");
  expect(shown).toContain("Paragraph · Growth, retention and what we change in…");
  await page.evaluate(() => (window as any).deck.go(2));
  await expect(control(page)).toHaveAttribute("aria-label", /on other slides/);
  expect(await copy("As text")).toBe(shown);
  const md = await copy("As Markdown");
  expect(md).toContain(
    '\n## 1. Slide 1 "Q3 review" › Paragraph · Growth, retention and what we change in…\n',
  );
  expect(md).toContain('· in `data-pipeup-id="s1"`');
});

test("a text comment on a slide that doesn't show keeps its words when copied", async ({ page }) => {
  await stubClipboard(page);
  await open(page, "deck.html");
  await page.evaluate(() => {
    const w = window as any;
    const t = document.querySelector("#s1p")!.firstChild as Text;
    const r = document.createRange();
    r.setStart(t, t.data.indexOf("retention"));
    r.setEnd(t, t.data.indexOf("retention") + 9);
    return w.pu.document.comment(
      w.Pipeup.describeRange(r, document.body, { slide: "1" }),
      "Define retention",
    );
  });
  await page.evaluate(() => (window as any).deck.go(1));
  await openMenu(page);
  await copyAs(page, "As text");
  const text = await page.evaluate(() => (window as any).__copied.at(-1) as string);
  expect(text).toContain(
    'Slide 1 "Q3 review" › Paragraph · Growth, retention and what we change in…, on the text "retention"',
  );
});

test("on a deck, the comment control stays in its corner beside a layer over the window, in a page's dialog and in fullscreen", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  const mode = page.locator(".launch .mode");
  await settled(page.locator(".launch"));
  const rest = Math.round((await mode.boundingBox())!.y);
  const at = async () => Math.round((await mode.boundingBox())!.y);
  // A full-window layer the page asks Pipeup to ignore isn't a control in the corner.
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.setAttribute("data-pipeup-ignore", "");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none";
    document.querySelector(".reveal")!.append(c);
    (window as any).Reveal.next();
  });
  await expect.poll(at).toBe(rest);
  // Inside a page's dialog, Pipeup's own root isn't one either.
  await page.evaluate(() => {
    const d = document.createElement("dialog");
    d.textContent = "Leave without saving?";
    document.body.append(d);
    d.showModal();
  });
  await expect
    .poll(() => page.evaluate(() => document.querySelector("pipeup-root")!.parentElement!.localName))
    .toBe("dialog");
  await expect.poll(at).toBe(rest);
  await page.evaluate(() => {
    document.querySelector("dialog")!.close();
    const b = document.createElement("button");
    b.id = "present";
    b.textContent = "Present";
    b.style.cssText = "position:fixed;left:0;top:0;z-index:20";
    b.onclick = () => document.querySelector(".reveal")!.requestFullscreen();
    document.body.append(b);
  });
  await page.click("#present");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe("reveal");
  await page.evaluate(() => (window as any).Reveal.next());
  await expect.poll(at).toBe(rest);
  // Still just above the deck's own arrows.
  expect((await mode.boundingBox())!.y + (await mode.boundingBox())!.height).toBeLessThanOrEqual(
    (await box(page, ".controls")).y + 1,
  );
});

test("on a reveal.js deck with no markup, the block cursor leaves a slide as it turns, and a comment goes under the slide it is on", async ({
  page,
}) => {
  await open(page, "reveal-deck.html");
  // The old slide stays showing for a moment as the deck turns, as reveal.js's own transitions do.
  await page.addStyleTag({
    content:
      ".reveal .slides>section{transition:visibility 0s 3s}.reveal .slides>section.present{transition:none}",
  });
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".namebar.show")).toContainText("Quarterly review");
  await page.evaluate(() => (window as any).Reveal.next());
  // Slide 1 still shows as it slides away, but nothing of it stays drawn: the cursor is on slide 2.
  await expect(page.locator(".namebar.show")).toContainText("Revenue grew 42%");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Which slide am I on?");
  await page.keyboard.press("Enter");
  await expect.poll(() => savedViews(page)).toEqual({ "Which slide am I on?": { slide: "2" } });
  expect(
    await page.evaluate(() => (window as any).pu.document.threads()[0].anchor.quote?.exact ?? ""),
  ).not.toContain("Quarterly");
});

test("a page that sets html's width still makes room beside All comments", async ({ page }) => {
  await open(page, "reveal-deck.html");
  await page.addStyleTag({ content: "html{width:100%}" });
  await openAll(page);
  await settled(page.locator(".all"));
  await expect
    .poll(() =>
      page.evaluate(() => Math.round(document.querySelector(".controls")!.getBoundingClientRect().right)),
    )
    .toBeLessThanOrEqual(1280 - 320);
});

test("on a deck Pipeup can't turn, a waiting comment on another slide isn't drawn over this one, and Pipeup says where it is", async ({
  page,
}) => {
  await open(page, "deck.html");
  await toggleCommenting(page);
  await page.locator("#s1p").click();
  await page.keyboard.type("Is Q4 right?");
  await page.click("#next", { force: true });
  await expect(page.locator("#count")).toHaveText("2 / 3");
  // Once the slides have cross-faded.
  await page.waitForTimeout(500);
  await page.locator('[data-pipeup-id="s2-q4"]').click();
  await expect(page.locator(".toast.show")).toHaveText("Finish or cancel your comment on slide 1 first");
  await page.waitForTimeout(1200);
  await expect(page.locator(".pick.show")).toHaveCount(0);
  await expect(page.locator(".namebar.show")).toHaveCount(0);
});

test("on a deck Pipeup can turn, going back to a waiting box on another slide puts the caret in it", async ({
  page,
}) => {
  await page.goto(new URL("../examples/review-deck.html", import.meta.url).href);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await page.evaluate(() => {
    (window as any).heard = [];
    addEventListener("keydown", (e) => (window as any).heard.push(e.key));
  });
  await page.waitForTimeout(300);
  await page.keyboard.press("Shift+Alt+KeyC");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.type("Slide one words");
  // Cancel, Comment, then on: the box waits on slide 1.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
  }
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  await expect(page.locator("#count")).toHaveText("2 / 3");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  await page.evaluate(() => ((window as any).heard.length = 0));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  await expect(page.locator("#count")).toHaveText("1 / 3");
  await page.keyboard.type(" more");
  expect(await page.evaluate(() => (window as any).heard)).toEqual([]);
  await expect(draft(page).locator("textarea")).toHaveValue("Slide one words more");
  await expect(page.locator("#count")).toHaveText("1 / 3");
});
