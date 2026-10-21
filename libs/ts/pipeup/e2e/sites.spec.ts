import { expect, test, type Page } from "@playwright/test";
import {
  control,
  copyAs,
  HOLD_KEY,
  open,
  openAll,
  openMenu,
  seedElement,
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
const draft = (page: Page) => page.locator(".pop.show .draft, .col .draft");
const fired = (page: Page) => page.evaluate(() => (window as any).fired as string[]);

test("a click made while Space is held is the page's alone: a tab switched then stays switched", async ({
  page,
}) => {
  await open(page, "tabs.html");
  await toggleCommenting(page);
  await page.locator("#pro").click();
  await page.keyboard.type("Too cheap?");
  // A click on nothing in particular leaves the box be, with its words.
  await page.mouse.click(900, 700);
  await expect(draft(page)).toHaveCount(1);
  await page.keyboard.down(HOLD_KEY);
  await page.locator("#tab-faq").click();
  await page.keyboard.up(HOLD_KEY);
  await expect(page.locator("#faq")).toBeVisible();
  await expect(page.locator("#plans")).toBeHidden();
  expect(await page.evaluate(() => (window as any).revealed)).toEqual([]);
});

test("a click that started while Space was held finishes as the page's, and one that started without it as Pipeup's", async ({
  page,
}) => {
  await open(page, "controls.html");
  await toggleCommenting(page);
  // Focus leaves the comment control (where Space would press it) for the page.
  await page.mouse.click(1200, 700);
  const go = await box(page, "#go");
  await page.mouse.move(go.x + go.width / 2, go.y + go.height / 2);
  await page.keyboard.down(HOLD_KEY);
  await page.mouse.down();
  await page.keyboard.up(HOLD_KEY);
  await page.mouse.up();
  expect(await fired(page)).toEqual(["go-down", "go"]);
  await expect(draft(page)).toHaveCount(0);
  await page.mouse.down();
  await page.keyboard.down(HOLD_KEY);
  await page.mouse.up();
  await page.keyboard.up(HOLD_KEY);
  expect(await fired(page)).toEqual(["go-down", "go"]);
  await expect(page.locator(".namebar.show .lbl")).toHaveText("Button · Start free");
});

test("a comment whose content changed is flagged Moved, beside the page and in All comments", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=tile-teams]", "4,664 teams? Where is this from?");
  await page.evaluate(() => (document.querySelector("[data-pipeup-id=tile-teams] b")!.textContent = "5,120"));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).Pipeup.resolveAnchor((window as any).pu.document.threads()[0].anchor, document.body)
            .state,
      ),
    )
    .toBe("moved");
  await page.locator(".bub.in").click();
  await expect(page.locator(".pop.show .ctx")).toHaveText("Moved · it read “Teams 4,664”");
  await openAll(page);
  await expect(page.locator(".all.show .cd .ctx")).toHaveText("Moved · it read “Teams 4,664”");
});

test("comment mode's hint waits until the menu has closed, then shows beside the control", async ({
  page,
}) => {
  await open(page, "controls.html");
  await openMenu(page);
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await expect(page.locator(".toast.show")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(page.locator(".toast.show")).toContainText("Hold Space to use the page");
});

test("comment mode from the keyboard says how to pause", async ({ page }) => {
  await open(page, "controls.html");
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".toast.show")).toContainText("Hold Space to use the page");
});

test("a message never slides under the open menu", async ({ page }) => {
  await open(page, "controls.html");
  await openMenu(page);
  await page.locator(".menu.show [data-item=name]").click();
  await page.keyboard.type("Ada of the Analytical Engine and the Difference Engine");
  await page.keyboard.press("Enter");
  const toast = page.locator(".toast.show");
  await expect(toast).toContainText("New comments will say");
  await settled(toast);
  await settled(page.locator(".menu.show"));
  expect(meets((await toast.boundingBox())!, await box(page, ".menu.show"))).toBe(false);
});

test("a new comment on a page's last lines keeps its box and buttons in the window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await selectWords(page, "#p3", "pricing work slips");
  await page.locator(".selbar.show button").click();
  const send = page.locator(".col .draft").getByRole("button", { name: "Comment" });
  await expect(send).toBeVisible();
  await settled(page.locator(".col .th.on"));
  const b = (await send.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(420);
});

test("a site's bar at the highest z-index never hides Pipeup", async ({ page }) => {
  await open(page, "controls.html");
  await page.evaluate(() => {
    const bar = document.createElement("div");
    bar.id = "cookies";
    bar.textContent = "We use cookies";
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;height:60px;background:#222;color:#fff;z-index:2147483647";
    document.body.append(bar);
  });
  const c = await box(page, ".launch .mode");
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
});

test("where a comment is names the section it is in, never another card's heading or a hidden tab's", async ({
  page,
}) => {
  await stubClipboard(page);
  await page.goto(new URL("../examples/review-site.html", import.meta.url).href);
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
  await seedElement(page, "[data-pipeup-id=feature-listen]", "Which voices?");
  await openMenu(page);
  await copyAs(page, "As text");
  const text = await page.evaluate(() => (window as any).__copied.at(-1) as string);
  expect(text.split("\n")[0]).toBe("Block · Listen Natural voices, any speed.");

  await open(page, "tabs.html");
  await seedElement(page, "#fine", "Bigger, please");
  await openMenu(page);
  await copyAs(page, "As text");
  const fine = await page.evaluate(() => (window as any).__copied.at(-1) as string);
  expect(fine.split("\n")[0]).toBe("Paragraph · Fine print.");
});

test("a comment outside the tab panels shows whichever tab is open", async ({ page }) => {
  await open(page, "tabs.html");
  await page.locator("#tab-faq").click();
  await page.evaluate(() => ((document.querySelector("#more") as HTMLDetailsElement).open = true));
  await seedView(page, "#fine", "Bigger, please", { tab: "faq", label: "FAQ tab" });
  await seedView(page, "#refunds", "Say 30 days up top", { tab: "faq", label: "FAQ tab" });
  await expect(page.locator(".bub.in")).toHaveCount(2);
  await page.locator("#tab-plans").click();
  // The FAQ's own comment goes with its tab; the fine print's stays, on screen.
  await expect(control(page)).toHaveAttribute("aria-label", /1 here · 1 in other views/);
  await expect(page.locator(".bub.in")).toHaveCount(1);
  const fine = await box(page, "#fine");
  expect(meets((await page.locator(".bub.in").boundingBox())!, { ...fine, width: fine.width + 40 })).toBe(
    true,
  );
});

test("choosing a comment inside a closed details outlines its summary, never an empty box", async ({
  page,
}) => {
  await open(page, "tabs.html");
  await page.evaluate(() => ((document.querySelector("#more") as HTMLDetailsElement).open = true));
  await seedElement(page, "#fine", "Bigger, please");
  await page.evaluate(() => ((document.querySelector("#more") as HTMLDetailsElement).open = false));
  await openAll(page);
  await page.locator(".all.show .cd .mi").first().click();
  const summary = await box(page, "#more summary");
  const pulses = page.locator(".pulse");
  await expect(pulses).not.toHaveCount(0);
  for (const p of await pulses.all()) expect(meets((await p.boundingBox())!, summary)).toBe(true);
});

test("the naming bar names common controls and structures by what they are", async ({ page }) => {
  await open(page, "named.html");
  await toggleCommenting(page);
  const name = page.locator(".namebar.show .lbl");
  const pick = async (selector: string, words: string) => {
    await page.locator(selector).click();
    await expect(name).toHaveText(words);
    await page.keyboard.press("Escape");
    await expect(draft(page)).toHaveCount(0);
  };
  await pick("#check", "Checkbox · Email me updates");
  await pick("#dark", "Switch · Dark mode");
  await pick("#tab", "Tab · Overview");
  await pick("#sum", "Disclosure · Shipping and returns");
  await pick("#plan", "Dropdown · Monthly");
  await pick("#bar", "Bar");
  await page.locator("#first").click();
  await page.getByRole("button", { name: "Around it" }).click();
  await expect(name).toHaveText(/^List · Ship onboarding in July/);
});

test("the naming bar's Pin is drawn as a pin, its point at the bottom middle", async ({ page }) => {
  await open(page, "named.html");
  await toggleCommenting(page);
  await page.locator("#dark").click();
  const pin = page.locator(".namebar.show").getByRole("button", { name: "Pin" });
  const at = (x: number, y: number) =>
    pin.evaluate(
      (b, p) => {
        const svg = b.querySelector("svg")!;
        return [...svg.querySelectorAll("path")].some((path) => {
          const pt = svg.createSVGPoint();
          pt.x = p.x;
          pt.y = p.y;
          return path.isPointInStroke(pt) || path.isPointInFill(pt);
        });
      },
      { x, y },
    );
  // Its point sits at the bottom middle; nothing of it is in the corner where a comment bubble's tail is.
  expect(await at(12, 21)).toBe(true);
  expect(await at(4, 20)).toBe(false);
});

test("the naming bar never covers its block, and fades while the pointer is over the words it covers", async ({
  page,
}) => {
  await open(page, "doc.html");
  await toggleCommenting(page);
  await page.locator("#p2").click();
  const bar = page.locator(".namebar.show");
  await settled(bar);
  expect(meets((await bar.boundingBox())!, await box(page, "#p2"))).toBe(false);
  const opacity = () => bar.evaluate((el) => Number(getComputedStyle(el).opacity));
  await bar.locator(".lbl").hover();
  await expect.poll(opacity).toBeLessThan(0.5);
  await bar.getByRole("button", { name: "Pin" }).hover();
  await expect.poll(opacity).toBe(1);
});

test("two threads on one element each have their own bubble, never one on top of the other", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await open(page, "doc.html");
  await seedElement(page, "[data-pipeup-id=q4-bar]", "Label the Q4 bar");
  await seedElement(page, "[data-pipeup-id=q4-bar]", "And its colour");
  const bubs = page.locator(".bub.in");
  await expect(bubs).toHaveCount(2);
  const [a, b] = await Promise.all([bubs.nth(0).boundingBox(), bubs.nth(1).boundingBox()]);
  expect(meets(a!, b!)).toBe(false);
  for (const words of ["Label the Q4 bar", "And its colour"]) {
    await page.getByRole("button", { name: new RegExp(words) }).click();
    await expect(page.locator(".pop.show")).toContainText(words);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
});

test("a bubble on a button sits just outside it, so the whole button stays the page's", async ({ page }) => {
  await open(page, "controls.html");
  await seedElement(page, "#go", "Say what it starts");
  const bub = page.locator(".bub.in");
  await expect(bub).toHaveCount(1);
  const go = await box(page, "#go");
  expect(meets((await bub.boundingBox())!, go)).toBe(false);
  await page.mouse.click(go.x + go.width - 3, go.y + 3);
  expect(await fired(page)).toContain("go");
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test("All comments is a list of comments under a heading, and the arrow keys still move through it", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedElement(page, "#p1", "Is July firm?");
  await seedElement(page, "#p3", "Name the risk owner");
  await openAll(page);
  const panel = page.locator(".all.show");
  await expect(panel.getByRole("heading", { name: "All comments" })).toHaveCount(1);
  const list = panel.getByRole("list", { name: "Comments" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(panel.getByRole("menu")).toHaveCount(0);
  const first = list.getByRole("button", { name: /Is July firm\?/ });
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("button", { name: /Name the risk owner/ })).toBeFocused();
});
