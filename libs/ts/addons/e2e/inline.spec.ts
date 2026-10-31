import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, hideComments, load, mount, openMenu } from "./helpers";

const start = async (page: Page, options: Record<string, unknown> = {}) => {
  await blank(page, "asks.html");
  await load(page, CORE, addon("inline"));
  await mount(page, options);
  await expect.poll(() => page.evaluate(() => (window as any).Pipeup.addons()[0]?.state)).toBe("on");
};
/** The drawn ask for a block, inside its <pipeup-place>. */
const ask = (page: Page, id: string) => page.locator(`[data-pipeup-id="${id}"] > pipeup-place`);
/** The document's threads on one block: their words, as the add-on posted them. */
const words = (page: Page, id: string) =>
  page.evaluate(
    (id) =>
      (window as any).pu.document
        .threads()
        .filter((t: any) => t.anchor.id === id)
        .map((t: any) => ({ text: t.root.text, edited: t.root.edited, snapshot: t.anchor.snapshot })),
    id,
  );
/** Another reviewer (Ada) answers, and their comment arrives as from a shared copy. */
const adaAnswers = (page: Page, id: string, question: string, text: string) =>
  page.evaluate(
    async ({ id, question, text }) => {
      const P = (window as any).Pipeup;
      const pu = (window as any).pu;
      const ada = await P.PipeupDocument.open({
        doc: pu.document.id,
        store: new P.MemoryStore(),
        identity: await P.createIdentity(),
        name: "Ada",
      });
      const anchor = P.describeElement(document.querySelector(`[data-pipeup-id="${id}"]`), document.body);
      anchor.snapshot = `Asked: ${question}`;
      await ada.comment(anchor, text);
      await pu.document.merge(ada.ops(), "file");
    },
    { id, question, text },
  );

test("asks are drawn in place over the author's fallback, and an unnamed ask is left as it is", async ({
  page,
}) => {
  const warned = page.waitForEvent("console", (m) => /needs a data-pipeup-id/.test(m.text()));
  await start(page);
  await warned;
  const journeys = ask(page, "q-journeys");
  await expect(journeys.getByRole("group", { name: /one journey or two/ })).toBeVisible();
  await expect(journeys.getByRole("button", { name: "One" })).toBeVisible();
  await expect(journeys.getByRole("button", { name: "Other" })).toBeVisible();
  await expect(page.locator('[data-pipeup-id="q-journeys"] > p')).toBeHidden();
  await expect(page.locator('[data-pipeup-id="FR-012"] > p')).toBeHidden();
  // A block that shows comments in place keeps its own content.
  await expect(page.locator('[data-pipeup-id="home-hero"] > p')).toBeVisible();
  await expect(page.getByText("Unnamed ask.")).toBeVisible();
  await expect(page.locator("pipeup-place")).toHaveCount(4);
  await openMenu(page);
  await expect(page.locator(".menu.show")).toContainText("0 of 2 asks answered");
});

test("a choice is answered with one click, and changing it edits the one answer", async ({ page }) => {
  await start(page);
  const journeys = ask(page, "q-journeys");
  await journeys.getByRole("button", { name: "One" }).click();
  await expect(journeys).toContainText("Your answer: One");
  expect(await words(page, "q-journeys")).toEqual([
    { text: "One", edited: false, snapshot: "Asked: Is “Go through every comment” one journey or two?" },
  ]);
  await journeys.getByRole("button", { name: "Change" }).click();
  await journeys.getByRole("button", { name: "Other" }).click();
  await journeys.getByRole("textbox", { name: "Your answer" }).fill("Two, if replies count");
  await journeys.getByRole("button", { name: "Send" }).click();
  await expect(journeys).toContainText("Your answer: Other: Two, if replies count");
  expect(await words(page, "q-journeys")).toEqual([
    {
      text: "Other: Two, if replies count",
      edited: true,
      snapshot: "Asked: Is “Go through every comment” one journey or two?",
    },
  ]);
  await openMenu(page);
  await expect(page.locator(".menu.show")).toContainText("1 of 2 asks answered");
});

test("changing an answer has one Cancel, which keeps the answer as it was", async ({ page }) => {
  await start(page);
  const journeys = ask(page, "q-journeys");
  await journeys.getByRole("button", { name: "Two" }).click();
  await journeys.getByRole("button", { name: "Change" }).click();
  await journeys.getByRole("button", { name: "Other" }).click();
  await expect(journeys.getByRole("button", { name: "Cancel" })).toHaveCount(1);
  await journeys.getByRole("button", { name: "Cancel" }).click();
  await expect(journeys).toContainText("Your answer: Two");
  const name = ask(page, "q-name");
  await name.getByRole("textbox", { name: "Your answer" }).fill("Asks");
  await name.getByRole("button", { name: "Send" }).click();
  await name.getByRole("button", { name: "Change" }).click();
  await expect(name.getByRole("button", { name: "Cancel" })).toHaveCount(1);
  const agree = ask(page, "FR-012");
  await agree.getByRole("button", { name: "Agree", exact: true }).click();
  await agree.getByRole("button", { name: "Send" }).click();
  await agree.getByRole("button", { name: "Change" }).click();
  await agree.getByRole("button", { name: "Needs change" }).click();
  await expect(agree.getByRole("button", { name: "Cancel" })).toHaveCount(1);
});

test("Remove asks once more, ignores a double-click, and puts the question back", async ({ page }) => {
  await start(page);
  await adaAnswers(page, "q-journeys", "Is “Go through every comment” one journey or two?", "Two");
  const journeys = ask(page, "q-journeys");
  await journeys.getByRole("button", { name: "One" }).click();
  await expect(journeys).toContainText("2 people answered");
  // Keep, and Escape, leave the answer.
  await journeys.getByRole("button", { name: "Remove" }).click();
  await expect(journeys).toContainText("Remove your answer?");
  await expect(journeys.getByRole("button", { name: "Keep" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(journeys).toContainText("Your answer: One");
  // The double-click that asks can't also answer.
  await journeys.getByRole("button", { name: "Remove" }).dblclick();
  await expect(journeys).toContainText("Remove your answer?");
  await page.waitForTimeout(550);
  await journeys.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(journeys.getByRole("button", { name: "One" })).toBeFocused();
  await expect(journeys).not.toContainText("Your answer");
  await expect(journeys).not.toContainText("answered");
  await expect(journeys).not.toContainText("latest from");
  expect((await words(page, "q-journeys")).filter((w: { text: string }) => w.text === "One")).toEqual([]);
  await openMenu(page);
  await expect(page.locator(".menu.show")).toContainText("0 of 2 asks answered");
});

test("removing an answer with replies says so, and takes them too", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await start(page);
  const name = ask(page, "q-name");
  await name.getByRole("textbox", { name: "Your answer" }).tap();
  await page.keyboard.type("Asks");
  await name.getByRole("button", { name: "Send" }).tap();
  await name.getByRole("button", { name: /1 comment/ }).tap();
  await name.getByRole("textbox", { name: /Reply to/ }).tap();
  await page.keyboard.type("Or Questions");
  await page.keyboard.press("Enter");
  await expect(name).toContainText("You: Or Questions");
  await name.getByRole("button", { name: "Remove" }).tap();
  await expect(name).toContainText("Remove your answer and its 1 reply?");
  await page.waitForTimeout(550);
  await name.getByRole("button", { name: "Remove", exact: true }).tap();
  await expect(name.getByRole("textbox", { name: "Your answer" })).toBeVisible();
  await expect(name).not.toContainText("Or Questions");
  await context.close();
});

test("agree takes words by keyboard, and Needs change waits for them", async ({ page }) => {
  await start(page);
  const fr = ask(page, "FR-012");
  await fr.getByRole("button", { name: "Needs change" }).focus();
  await page.keyboard.press("Enter");
  const box = fr.getByRole("textbox", { name: "What needs to change?" });
  await expect(box).toBeFocused();
  await expect(fr.getByRole("button", { name: "Send" })).toBeDisabled();
  await fr.getByRole("button", { name: "Agree" }).focus();
  await page.keyboard.press("Enter");
  await expect(fr.getByRole("textbox", { name: "Anything to add? (optional)" })).toBeFocused();
  await page.keyboard.type("Agree, but keep it to one screen");
  await page.keyboard.press("Enter");
  await expect(fr).toContainText("Your answer: Agree: Agree, but keep it to one screen");
  expect((await words(page, "FR-012"))[0]!.text).toBe("Agree: Agree, but keep it to one screen");
});

test("an open ask is answered by touch", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await start(page);
  const name = ask(page, "q-name");
  await name.getByRole("textbox", { name: "Your answer" }).tap();
  await page.keyboard.type("Asks");
  await name.getByRole("button", { name: "Send" }).tap();
  await expect(name).toContainText("Your answer: Asks");
  // The controls can be redrawn once the answer is saved: measure the button that settles, not one being replaced.
  const change = name.getByRole("button", { name: "Change" });
  await expect(async () => {
    expect((await change.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }).toPass();
  await context.close();
});

test("others' answers are counted only after the reviewer's own, and never while comments are hidden", async ({
  page,
}) => {
  await start(page);
  await adaAnswers(page, "q-journeys", "Is “Go through every comment” one journey or two?", "Two");
  const journeys = ask(page, "q-journeys");
  // Before answering: only the question and its buttons.
  await expect(journeys).not.toContainText("answered");
  await expect(journeys).not.toContainText("Ada");
  await expect(journeys).not.toContainText("latest from");
  await journeys.getByRole("button", { name: "One" }).click();
  await expect(journeys).toContainText("2 people answered. One: 1, Two: 1.");
  await journeys.getByRole("button", { name: /2 comments · latest from/ }).click();
  await expect(journeys).toContainText("Ada: Two");
  // A reply under an answer is conversation, not another answer.
  const reply = journeys.getByRole("textbox", { name: "Reply to Ada" });
  await reply.fill("Why two?");
  await reply.press("Enter");
  await expect(journeys).toContainText("You: Why two?");
  await expect(journeys).toContainText("2 people answered. One: 1, Two: 1.");
  // Threads on the ask show in place, not in the margin.
  await expect(page.locator("pipeup-root").locator(".bub")).toHaveCount(0);
  await hideComments(page);
  await expect(journeys).not.toContainText("answered.");
  await expect(journeys).not.toContainText("Ada");
  await expect(journeys).toContainText("Your answer: One");
});

test("an answer to earlier words of the question says what it answered", async ({ page }) => {
  await start(page);
  await adaAnswers(page, "q-name", "What do we call it?", "Asks");
  const name = ask(page, "q-name");
  await name.getByRole("textbox", { name: "Your answer" }).fill("Questions");
  await name.getByRole("button", { name: "Send" }).click();
  await name.getByRole("button", { name: /comments · latest/ }).click();
  await expect(name).toContainText("Asked as: What do we call it?");
});

test("a marked block shows its comments in place, to read and reply", async ({ page }) => {
  await start(page);
  const hero = ask(page, "home-hero");
  await expect(hero.getByRole("button")).toBeHidden();
  await page.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=home-hero]"), document.body),
      "Make the button bigger",
    );
  });
  const line = hero.getByRole("button", { name: "1 comment · latest from you" });
  await line.focus();
  await page.keyboard.press("Enter");
  await expect(line).toHaveAttribute("aria-expanded", "true");
  await expect(hero).toContainText("You: Make the button bigger");
  await hero.getByRole("textbox", { name: /Reply to/ }).fill("Done in the next draft");
  await page.keyboard.press("Enter");
  await expect(hero).toContainText("You: Done in the next draft");
  await hideComments(page);
  await expect(line).toBeHidden();
});

test("comment mode leaves an ask's controls to the add-on", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
  await ask(page, "q-journeys").getByRole("button", { name: "Two" }).click();
  await expect(ask(page, "q-journeys")).toContainText("Your answer: Two");
  await expect(page.locator(".draft")).toHaveCount(0);
});

test("an add-on can't post without the reviewer, nor draw outside a marked element", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const w = window as any;
    w.Pipeup.use({
      id: "probe",
      api: 1,
      version: "0",
      needs: ["place", "post"],
      network: { when: "never", to: [], says: "Sends nothing." },
      setup(host: any) {
        w.probe = host;
      },
    });
  });
  const result = await page.evaluate(async () => {
    const w = window as any;
    const out: string[] = [];
    try {
      w.probe.place(document.querySelector("[data-pipeup-id=p1]"));
    } catch (e) {
      out.push((e as Error).message);
    }
    // The inline add-on already draws in this one.
    try {
      w.probe.place(document.querySelector("[data-pipeup-id=q-name]"));
    } catch (e) {
      out.push((e as Error).message);
    }
    await w.probe.post({ text: "Hi", replyTo: "x" }).catch((e: Error) => out.push(e.message));
    return out;
  });
  expect(result).toEqual([
    "pipeup: not an element marked for add-ons",
    "pipeup: not an element marked for add-ons",
    "pipeup: not sent by the reviewer here",
  ]);
  expect(await words(page, "q-name")).toEqual([]);
});

test("teardown leaves the page exactly as it was", async ({ page }) => {
  await blank(page, "asks.html");
  await load(page, CORE, addon("inline"));
  const before = await page.evaluate(() => document.documentElement.outerHTML);
  await mount(page);
  await expect(page.locator("pipeup-place")).toHaveCount(4);
  await ask(page, "q-journeys").getByRole("button", { name: "One" }).click();
  await page.evaluate(() => (window as any).pu.unmount());
  const after = await page.evaluate(() => ({
    html: document.documentElement.outerHTML,
    sheets: document.adoptedStyleSheets.length,
  }));
  expect(after.html).toBe(before);
  expect(after.sheets).toBe(0);
  await expect(page.locator('[data-pipeup-id="q-journeys"] > p')).toBeVisible();
});

test("asks follow the light and dark looks, and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  const look = () =>
    ask(page, "q-journeys")
      .locator(".box")
      .evaluate((b) => ({
        bg: getComputedStyle(b).backgroundColor,
        animation: getComputedStyle(b).animationName,
      }));
  expect(await look()).toEqual({ bg: "rgb(255, 255, 255)", animation: "none" });
  await page.screenshot({ path: "test-results/inline-light.png" });
  await page.evaluate(() => (window as any).pu.unmount());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mount(page, { theme: "dark" });
  await expect.poll(look).toEqual({ bg: "rgb(27, 27, 25)", animation: "in" });
  await page.screenshot({ path: "test-results/inline-dark.png", animations: "disabled" });
});
