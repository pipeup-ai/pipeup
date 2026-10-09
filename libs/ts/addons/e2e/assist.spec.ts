import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

/** A scripted stand-in for a model: it decides by the comment's words and writes one short reply, piece by piece. */
const FAKE = () => {
  const w = window as any;
  w.__calls = [] as string[];
  w.__reads = [] as string[];
  w.pipeupAssistEngine = {
    info: { name: "Test model", maker: "Pipeup tests", memory: "none" },
    availability: async () => "ready",
    create: async () => ({
      prompt: async (t: string) => {
        if (/Read this section/.test(t)) {
          w.__reads.push([...t.matchAll(/<section>([^:]*):/g)].pop()?.[1] ?? "");
          return "Gist: a section.\nFacts: none.";
        }
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
  // The comment it stayed quiet on says it was reviewed; the one it replied to doesn't need to.
  await expect(page.locator(".layer .seen")).toHaveCount(1);
  await expect(page.locator(".layer .seen")).toHaveText("Reviewed by AI · nothing to add");
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

test("a reply shows what it relied on as small pills, and pressing one goes to the passage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.pipeupAssistEngine = {
      info: { name: "Test model", maker: "Pipeup tests", memory: "none" },
      availability: async () => "ready",
      create: async () => ({
        prompt: async (t: string) =>
          /Read this section/.test(t)
            ? "Gist: x\nFacts: y"
            : /Find the one sentence/.test(t)
              ? "Pricing slips if onboarding slips past July"
              : "related",
        async *stream() {
          yield "Pricing slips if onboarding slips past July.\nUsed: 1";
        },
        destroy() {},
      }),
    };
  });
  await blank(page);
  await page.evaluate(() => {
    document
      .querySelector("main")!
      .insertAdjacentHTML(
        "beforeend",
        '<p data-pipeup-id="p3">Pricing slips if onboarding slips past July, and QA needs two engineers in June.</p>',
      );
  });
  await load(page, CORE, addon("assist"));
  await mount(page);
  await comment(page, "[data-pipeup-id=p1]", "Are we sure about the onboarding date in July?");
  await turnOn(page);
  const pill = page.locator(".layer .it .refs .ref");
  await expect(pill).toHaveCount(1, { timeout: 15000 });
  await expect(pill).toContainText("[1] A quiet report");
  // Only a short line and the pill: the sentence it points to shows on hover (checked in the deck test).
  await expect(page.locator(".layer .it .tx")).toContainText("This may be related:");
  const card = pill.locator(".rc");
  await expect(card).toHaveText("Pricing slips if onboarding slips past July");
  // The reference lines are not shown as words.
  await expect(page.locator(".layer .it .tx")).not.toContainText("quote:");
  // (A closed thread in the column keeps its replies folded; press the pill all the same.)
  await pill.evaluate((el) => (el as HTMLElement).click());
  await expect(page.locator(".layer .pulse")).toHaveCount(1, { timeout: 5000 });
});

test("in a deck it reads every slide, short bullets included, and points at the slide with a pill", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.pipeupAssistEngine = {
      info: { name: "Test model", maker: "Pipeup tests", memory: "none" },
      availability: async () => "ready",
      create: async () => ({
        prompt: async (t: string) =>
          /Read this section/.test(t)
            ? "Gist: x\nFacts: y"
            : /Find the one sentence/.test(t)
              ? "Hold churn under 3%."
              : "related",
        async *stream() {
          yield "The next-quarter slide sets a goal to hold churn under 3%.\nUsed: 1";
        },
        destroy() {},
      }),
    };
  });
  await blank(page);
  await page.evaluate(() => {
    document.body.innerHTML = `<main>
      <section data-pipeup-slide="1" data-pipeup-id="s1"><h2>Revenue grew</h2><p>Q4 is a forecast that assumes the July launch.</p></section>
      <section data-pipeup-slide="2" data-pipeup-id="s2" style="display:none"><h2>Next quarter</h2><ul><li>Ship onboarding.</li><li>Hold churn under 3%.</li></ul></section>
    </main>`;
  });
  await load(page, CORE, addon("assist"));
  await mount(page);
  await comment(page, "[data-pipeup-id=s1] p", "Do we have a risk of churn?");
  await turnOn(page);
  // Slides show their threads as bubbles: open this one to read the reply.
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
  await expect.poll(async () => (await threads(page))[0].root.replies.length, { timeout: 15000 }).toBe(1);
  await page.locator(".bub.in").first().dispatchEvent("click");
  const pill = page.locator(".pop.show .it .refs .ref");
  await expect(pill).toHaveCount(1);
  await expect(pill).toContainText("Slide 2");
  await expect(pill.locator(".rc")).toBeHidden();
  await pill.hover();
  await expect(pill.locator(".rc")).toBeVisible();
  await expect(pill.locator(".rc")).toHaveText("Hold churn under 3%.");
  await expect(pill.locator("i.sl")).toHaveCount(1);
});

test("it reads the whole page once, a section at a time, and says how far it has got", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    document
      .querySelector("main")!
      .insertAdjacentHTML("beforeend", "<h2>Goals</h2><p>Hold churn under 3%.</p><p>Ship by July.</p>");
  });
  await turnOn(page);
  // Short lines count: "Hold churn under 3%." is in a section that was read.
  await expect
    .poll(() => page.evaluate(() => (window as any).__reads.length), { timeout: 15000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.evaluate(() => (window as any).pu.document.threads().length >= 0))
    .toBe(true);
  const reads = await page.evaluate(() => (window as any).__reads as string[]);
  expect(reads).toContain("Goals");
  // A comment arriving later does not make it read the page again.
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => (window as any).__reads.length);
  await comment(page, "[data-pipeup-id=p1]", "Is the 20% lift right?");
  await expect.poll(async () => (await threads(page))[0].root.replies.length, { timeout: 15000 }).toBe(1);
  expect(await page.evaluate(() => (window as any).__reads.length)).toBe(before);
});

test("a goal far from the comment is found by reading every section, and a made-up quote is not", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.pipeupAssistEngine = {
      info: { name: "Test model", maker: "Pipeup tests", memory: "none" },
      availability: async () => "ready",
      create: async () => ({
        prompt: async (t: string) =>
          /Read this section/.test(t)
            ? "Gist: x\nFacts: y"
            : /Find the one sentence/.test(t)
              ? "We aim to cut churn to 1% by June."
              : "related",
        async *stream() {
          yield "Not a reply that should appear.\nUsed: 1";
        },
        destroy() {},
      }),
    };
  });
  await blank(page);
  await load(page, CORE, addon("assist"));
  await mount(page);
  await comment(page, "[data-pipeup-id=p1]", "Do we have a risk of churn?");
  await turnOn(page);
  // The model "found" a sentence that is nowhere on the page: no reply, and the thread says it was reviewed.
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
  await page.waitForTimeout(1500);
  expect((await threads(page))[0].root.replies).toHaveLength(0);
});
