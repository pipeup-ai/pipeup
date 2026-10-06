import { expect, test } from "@playwright/test";
import { fixture, open, selectWords, settled, showComments } from "./helpers";

test("selecting text offers one comment icon that never covers the selection", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await selectWords(page, "#p1", "pricing changes");
  const bar = page.locator(".selbar.show");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button")).toHaveAttribute("aria-label", "Comment");
  // The bar eases in from 4px lower; measure it where it comes to rest, not mid-transition.
  await settled(bar);
  const b = (await bar.boundingBox())!;
  const sel = await page.evaluate(() => {
    const r = getSelection()!.getRangeAt(0).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  expect(b.y + b.height <= sel.top || b.y >= sel.bottom).toBe(true);
});

test("the first comment needs no name: it posts, shows in place, and names its writer by their animal", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  const me = await page.evaluate(() => (window as any).Pipeup.animalName((window as any).pu.document.me));
  await selectWords(page, "#p1", "pricing changes");
  await page.locator(".selbar.show button").click();
  const draft = page.locator(".draft");
  // The only field to fill is the comment line; the name field stays closed and out of reach.
  await expect(draft.locator(".nf")).toHaveAttribute("inert", "");
  await draft.getByRole("textbox", { name: "Comment" }).fill("Which changes?");
  await draft.getByRole("textbox", { name: "Comment" }).press("Enter");
  const th = page.locator(".th", { hasText: "Which changes?" });
  await expect(th).toBeVisible();
  await th.locator(".root").hover();
  await expect(th.locator(".who").first()).toHaveText(`${me} · just now`);
  expect(await page.evaluate(() => (window as any).pu.document.name)).toBe("");

  await page.mouse.click(900, 700);
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  // The first draft may still be easing out.
  await expect(page.locator(".th:not(.out) .draft .nf")).toHaveAttribute("inert", "");
});

test("Escape drops a draft and nothing is saved", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  await page.locator(".draft").getByRole("textbox", { name: "Comment" }).press("Escape");
  await expect(page.locator(".draft")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pu.document.threads().length)).toBe(0);
});

test("on rich pages the draft opens in a popover below the selection", async ({ page }) => {
  await open(page, "site.html", { name: "Sam" });
  await showComments(page);
  await selectWords(page, "h1", "in minutes");
  const bottom = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().bottom);
  await page.locator(".selbar.show button").click();
  const pop = page.locator(".pop.show");
  await expect(pop.locator(".draft")).toBeVisible();
  expect((await pop.boundingBox())!.y).toBeGreaterThanOrEqual(bottom);
  await pop.getByRole("textbox", { name: "Comment" }).fill("Love this.");
  await pop.getByRole("textbox", { name: "Comment" }).press("Enter");
  await expect(pop).toContainText("Love this.");
});

test("a draft whose save fails is still posted once, with a notice", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  await page.evaluate(async () => {
    const w = window as any;
    const inner = new w.Pipeup.MemoryStore();
    let failNext = false;
    const store = {
      load: (d: string) => inner.load(d),
      append: (d: string, ops: unknown[]) =>
        failNext ? ((failNext = false), Promise.reject(new Error("disk full"))) : inner.append(d, ops),
      loadProfile: () => inner.loadProfile(),
      saveProfile: (p: unknown) => inner.saveProfile(p),
      saveProfileIfAbsent: (p: unknown) => inner.saveProfileIfAbsent(p),
    };
    w.failNextSave = () => (failNext = true);
    w.pu = await w.Pipeup.mount({ store, name: "Sam" });
  });
  await showComments(page);
  await page.evaluate(() => (window as any).failNextSave());
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  await page.locator(".draft").getByRole("textbox", { name: "Comment" }).fill("Why Q4?");
  await page.locator(".draft").getByRole("textbox", { name: "Comment" }).press("Enter");
  await expect(page.locator(".toast.show")).toContainText("not saved yet");
  await expect(page.locator(".draft")).toHaveCount(0);
  await expect(page.locator(".th", { hasText: "Why Q4?" })).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).pu.document.threads().length)).toBe(1);
});

test("ignored areas don't offer commenting", async ({ page }) => {
  await open(page, "site.html");
  await showComments(page);
  await selectWords(page, "nav", "Product");
  await page.waitForTimeout(300);
  await expect(page.locator(".selbar.show")).toHaveCount(0);
});

test("a name added from the draft is used even when it can't be remembered, and says so", async ({
  page,
}) => {
  await page.goto(fixture("doc.html"));
  await page.evaluate(async () => {
    const w = window as any;
    const inner = new w.Pipeup.MemoryStore();
    let failProfile = false;
    const store = {
      load: (d: string) => inner.load(d),
      append: (d: string, ops: unknown[]) => inner.append(d, ops),
      loadProfile: () => inner.loadProfile(),
      saveProfile: (p: unknown) =>
        failProfile ? Promise.reject(new Error("disk full")) : inner.saveProfile(p),
      saveProfileIfAbsent: (p: unknown) => inner.saveProfileIfAbsent(p),
    };
    w.failProfile = () => (failProfile = true);
    w.pu = await w.Pipeup.mount({ store });
  });
  await showComments(page);
  await page.evaluate(() => (window as any).failProfile());
  await selectWords(page, "#p1", "pricing changes");
  await page.locator(".selbar.show button").click();
  const draft = page.locator(".draft");
  await draft.getByRole("button", { name: "add your name" }).click();
  await draft.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await draft.getByRole("textbox", { name: "Your name" }).press("Enter");
  await expect(page.locator(".toast.show")).toContainText("couldn't remember");
  expect(await page.evaluate(() => (window as any).pu.document.name)).toBe("Sam");
  await draft.getByRole("textbox", { name: "Comment" }).fill("Which changes?");
  await draft.getByRole("textbox", { name: "Comment" }).press("Enter");
  const th = page.locator(".th", { hasText: "Which changes?" });
  await th.locator(".root").hover();
  await expect(th.locator(".who").first()).toHaveText("Sam · just now");
});

const T0 = Date.UTC(2026, 0, 1);

test("a new draft never takes focus back from where the reader has moved", async ({ page }) => {
  // Timers only run when the test says so, so a late focus can't hide behind a fast machine.
  await page.clock.install({ time: T0 });
  await open(page, "doc.html");
  await showComments(page);
  await page.clock.pauseAt(T0 + 60_000);
  await selectWords(page, "#p1", "pricing changes");
  await page.clock.runFor(20);
  await page.locator(".selbar.show button").click();
  const draft = page.locator(".draft");
  await draft.getByRole("textbox", { name: "Comment" }).focus();
  await page.clock.runFor(200);
  await page.keyboard.type("Which changes?");
  await expect(draft.getByRole("textbox", { name: "Comment" })).toHaveValue("Which changes?");
  await expect(draft.getByRole("textbox", { name: "Your name" })).toHaveValue("");
});

test("selecting again right after opening a draft keeps the new selection", async ({ page }) => {
  await page.clock.install({ time: T0 });
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await page.clock.pauseAt(T0 + 60_000);
  await selectWords(page, "#p1", "pricing changes");
  await page.clock.runFor(20);
  await page.locator(".selbar.show button").click();
  await expect(page.locator(".draft")).toHaveCount(1);
  await page.mouse.click(900, 700);
  await selectWords(page, "#p2", "second designer");
  await page.clock.runFor(200);
  expect(await page.evaluate(() => getSelection()!.toString())).toBe("second designer");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
});
