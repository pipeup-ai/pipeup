import { expect, test, type Page } from "@playwright/test";
import {
  commenting,
  control,
  focusInPipeup,
  hideComments,
  leaveReply,
  open,
  openAll,
  quoteSpot,
  seedElement,
  seedText,
  settled,
  showComments,
  toggleCommenting,
} from "./helpers";

/** The number inside the control's comment bubble (the bubble fades away at zero). */
const count = (page: Page) => page.locator(".launch .mode .cnt");
const list = (page: Page) => page.locator(".all.show");

/** The count's opacity every frame for `ms`: easing shows values between 0 and 1, a snap shows none. */
async function sampleOpacity(page: Page, start: () => Promise<unknown>, ms = 600): Promise<number[]> {
  await page.evaluate(() => {
    const w = window as any;
    const el = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(".launch .mode .cnt")!;
    w.__op = [];
    const t0 = performance.now();
    const tick = () => {
      w.__op.push(Number(getComputedStyle(el).opacity));
      if (performance.now() - t0 < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await start();
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as any).__op as number[]);
}

test("the number is hidden at zero, eases in with the first thread and out after the last is resolved", async ({
  page,
}) => {
  await open(page, "site.html");
  expect(await count(page).evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  const mode = control(page);
  const before = (await mode.boundingBox())!;

  let id = "";
  const easedIn = await sampleOpacity(page, async () => {
    id = await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  });
  expect(easedIn.some((o) => o > 0.05 && o < 0.95)).toBe(true);
  await expect(count(page)).toHaveCSS("opacity", "1");
  await expect(count(page).locator(".n.on")).toHaveText("1");
  await settled(page.locator(".launch"));
  const after = (await mode.boundingBox())!;
  expect(after).toEqual(before);

  const easedOut = await sampleOpacity(page, () =>
    page.evaluate((id) => (window as any).pu.document.resolve(id), id),
  );
  expect(easedOut.some((o) => o > 0.05 && o < 0.95)).toBe(true);
  await expect(count(page)).toHaveCSS("opacity", "0");
  await expect(mode.locator(".plus")).toHaveCSS("opacity", "1");
  expect((await mode.boundingBox())!).toEqual(before);
});

test("in bubbles, a thread whose content is gone is counted, listed, and opens from All comments", async ({
  page,
}) => {
  await open(page, "site.html");
  await showComments(page);
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await expect(page.locator(".bub.in")).toHaveCount(1);
  await page.evaluate(() => document.querySelector(".cta")!.remove());
  await expect(page.locator(".bub")).toHaveCount(0);
  await expect(count(page).locator(".n.on")).toHaveText("1");

  await openAll(page);
  await expect(list(page).locator(".sec")).toHaveText("No longer on the page");
  const item = list(page).getByRole("menuitem", { name: /Match the nav\?/ });
  await expect(item).toContainText("Start free trial");
  await item.click();
  await expect(list(page)).toBeVisible();
  // The thread opens out inside the panel, and nothing opens on the page.
  const thread = list(page).locator(".xr");
  await expect(thread).toHaveCount(1);
  await expect(thread).toContainText("Match the nav?");
  await expect(thread).toContainText("No longer on the page");
  await expect(page.locator(".pop.show")).toHaveCount(0);
  // The cursor is in the thread's reply line: Escape closes the thread, then the panel.
  expect((await focusInPipeup(page)).tag).toBe("TEXTAREA");
  await page.keyboard.press("Escape");
  await expect(list(page).locator(".xr")).toHaveCount(0);
  await expect(list(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
});

test("choosing a thread on content scrolled out of sight brings it into view and opens it", async ({
  page,
}) => {
  await open(page, "site.html");
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div style="height:1600px"></div>
       <div id="car" style="overflow:hidden;width:300px;margin:0 24px">
         <div style="display:flex;width:600px">
           <p style="flex:0 0 300px;margin:0">Slide one</p>
           <p id="s2" style="flex:0 0 300px;margin:0">Slide two, the one with the price</p>
         </div>
       </div><div style="height:400px"></div>`,
    );
  });
  await seedElement(page, "#s2", "Is this price final?");
  await openAll(page);
  await list(page)
    .getByRole("menuitem", { name: /Is this price final\?/ })
    .click();
  await expect(list(page).locator(".xr")).toContainText("Is this price final?");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = document.querySelector("#s2")!.getBoundingClientRect();
        const c = document.querySelector("#car")!.getBoundingClientRect();
        return s.top >= 0 && s.bottom <= innerHeight && s.left >= c.left - 1 && s.right <= c.right + 1;
      }),
    )
    .toBe(true);
});

test("All comments works from the keyboard: arrows move, Enter opens, Escape closes", async ({ page }) => {
  await open(page, "site.html");
  // Seeded out of order: the list follows the page.
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await expect(count(page).locator(".n.on")).toHaveText("2");
  await control(page).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toMatch(/^Start commenting/);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toContain("All comments");
  await page.keyboard.press("Enter");
  await expect(list(page)).toBeVisible();
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Love this line.");
  await page.keyboard.press("ArrowDown");
  expect((await focusInPipeup(page)).text).toContain("Match the nav?");
  await page.keyboard.press("ArrowUp");
  expect((await focusInPipeup(page)).text).toContain("Love this line.");
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
  expect((await focusInPipeup(page)).cls).toContain("mode");

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Love this line.");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  // The panel stays open and the cursor is in the thread's reply line; Escape closes the thread and gives
  // focus back to the row, ready for the next one.
  await expect(list(page)).toBeVisible();
  await expect(list(page).locator(".xr")).toContainText("Match the nav?");
  expect(await focusInPipeup(page)).toMatchObject({ tag: "TEXTAREA" });
  await page.keyboard.press("Escape");
  await expect(list(page).locator(".xr")).toHaveCount(0);
  await expect(list(page)).toBeVisible();
  expect((await focusInPipeup(page)).text).toContain("Match the nav?");
});

test("closed, the list is out of the keyboard's reach, and resolved threads follow ✓ Resolved", async ({
  page,
}) => {
  await open(page, "site.html");
  const a = await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  expect(await page.locator(".all").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await page.evaluate((id) => (window as any).pu.document.resolve(id), a);
  await openAll(page);
  await expect(list(page).getByRole("menuitem")).toHaveCount(1);
  await list(page).getByRole("button", { name: "Resolved", exact: true }).click();
  await expect(list(page).getByRole("menuitem")).toHaveCount(2);
  // The choice stays when the panel closes and opens again.
  await page.keyboard.press("Escape");
  await openAll(page);
  await expect(list(page).getByRole("menuitem")).toHaveCount(2);
});

test("in the column, choosing a thread opens it in the panel, and the column keeps nothing open", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
  await list(page)
    .getByRole("menuitem", { name: /Is 20% realistic\?/ })
    .click();
  await expect(list(page).locator(".xr")).toContainText("Is 20% realistic?");
  await list(page).getByRole("button", { name: "Close" }).click();
  await expect(list(page)).toHaveCount(0);
  await expect(page.locator(".th.on")).toHaveCount(0);
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test.describe("on a touch screen with no hover", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 800 } });
  test("a tap reaches All comments, which takes the whole width, and a chosen thread opens out in it", async ({
    page,
  }) => {
    await open(page, "site.html");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "hover", value: "none" }] });
    await seedText(page, "h1", "in minutes not meetings", "Love this line.");
    await control(page).tap();
    await page.getByRole("menuitem", { name: /All comments/ }).tap();
    await expect(list(page)).toBeVisible();
    await settled(list(page));
    expect(Math.round((await list(page).boundingBox())!.width)).toBe(390);
    await list(page)
      .getByRole("menuitem", { name: /Love this line\./ })
      .tap();
    await expect(list(page).locator(".xr")).toContainText("Love this line.");
    await expect(page.locator(".layer.hidden")).toHaveCount(0);
    // Escape closes the thread, then the panel; the comments still show (they aren't hidden).
    await page.keyboard.press("Escape");
    await expect(list(page).locator(".xr")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(list(page)).toHaveCount(0);
    await expect(page.locator(".layer.hidden")).toHaveCount(0);
  });
});

test("the menu's All comments opens the list, even with no number to choose", async ({ page }) => {
  await open(page, "site.html");
  await openAll(page);
  await expect(list(page)).toBeVisible();
  await expect(list(page)).toContainText("No open comments");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  // Nothing to choose: focus goes to the close button.
  await expect.poll(async () => (await focusInPipeup(page)).cls).toBe("ib");
});

test("after the last thread is resolved with the list open, Escape gives focus to the button", async ({
  page,
}) => {
  await open(page, "site.html");
  const id = await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await openAll(page);
  await expect.poll(async () => (await focusInPipeup(page)).text).toContain("Match the nav?");
  await page.evaluate((id) => (window as any).pu.document.resolve(id), id);
  await expect(list(page)).toContainText("No open comments");
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
  await expect.poll(async () => (await focusInPipeup(page)).cls).toContain("mode");
});

test("choosing a thread in comment mode opens it in the panel and stays in comment mode", async ({
  page,
}) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await toggleCommenting(page);
  await commenting(page);
  await openAll(page);
  await list(page)
    .getByRole("menuitem", { name: /Match the nav\?/ })
    .click();
  await expect(list(page).locator(".xr")).toContainText("Match the nav?");
  // Reading one never leaves comment mode.
  await commenting(page);
  await leaveReply(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
  await commenting(page);
});

test("choosing a thread while comments are hidden shows them and opens it in the panel", async ({ page }) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await hideComments(page);
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  await openAll(page);
  await list(page)
    .getByRole("menuitem", { name: /Match the nav\?/ })
    .click();
  await expect(page.locator(".layer.hidden")).toHaveCount(0);
  await expect(list(page).locator(".xr")).toContainText("Match the nav?");
  await expect(page.locator(".pop.show")).toHaveCount(0);
});

test("with All comments open, clicking a comment's words on the page opens it in the panel, which stays open", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await openAll(page);
  const y = await page.evaluate(() => scrollY);
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(list(page).locator(".xr")).toContainText("Is 20% realistic?");
  // It stays open, the thread opens nowhere else, and the page stays where it was.
  await page.waitForTimeout(600);
  await expect(list(page)).toBeVisible();
  await expect(page.locator(".pop.show, .th.on")).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  // A click on the page itself leaves the panel open too: only its × or Esc closes it.
  await page.mouse.click(900, 790);
  await page.waitForTimeout(400);
  await expect(list(page)).toHaveCount(1);
  await expect(page.locator(".layer.hidden")).toHaveCount(0);
});

test("with All comments open in comment mode, clicking a comment's words opens it in the panel, not a new comment", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await showComments(page);
  await openAll(page);
  const spot = await quoteSpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(list(page).locator(".xr")).toContainText("Is 20% realistic?");
  await page.waitForTimeout(600);
  await expect(list(page)).toBeVisible();
  await expect(page.locator(".pop.show, .th.on, .draft")).toHaveCount(0);
  await commenting(page);
});

test("with All comments open, clicking a bubble opens its thread in the panel", async ({ page }) => {
  await open(page, "site.html");
  await seedElement(page, "[data-pipeup-id=cta-trial]", "Match the nav?");
  await seedText(page, "h1", "in minutes not meetings", "Love this line.");
  await openAll(page);
  await page.locator(".bub.in").first().click();
  await expect(list(page).locator(".xr")).toContainText("Match the nav?");
  await page.waitForTimeout(600);
  await expect(list(page)).toBeVisible();
  await expect(page.locator(".pop.show")).toHaveCount(0);
});
