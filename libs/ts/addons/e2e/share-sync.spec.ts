import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { comment, menu, open, poke, service, shareInfo, texts, type Service } from "./share-helpers";

for (const kind of ["mailbox", "privatebin"] as const) {
  test.describe(`share over ${kind === "mailbox" ? "an HTTP mailbox" : "PrivateBin"}`, () => {
    let svc: Service;
    const down = { on: false };
    test.beforeEach(async () => {
      svc = await service(kind);
      down.on = false;
    });
    test.afterEach(() => svc.close());

    const reviewer = async (browser: import("@playwright/test").Browser) => {
      const context: BrowserContext = await browser.newContext();
      await svc.route(context, down);
      const page = await context.newPage();
      return { context, page };
    };
    const converge = (page: Page, expected: string[]) =>
      expect
        .poll(
          async () => {
            await poke(page);
            return (await texts(page)).sort();
          },
          { timeout: 25_000, intervals: [500] },
        )
        .toEqual(expected);

    test("two reviewers on the same page converge, and the add-on is on", async ({ browser }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      await open(a.page, svc.address);
      await open(b.page, svc.address);
      expect(await shareInfo(a.page)).toMatchObject({ id: "share", state: "on" });
      await comment(a.page, "From Sam");
      await converge(b.page, ["From Sam"]);
      await comment(b.page, "From Ada");
      await converge(a.page, ["From Ada", "From Sam"]);
      // Neither page re-sent what it received: one batch each.
      expect(await svc.count()).toBe(2);
      await a.context.close();
      await b.context.close();
    });

    test("the menu shows the switch as 'Shared · up to date', and the composer note until the first shared comment", async ({
      browser,
    }) => {
      const a = await reviewer(browser);
      await open(a.page, svc.address);
      const m = await menu(a.page);
      await expect(m.locator(".lb", { hasText: "Shared · up to date" })).toBeVisible();
      await expect(
        m.locator("[role=menuitemcheckbox]", { hasText: "Shared · up to date" }).first(),
      ).toHaveAttribute("aria-checked", "true");
      await expect(m.locator(".sec")).toHaveText("Shared · up to date");
      await m.getByText("Start commenting").click();
      await a.page.locator("[data-pipeup-id=p2]").click();
      await a.page.locator("[data-pipeup-id=p2]").click();
      await expect(a.page.locator(".draft .note")).toHaveText(
        "Comments here are shared with everyone who has this page.",
      );
      await a.context.close();
    });

    test("comments written before sharing are held until the reviewer chooses", async ({ browser }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      await open(a.page, null);
      await comment(a.page, "Written early");
      await open(a.page, svc.address);
      await open(b.page, svc.address);
      const m = await menu(a.page);
      await expect(m.getByText("Share my 1 earlier comment")).toBeVisible();
      await expect(m.getByText("Keep them on this machine")).toBeVisible();
      await comment(a.page, "Written after");
      await converge(b.page, ["Written after"]);
      expect(await texts(b.page)).not.toContain("Written early");
      await m.getByText("Share my 1 earlier comment").click();
      await converge(b.page, ["Written after", "Written early"]);
      await a.page
        .locator(".launch .mode")
        .click()
        .catch(() => {});
      await expect(a.page.getByText("Keep them on this machine")).toHaveCount(0);
      await a.context.close();
      await b.context.close();
    });

    test("'Keep them on this machine' keeps earlier comments and their later edits out for good", async ({
      browser,
    }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      await open(a.page, null);
      const id = await comment(a.page, "Private early");
      await open(a.page, svc.address);
      await open(b.page, svc.address);
      const m = await menu(a.page);
      await m.getByText("Keep them on this machine").click();
      await a.page.evaluate((i) => (window as any).pu.document.edit(i, "Private early, edited"), id);
      await comment(a.page, "Public later");
      await converge(b.page, ["Public later"]);
      await a.page.waitForTimeout(3000);
      expect(await texts(b.page)).toEqual(["Public later"]);
      expect(await svc.count()).toBe(1);
      await a.context.close();
      await b.context.close();
    });

    test("with 'Send my comments' off, new comments and edits stay private, and others' still arrive", async ({
      browser,
    }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      await open(a.page, svc.address);
      await open(b.page, svc.address);
      const m = await menu(a.page);
      await m.locator("[role=menuitemcheckbox]").first().click();
      await expect(m.getByText("Send my comments")).toBeVisible();
      const id = await comment(a.page, "Stays here");
      await a.page.evaluate((i) => (window as any).pu.document.edit(i, "Stays here, edited"), id);
      await comment(b.page, "From Ada");
      await converge(a.page, ["From Ada", "Stays here, edited"]);
      await a.page.waitForTimeout(3500);
      expect(await texts(b.page)).toEqual(["From Ada"]);
      expect(await svc.count()).toBe(1);
      // Turning it back on sends only later comments.
      await m.getByText("Send my comments").click();
      await comment(a.page, "Shared again");
      await converge(b.page, ["From Ada", "Shared again"]);
      expect(await texts(b.page)).not.toContain("Stays here, edited");
      await a.context.close();
      await b.context.close();
    });

    test("someone else's comments that arrive by file are never uploaded", async ({ browser }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      const c = await reviewer(browser);
      await open(b.page, null);
      await comment(b.page, "Ada's private");
      const ops = await b.page.evaluate(() => (window as any).pu.document.ops());
      await open(a.page, svc.address);
      await a.page.evaluate((o) => (window as any).pu.document.merge(o, "file"), ops);
      expect(await texts(a.page)).toEqual(["Ada's private"]);
      await comment(a.page, "Sam's own");
      await open(c.page, svc.address);
      await converge(c.page, ["Sam's own"]);
      await a.page.waitForTimeout(2500);
      expect(await texts(c.page)).toEqual(["Sam's own"]);
      for (const x of [a, b, c]) await x.context.close();
    });

    test("offline: the reviewer keeps working, and the comment is sent when the connection returns", async ({
      browser,
    }) => {
      const a = await reviewer(browser);
      const b = await reviewer(browser);
      await open(a.page, svc.address);
      await open(b.page, svc.address);
      down.on = true;
      await comment(a.page, "While offline");
      const m = await menu(a.page);
      await expect(m.locator("[role=menuitemcheckbox]").first()).toHaveText(
        /Shared · offline, sends when back/,
        { timeout: 15_000 },
      );
      down.on = false;
      await a.page.evaluate(() => window.dispatchEvent(new Event("online")));
      await converge(b.page, ["While offline"]);
      await a.context.close();
      await b.context.close();
    });

    test("when the shared copy is deleted the label says it is gone", async ({ browser }) => {
      const a = await reviewer(browser);
      await open(a.page, svc.address);
      await svc.gone();
      await poke(a.page);
      const m = await menu(a.page);
      await expect(m.locator("[role=menuitemcheckbox]").first()).toHaveText(/The shared copy is gone/, {
        timeout: 10_000,
      });
      await comment(a.page, "Still works locally");
      expect(await texts(a.page)).toEqual(["Still works locally"]);
      await a.context.close();
    });
  });
}
