import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

/** A scripted stand-in for a model: it decides by the comment's words and writes one short reply, piece by piece. */
const FAKE = () => {
  const w = window as any;
  w.__calls = [] as string[];
  w.pipeupAssistEngine = {
    info: { name: "Test model", maker: "Pipeup tests", memory: "none" },
    availability: async () => "ready",
    create: async () => ({
      prompt: async (t: string) => {
        w.__calls.push("decide");
        return /Love the title/.test(t) ? "none" : "ambiguity";
      },
      async *stream() {
        w.__calls.push("write");
        for (const piece of ["Do you mean the July date, ", "or the 20% lift?"]) {
          await new Promise((r) => setTimeout(r, w.__pieceMs ?? 80));
          yield piece;
        }
      },
      destroy() {},
    }),
  };
};

const comment = (page: Page, selector: string, text: string) =>
  page.evaluate(
    async ([sel, words]) => {
      const w = window as any;
      const el = document.querySelector(sel as string)!;
      await w.pu.document.comment(w.Pipeup.describeElement(el, document.body), words as string);
    },
    [selector, text],
  );
const threads = (page: Page) => page.evaluate(() => (window as any).pu.document.threads());

async function start(page: Page) {
  await page.addInitScript(FAKE);
  await blank(page);
  await load(page, CORE, addon("assist"));
  await mount(page);
}
async function turnOn(page: Page) {
  // The row is in the menu only while comments show.
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
  await openMenu(page);
  await page.locator(".menu.show").getByText("Assistant replies").click();
  const panel = page.locator(".xp.show");
  await expect(panel).toContainText("Nothing is sent anywhere");
  await expect(panel).toContainText("Test model");
  await panel.getByRole("button", { name: "Turn on" }).click();
  await expect(page.locator(".xp")).toHaveCount(0);
}

test("turned on, it replies to a comment that deserves one, in its own name, and stays quiet on the rest", async ({
  page,
}) => {
  await start(page);
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await comment(page, "[data-pipeup-id=title]", "Love the title.");
  // Nothing happens until it is turned on.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__calls)).toEqual([]);
  await turnOn(page);
  await expect
    .poll(async () => (await threads(page)).flatMap((t: any) => t.root.replies).length, { timeout: 15000 })
    .toBe(1);
  const all = await threads(page);
  const asked = all.find((t: any) => t.root.text.startsWith("Is the 20%"));
  expect(asked.root.replies[0]).toMatchObject({
    name: "AI assistant (on this device)",
    text: "Do you mean the July date, or the 20% lift?",
  });
  expect(all.find((t: any) => t.root.text.startsWith("Love")).root.replies).toHaveLength(0);
  // Its own key, not the reviewer's.
  expect(asked.root.replies[0].author).not.toBe(await page.evaluate(() => (window as any).pu.document.me));
  await expect(page.locator(".launch .mode")).toBeVisible();
});

test("a thread is looked at once, and again only when something is added to it", async ({ page }) => {
  await start(page);
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await turnOn(page);
  await expect.poll(() => page.evaluate(() => (window as any).__calls.length), { timeout: 15000 }).toBe(2);
  await page.waitForTimeout(3500);
  // Nothing was added, so it was not looked at again, and its own reply doesn't count as an addition.
  expect(await page.evaluate(() => (window as any).__calls)).toEqual(["decide", "write"]);
  await page.evaluate(async () => {
    const w = window as any;
    const t = w.pu.document.threads()[0];
    await w.pu.document.reply(t.root.id, "The 20% is the lift in week-one retention.");
  });
  await expect.poll(() => page.evaluate(() => (window as any).__calls.length), { timeout: 15000 }).toBe(4);
});

test("its reply is drawn with the glowing AI ring, and streams in while it is written", async ({ page }) => {
  await start(page);
  await page.evaluate(() => ((window as any).__pieceMs = 2500));
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await turnOn(page);
  // The thread is in view (the column or a popover, whichever this page uses).
  const pop = page.locator(".layer");
  // While it is being written: the words so far, the busy ring, and "writing now".
  await expect(pop.locator(".ghost")).toContainText("Do you mean the July date", { timeout: 20000 });
  await expect(pop.locator(".ghost .av.ai.busy")).toBeVisible();
  await expect(pop.locator(".ghost")).toContainText("AI assistant · writing now");
  // Finished: a real reply with the ring, no longer a preview.
  await expect(pop.locator(".ghost")).toHaveCount(0, { timeout: 15000 });
  await expect(pop.locator(".it .av.ai")).toHaveText("AI");
  await expect(pop).toContainText("or the 20% lift?");
});

test("turning it off stops new replies, and the row says so", async ({ page }) => {
  await start(page);
  await turnOn(page);
  await openMenu(page);
  const row = page.locator(".menu.show").getByRole("menuitemcheckbox", { name: /Assistant replies/ });
  await expect(row).toHaveAttribute("aria-checked", "true");
  await row.click();
  await expect(row).toHaveAttribute("aria-checked", "false");
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as any).__calls)).toEqual([]);
});

test("with no model on this device, the row says it is not available", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).pipeupAssistEngine = {
      info: { name: "None", maker: "" },
      availability: async () => "none",
      create: async () => {
        throw new Error("no");
      },
    };
  });
  await blank(page);
  await load(page, CORE, addon("assist"));
  await mount(page);
  await page.keyboard.press("Shift+Alt+KeyC");
  await openMenu(page);
  await expect(page.locator(".menu.show")).toContainText("Not available");
});

test("the AI ring sits at the reply's top right, like any avatar, not over its words", async ({ page }) => {
  await start(page);
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await turnOn(page);
  const ring = page.locator(".layer .it .av.ai");
  await expect(ring).toHaveCount(1, { timeout: 15000 });
  const box = (await ring.boundingBox())!;
  const reply = (await page.locator(".layer .it").boundingBox())!;
  // Right edge of the reply's box, where every avatar sits.
  expect(box.x + box.width).toBeGreaterThan(reply.x + reply.width - 12);
});

test("the Assistant replies row is in the menu only while commenting is on", async ({ page }) => {
  await start(page);
  await openMenu(page);
  await expect(page.locator(".menu.show")).not.toContainText("Assistant replies");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
  await openMenu(page);
  await expect(page.locator(".menu.show")).toContainText("Assistant replies");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(0);
  await openMenu(page);
  await expect(page.locator(".menu.show")).not.toContainText("Assistant replies");
});
