import { expect, test } from "@playwright/test";
import type { MountOptions } from "../src/ui/mount";
import { fixture, open, seedText, selectWords, showComments, stubClipboard, openMenu } from "./helpers";

const lastCopy = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).__copied.at(-1) ?? "");
const menu = openMenu;

test.beforeEach(async ({ page }) => stubClipboard(page));

test("the control shows the open count and a menu", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await expect(page.locator(".launch .mode .n.on")).toHaveText("2");
  await menu(page);
  await expect(page.locator(".menu.show .mi")).toHaveCount(5);
});

test("Copy as Markdown copies Markdown with locations; Copy as Text copies the words", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await menu(page);
  await page.getByRole("menuitem", { name: "Copy as Markdown", exact: true }).click();
  await expect.poll(() => lastCopy(page)).toContain("# Review comments: Q3 plan");
  const md = await lastCopy(page);
  expect(md).toContain("- **Thread:** ");
  expect(md).toContain('- **Quoted text:** "20% lift"');
  await menu(page);
  await page.getByRole("menuitem", { name: "Copy as Text", exact: true }).click();
  await expect.poll(() => lastCopy(page)).toMatch(/^Section "Q3 plan"/);
  expect(await lastCopy(page)).not.toContain("**Thread:**");
});

test("a thread's own copy button always gives Markdown", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th");
  await th.locator(".tx").first().hover();
  await th.getByRole("button", { name: /^Copy/ }).first().click();
  await expect.poll(() => lastCopy(page)).toContain("- **Thread:** ");
});

test("the menu has no Send feedback or Add feedback rows", async ({ page }) => {
  await open(page, "doc.html");
  await menu(page);
  await expect(page.getByRole("menuitem", { name: /feedback/i })).toHaveCount(0);
});

test("dropping a feedback file on the page does nothing", async ({ browser }) => {
  const amy = await browser.newPage();
  await open(amy, "doc.html", { name: "Amy" });
  await seedText(amy, "#p2", "second designer", "From Amy");
  const file: string = await amy.evaluate(() => (window as any).pu.document.exportFile());
  await amy.close();
  const page = await browser.newPage();
  await open(page, "doc.html");
  await showComments(page);
  const prevented = await page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], "amy.pipeup.json", { type: "application/json" }));
    const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true });
    document.body.dispatchEvent(over);
    const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
    document.body.dispatchEvent(drop);
    return over.defaultPrevented || drop.defaultPrevented;
  }, file);
  expect(prevented).toBe(false);
  // Nothing listens for drops any more; flushing proves no import was queued.
  await page.evaluate(() => (window as any).pu.flush());
  await expect(page.locator(".th")).toHaveCount(0);
  // The only toast is still comment mode's keyboard hint.
  await expect(page.locator(".toast.show")).toContainText("Tab moves between blocks");
  expect(await page.evaluate(() => (window as any).pu.document.threads().length)).toBe(0);
});

test("mount no longer takes copyAs", () => {
  // @ts-expect-error copyAs was removed from the mount options
  const options: MountOptions = { copyAs: "text" };
  expect(options).toBeTruthy();
});

test("resolved threads hide; Show resolved brings them back with Reopen", async ({ page }) => {
  await open(page, "doc.html");
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate((id) => (window as any).pu.document.resolve(id), id);
  await showComments(page);
  await expect(page.locator(".th")).toHaveCount(0);
  await menu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page.getByRole("switch", { name: "Show resolved" }).click();
  await page.keyboard.press("Escape");
  const th = page.locator(".th.resolved");
  await expect(th).toHaveCount(1);
  await th.locator(".root").hover();
  await expect(th.getByRole("button", { name: "Reopen" })).toBeVisible();
});

test("leaving comment mode hides threads and highlights, fades the column, and selecting offers nothing", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await showComments(page);
  await expect(page.locator(".th")).toHaveCount(1);
  expect(await page.locator(".col").evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
    "opacity",
  );
  await menu(page);
  await page.getByRole("menuitemcheckbox", { name: "Start commenting" }).click();
  await expect(page.locator(".layer.hidden")).toHaveCount(1);
  await expect(page.locator(".th")).toHaveCount(0);
  await selectWords(page, "#p2", "second designer");
  await page.waitForTimeout(100); // Pipeup looks at the selection a tick after the mouse is released.
  await expect(page.locator(".selbar.show")).toHaveCount(0);
  await showComments(page);
  await page.mouse.click(900, 700); // move focus out of Pipeup so the next selection takes
  await selectWords(page, "#p2", "second designer");
  await expect(page.locator(".selbar.show")).toHaveCount(1);
});

test("Your name changes the name on new comments", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await menu(page);
  await page.locator(".menu.show [data-item=name]").click();
  const input = page.getByRole("textbox", { name: "Your name" });
  await input.fill("Robin");
  await input.press("Enter");
  await seedText(page, "#p1", "20% lift", "Short name now");
  expect(await page.evaluate(() => (window as any).pu.document.threads()[0].root.name)).toBe("Robin");
});

/** Opens the fixture with a store whose next save (after window.failNextSave()) fails once. */
async function openFlaky(page: import("@playwright/test").Page): Promise<void> {
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
}

test("resolving and reopening still succeed when the save fails, with a not-saved note", async ({ page }) => {
  await openFlaky(page);
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate(() => (window as any).failNextSave());
  const th = page.locator(".th");
  await th.locator(".tx").first().hover();
  await th.getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator(".toast.show")).toContainText("Resolved");
  await expect(page.locator(".toast.show")).toContainText("not saved yet");
  expect(await page.evaluate(() => (window as any).pu.document.threads()[0].resolved)).toBe(true);

  await menu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page.getByRole("switch", { name: "Show resolved" }).click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).failNextSave());
  const done = page.locator(".th.resolved");
  await done.locator(".root").hover();
  await done.getByRole("button", { name: "Reopen" }).click();
  await expect(page.locator(".toast.show")).toContainText("Reopened");
  await expect(page.locator(".toast.show")).toContainText("not saved yet");
  expect(await page.evaluate(() => (window as any).pu.document.threads()[0].resolved)).toBe(false);
});

test("a name that can't be remembered still applies, and says so", async ({ page }) => {
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
    w.pu = await w.Pipeup.mount({ store, name: "Sam" });
  });
  await page.evaluate(() => (window as any).failProfile());
  await menu(page);
  await page.locator(".menu.show [data-item=name]").click();
  const input = page.getByRole("textbox", { name: "Your name" });
  await input.fill("Robin");
  await input.press("Enter");
  await expect(page.locator(".toast.show")).toContainText("couldn't remember");
  expect(await page.evaluate(() => (window as any).pu.document.name)).toBe("Robin");
});
