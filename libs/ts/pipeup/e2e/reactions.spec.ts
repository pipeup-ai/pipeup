import { expect, test, type Page } from "@playwright/test";
import { open, openAll, seedText, showComments } from "./helpers";

/** Someone else reacts: a second identity signs a react op, merged as if it came from elsewhere. */
const reactAs = (page: Page, name: string, emoji: string) =>
  page.evaluate(
    async ([name, emoji]) => {
      const w = window as any;
      const pu = w.pu;
      const thread = pu.document.threads()[0];
      const who = await w.Pipeup.createIdentity();
      const body = {
        v: 1,
        kind: "react",
        doc: pu.document.id,
        thread: thread.id,
        target: thread.root.id,
        text: emoji,
        author: who.publicKey,
        name,
        clock: 1000,
        at: Date.now(),
      };
      const id = await w.Pipeup.computeOpId(body);
      return pu.document.merge([await w.Pipeup.signOp({ ...body, id }, who)], "test");
    },
    [name, emoji] as const,
  );

const start = async (page: Page) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
  await expect(page.locator(".th .tx")).toContainText("Is this the plan?");
};
const react = async (page: Page, emoji: string) => {
  await page.locator(".th").first().hover();
  await page.locator(".th button[aria-label=React]").click();
  await expect(page.locator(".th .rxo")).toHaveCount(6);
  await page.locator(".th .rxo", { hasText: emoji }).click();
};

test("a quick-row reaction shows under the words with a count, is marked as yours, and clicking it takes it back", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator(".th .rx")).toHaveCount(0);
  await react(page, "🎉");
  const chip = page.locator(".th .rx");
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText("🎉");
  await expect(chip).toContainText("1");
  // The count is seen, not only there: the corner's own count rule once hid it.
  await expect(chip.locator(".n")).toHaveCSS("opacity", "1");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toHaveAttribute("aria-label", "Party popper, 1 person, including you");
  // The quick row closed itself.
  await expect(page.locator(".th .rxq")).toHaveCount(0);
  await chip.click();
  await expect(page.locator(".th .rx")).toHaveCount(0);
});

test("other people's reactions are counted with yours, and pointing at one says who", async ({ page }) => {
  await start(page);
  await reactAs(page, "Sam", "🎉");
  const chip = page.locator(".th .rx");
  await expect(chip).toContainText("1");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await react(page, "🎉");
  await expect(chip).toContainText("2");
  await expect(chip).toHaveAttribute("aria-label", "Party popper, 2 people, including you");
  await chip.hover();
  await expect(chip.locator(".rc")).toHaveText("You, Sam");
  await expect(chip.locator(".rc")).toBeVisible();
});

test("reactions are kept when the page is reloaded", async ({ page }) => {
  await start(page);
  await react(page, "❤️");
  await expect(page.locator(".th .rx")).toHaveCount(1);
  await page.evaluate(() => (window as any).pu.flush());
  await page.reload();
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
  await showComments(page);
  await expect(page.locator(".th .rx")).toContainText("❤️");
});

test("an agent reads the reactions, and copying comments as Markdown carries them", async ({ page }) => {
  await start(page);
  await reactAs(page, "Sam", "👍");
  await react(page, "👍");
  const read = await page.evaluate(() => (window as any).Pipeup.comments());
  expect(read.threads[0].comments[0].reactions).toEqual([{ emoji: "👍", by: ["Sam", expect.any(String)] }]);
  expect(read.markdown).toMatch(/Reactions: 👍 2 \(Sam, .+\)/);
});

test("All comments shows a thread's reactions as counts", async ({ page }) => {
  await start(page);
  await react(page, "🙏");
  await openAll(page);
  await expect(page.locator(".all.show .cd .rest").first()).toContainText("🙏 1");
});

test("a keyboard user can react: the React button opens the quick row, and its buttons are named", async ({
  page,
}) => {
  await start(page);
  await page.locator(".th").first().hover();
  const button = page.locator(".th button[aria-label=React]");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Thumbs up" })).toBeVisible();
  await page.getByRole("button", { name: "Thumbs up" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".th .rx")).toHaveAttribute("aria-label", "Thumbs up, 1 person, including you");
});
