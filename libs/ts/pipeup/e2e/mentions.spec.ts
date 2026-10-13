import { expect, test, type Page } from "@playwright/test";
import { open, openMenu, seedText, showComments } from "./helpers";

/** Someone else replies, naming this reviewer: a second identity signs a reply op, merged as if it came from elsewhere. */
const sayAs = (page: Page, name: string, words: string, mention: "me" | "none" = "me") =>
  page.evaluate(
    async ([name, words, mention]) => {
      const w = window as any;
      const pu = w.pu;
      const thread = pu.document.threads()[0];
      const who = await w.Pipeup.createIdentity();
      const at = words.indexOf("@");
      const body: any = {
        v: 1,
        kind: "reply",
        doc: pu.document.id,
        thread: thread.id,
        target: thread.root.id,
        text: words,
        author: who.publicKey,
        name,
        clock: 1000,
        at: Date.now(),
      };
      if (mention === "me" && at >= 0)
        body.mentions = [{ start: at, end: words.length, ref: pu.document.me }];
      const id = await w.Pipeup.computeOpId(body);
      return pu.document.merge([await w.Pipeup.signOp({ ...body, id }, who)], "test");
    },
    [name, words, mention] as const,
  );

const start = async (page: Page) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "new onboarding flow", "Is this the plan?");
};

test("typing @ in a reply offers the people in the document, and the choice is a mention in the comment", async ({
  page,
}) => {
  await start(page);
  await sayAs(page, "Sam", "Looks right to me", "none");
  await showComments(page);
  await page.locator(".th .tx").first().click();
  const line = page.locator(".th .rbox textarea").first();
  await line.focus();
  await page.keyboard.type("Thanks @sa");
  const option = page.getByRole("option", { name: "Sam" });
  await expect(option).toBeVisible();
  await expect(page.locator(".mnl.show")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(line).toHaveValue("Thanks @Sam ");
  await page.keyboard.press("Enter");
  // The reply shows Sam's name marked as a mention, and it is stored with the person it points at.
  const mention = page.locator(".mn", { hasText: "@Sam" });
  await expect(mention).toBeVisible();
  const stored = await page.evaluate(() => {
    const t = (window as any).pu.document.threads()[0];
    return t.root.replies.at(-1).mentions;
  });
  expect(stored).toEqual([{ start: 7, end: 11, ref: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) }]);
});

test("Escape closes the list and keeps the words; with nobody to mention there is no list", async ({
  page,
}) => {
  await start(page);
  await showComments(page);
  await page.locator(".th .tx").first().click();
  const line = page.locator(".th .rbox textarea").first();
  await line.focus();
  await page.keyboard.type("hi @");
  // Only you are here: nobody else to offer.
  await expect(page.getByRole("option")).toHaveCount(0);
  await sayAs(page, "Sam", "Hello", "none");
  await page.keyboard.type(" and @");
  await expect(page.getByRole("option", { name: "Sam" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(line).toHaveValue("hi @ and @");
});

test("someone mentioning you is said once, filters All comments, and opening the thread marks it seen", async ({
  page,
}) => {
  await start(page);
  await showComments(page);
  await sayAs(page, "Sam", "Over to you @Me", "me");
  // Said once, in words.
  await expect(page.locator(".toast.show")).toHaveText("Sam mentioned you in 1 comment");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  const filter = page.getByRole("switch", { name: "Mentions of me" });
  await expect(filter).toBeVisible();
  // A second thread that names nobody is hidden by the filter.
  await page.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("#p3"), document.body),
      "Unrelated",
    );
  });
  await expect(page.locator(".all.show .mi")).toHaveCount(2);
  await filter.click();
  await expect(filter).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".all.show .mi")).toHaveCount(1);
  await expect(page.locator(".all.show .mi")).toContainText("Is this the plan?");
  // Opening it marks the mention seen on this device, as a signed op other devices learn from.
  await page.locator(".all.show .mi").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as any;
        const me = w.pu.document.me;
        return w.pu.document.threads()[0].root.replies.some((r: any) => r.seenBy?.includes(me));
      }),
    )
    .toBe(true);
  // Mentions that were seen aren't said again.
  await page.evaluate(() => (window as any).pu.document.resolve((window as any).pu.document.threads()[0].id));
  await expect(page.locator(".toast.show")).toHaveCount(0);
});

test("a person who shared an email can be told: the offer opens the reviewer's own mail, with the words and the page", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const w = window as any;
    const pu = w.pu;
    const thread = pu.document.threads()[0];
    const who = await w.Pipeup.createIdentity();
    const mk = async (kind: string, extra: any) => {
      const body = {
        v: 1,
        kind,
        doc: pu.document.id,
        thread: thread.id,
        author: who.publicKey,
        name: "Sam",
        clock: 1000,
        at: Date.now(),
        ...extra,
      };
      body.id = await w.Pipeup.computeOpId(body);
      return w.Pipeup.signOp(body, who);
    };
    await pu.document.merge(
      [
        await mk("reply", { target: thread.root.id, text: "Looks right to me" }),
        await mk("contact", { thread: who.publicKey, text: "sam@example.test", clock: 1001 }),
      ],
      "test",
    );
  });
  await showComments(page);
  await page.locator(".th .tx").first().click();
  const line = page.locator(".th .rbox textarea").first();
  await line.focus();
  await page.keyboard.type("Thanks @sa");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const offer = page.locator(".toast.show a.ta");
  await expect(page.locator(".toast.show")).toContainText("Let Sam know?");
  const href = (await offer.getAttribute("href"))!;
  expect(href).toMatch(/^mailto:sam@example\.test\?subject=/);
  const body = decodeURIComponent(href.split("&body=")[1]!);
  expect(body).toContain("Thanks @Sam");
  expect(body).toContain("Q3 plan");
});

test("sharing your own email is a choice in My identity, and can be taken back", async ({ page }) => {
  await open(page, "doc.html");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /My identity/ }).click();
  const dialog = page.getByRole("dialog", { name: "Your identity" });
  await dialog.getByRole("textbox", { name: "Email or GitHub name" }).fill("not an address");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog).toContainText("isn't an email address or a GitHub name");
  await dialog.getByRole("textbox", { name: "Email or GitHub name" }).fill("ada@example.test");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog).toContainText("Shared with everyone");
  expect(await page.evaluate(() => [...(window as any).pu.document.contacts().values()])).toEqual([
    "ada@example.test",
  ]);
  await dialog.getByRole("button", { name: "Stop sharing" }).click();
  expect(await page.evaluate(() => (window as any).pu.document.contacts().size)).toBe(0);
});
