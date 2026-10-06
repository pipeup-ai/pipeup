import { expect, test, type Page } from "@playwright/test";
import {
  bodySnapshot,
  commenting,
  control,
  leaveReply,
  open,
  openMenu,
  seedText,
  selectWords,
  settled,
  toggleCommenting,
} from "./helpers";
import { SHORTCUT } from "../src/ui/shortcut";

const panel = (page: Page) => page.locator(".all.show");
/** How strongly the text highlights are painted: the alpha of the quote highlight's colour (0 = not seen). */
const highlightAlpha = (page: Page) =>
  page.evaluate(() => {
    const rule = [...document.adoptedStyleSheets]
      .flatMap((s) => [...s.cssRules])
      .find((r) => r.cssText.includes("highlight(pipeup-quote)"));
    const m = rule && /rgba?\(([^)]*)\)/.exec(rule.cssText);
    if (!m) return 0;
    const parts = m[1]!.split(",").map((x) => parseFloat(x));
    return parts.length > 3 ? parts[3]! : 1;
  });
/** Toggles comment mode with its shortcut, sampling the highlight alpha every frame for 400 ms after. */
const toggleAndSample = (page: Page) =>
  page.evaluate(async (code) => {
    const alpha = () => {
      const rule = [...document.adoptedStyleSheets]
        .flatMap((s) => [...s.cssRules])
        .find((r) => r.cssText.includes("highlight(pipeup-quote)"));
      const m = rule && /rgba?\(([^)]*)\)/.exec(rule.cssText);
      const parts = m ? m[1]!.split(",").map((x) => parseFloat(x)) : [];
      return parts.length > 3 ? parts[3]! : m ? 1 : 0;
    };
    window.dispatchEvent(new KeyboardEvent("keydown", { code, shiftKey: true, altKey: true, bubbles: true }));
    const seen: number[] = [];
    const end = performance.now() + 400;
    while (performance.now() < end) {
      seen.push(alpha());
      await new Promise(requestAnimationFrame);
    }
    return seen;
  }, SHORTCUT.code);

test("comments are hidden with comment mode off, shown with it on, and they ease both ways", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  // On load comment mode is off: no thread, no highlight, but the button still counts the open thread.
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  await expect(page.locator(".th")).toHaveCount(0);
  expect(await highlightAlpha(page)).toBe(0);
  await expect(page.locator(".launch .mode .n.on")).toHaveText("1");

  const coming = await toggleAndSample(page);
  await commenting(page);
  await expect(page.locator(".layer.hidden")).toHaveCount(0);
  await expect(page.locator(".th")).toHaveCount(1);
  expect(coming.at(-1)!).toBeGreaterThan(0.5);
  // Eased: the highlight passed through values in between.
  expect(coming.some((a) => a > 0.05 && a < coming.at(-1)! - 0.05)).toBe(true);

  const going = await toggleAndSample(page);
  await commenting(page, false);
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  expect(going.at(-1)!).toBe(0);
  expect(going.some((a) => a > 0.05 && a < going[0]! - 0.05)).toBe(true);
  // The column fades rather than vanishing.
  expect(await page.locator(".col").evaluate((e) => getComputedStyle(e).transitionProperty)).toContain(
    "opacity",
  );
  await expect(page.locator(".th")).toHaveCount(0);
});

test("with reduced motion, comments still fade in and out, by opacity only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const coming = await toggleAndSample(page);
  expect(coming.some((a) => a > 0.05 && a < coming.at(-1)! - 0.05)).toBe(true);
});

test("All comments shows comments while it is open; closing it hides them again", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  await expect(page.locator(".layer.hidden")).toHaveCount(0);
  await panel(page)
    .getByRole("menuitem", { name: /Is 20% realistic\?/ })
    .click();
  await expect(page.locator(".pop.show")).toContainText("Is 20% realistic?");
  await expect.poll(() => highlightAlpha(page)).toBeGreaterThan(0.5);
  await leaveReply(page);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await commenting(page, false);
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  await expect(page.locator(".th.on, .pop.show")).toHaveCount(0);
  await expect.poll(() => highlightAlpha(page)).toBe(0);
});

test("selecting text offers nothing outside comment mode, and the comment icon in it", async ({ page }) => {
  await open(page, "doc.html");
  await selectWords(page, "#p2", "second designer");
  await page.waitForTimeout(100); // Pipeup looks at the selection a tick after the mouse is released.
  await expect(page.locator(".selbar.show")).toHaveCount(0);
  await toggleCommenting(page);
  await commenting(page);
  await page.mouse.click(900, 700);
  await selectWords(page, "#p2", "second designer");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
  await page.keyboard.press(`Shift+Alt+${SHORTCUT.code}`);
  await commenting(page, false);
  await expect(page.locator(".selbar.show")).toHaveCount(0);
});

test("Show resolved is a switch in the All comments panel, not the menu", async ({ page }) => {
  await open(page, "doc.html");
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate((id) => (window as any).pu.document.resolve(id), id);
  await openMenu(page);
  await expect(page.locator(".menu.show").getByText("Show resolved")).toHaveCount(0);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  const sw = panel(page).locator(".hd").getByRole("switch", { name: "Show resolved" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(panel(page).locator(".list").getByRole("menuitem")).toHaveCount(0);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(
    panel(page)
      .locator(".list")
      .getByRole("menuitem", { name: /Is 20% realistic\?/ }),
  ).toHaveCount(1);
  await expect(panel(page)).toHaveCount(1);
  // Space toggles it back from the keyboard.
  await sw.focus();
  await page.keyboard.press("Space");
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(panel(page)).toHaveCount(1);
  // The switch eases with the move token.
  expect(
    await sw
      .locator(".sw")
      .evaluate((e) => getComputedStyle(e, "::after").transitionDuration.split(",")[0]!.trim()),
  ).toBe("0.34s");
});

test("the open panel makes room: the page moves over by its width, and back when it closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const before = await bodySnapshot(page);
  const right = () => page.evaluate(() => document.querySelector("#p1")!.getBoundingClientRect().right);
  const edge = () => page.evaluate(() => document.body.getBoundingClientRect().right);
  const r0 = await right();
  const e0 = await edge();
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await settled(panel(page));
  await expect.poll(edge).toBeCloseTo(e0 - 320, 0);
  // The page's DOM and inline styles are untouched: the room comes from Pipeup's own stylesheet.
  expect(await page.evaluate(() => document.documentElement.getAttribute("style"))).toBeNull();
  // The panel covers none of the page's content.
  const p = (await panel(page).boundingBox())!;
  expect(await right()).toBeLessThanOrEqual(p.x + 1);
  // The page eased into its new width.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration)).toContain(
    "0.34s",
  );
  // The thread opened from the panel sits on its content after the reflow.
  await panel(page)
    .getByRole("menuitem", { name: /Is 20% realistic\?/ })
    .click();
  const pop = page.locator(".pop.show");
  await settled(pop);
  const words = await page.evaluate(() => {
    const r = (
      [...CSS.highlights.get("pipeup-quote")!, ...CSS.highlights.get("pipeup-on")!][0] as Range
    ).getClientRects()[0]!;
    return { left: r.left, bottom: r.bottom };
  });
  const o = (await pop.boundingBox())!;
  expect(Math.abs(o.y - words.bottom)).toBeLessThan(40);

  await leaveReply(page);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(edge).toBeCloseTo(e0, 0);
  await expect.poll(right).toBeCloseTo(r0, 0);
  // Back exactly as it was.
  await expect.poll(() => bodySnapshot(page)).toBe(before);
});

test("with reduced motion the page makes room without a transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "doc.html");
  const e0 = await page.evaluate(() => document.body.getBoundingClientRect().right);
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await expect(panel(page)).toHaveCount(1);
  expect(await page.evaluate(() => document.body.getBoundingClientRect().right)).toBeCloseTo(e0 - 320, 0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration)).toBe("0s");
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test("the full-width panel covers the page and does not move it", async ({ page }) => {
    await open(page, "doc.html");
    const e0 = await page.evaluate(() => document.body.getBoundingClientRect().right);
    await control(page).click();
    await page.getByRole("menuitem", { name: /All comments/ }).click();
    await settled(panel(page));
    expect(await page.evaluate(() => document.body.getBoundingClientRect().right)).toBe(e0);
  });
});
