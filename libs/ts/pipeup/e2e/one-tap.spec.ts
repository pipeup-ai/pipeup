import { expect, test } from "@playwright/test";
import { commenting, control, fixture, moreButton, open, selectWords } from "./helpers";

test("one click on the control starts comment mode, and another stops it", async ({ page }) => {
  await open(page, "doc.html");
  await expect(control(page)).toHaveAttribute("aria-pressed", "false");
  await control(page).click();
  await commenting(page);
  await expect(control(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await control(page).click();
  await commenting(page, false);
});

test("⋯ at the end of the control's reach opens the menu", async ({ page }) => {
  await open(page, "doc.html");
  await control(page).hover();
  await moreButton(page).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await expect(page.getByRole("menuitem", { name: /All comments/ })).toBeVisible();
  await commenting(page, false);
});

test("↑ on the focused control opens the menu at Start commenting", async ({ page }) => {
  await open(page, "doc.html");
  await control(page).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".menu.show")).toHaveCount(1);
  await expect(page.getByRole("menuitemcheckbox", { name: "Start commenting" })).toBeFocused();
});

test("selecting words outside comment mode offers a comment, and leaves comment mode off", async ({
  page,
}) => {
  await open(page, "doc.html", { name: "Lee" });
  await selectWords(page, "#p1", "pricing changes");
  const bar = page.locator(".selbar.show");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Comment" }).click();
  const box = page.locator("textarea").first();
  await expect(box).toBeFocused();
  await commenting(page, false);
  await box.fill("Can we say when?");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => (window as any).pu.document.threads().map((t: any) => t.root.text)))
    .toEqual(["Can we say when?"]);
  await commenting(page, false);
});

test("a page can keep the selection's comment to comment mode", async ({ page }) => {
  await page.goto(fixture("script-settings.html"));
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await selectWords(page, "main p", "host wrote");
  await page.waitForTimeout(400);
  await expect(page.locator(".selbar.show")).toHaveCount(0);
  await control(page).click();
  await commenting(page);
  await selectWords(page, "main p", "host wrote");
  await expect(page.locator(".selbar.show")).toBeVisible();
});

test("settings on the script line work where the host wrote its own html tag", async ({ page }) => {
  await page.goto(fixture("script-settings.html"));
  const id = await page.evaluate(async () => (await (window as any).Pipeup.mount()).document.id);
  expect(id).toBe("sCrIpTfIxTuRe001");
  expect(await page.evaluate(() => (window as any).Pipeup.setting("data-pipeup-select"))).toBe(
    "comment-mode",
  );
});

test("settings given when the page starts Pipeup come first", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  const id = await page.evaluate(
    async () =>
      (
        await (window as any).Pipeup.mount({
          doc: "gIvEnFiXtUrE0001:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
        })
      ).document.id,
  );
  expect(id).toBe("gIvEnFiXtUrE0001");
});

test("the page's code turns comment mode on and off and hears every change", async ({ page }) => {
  await open(page, "doc.html");
  await page.evaluate(() => {
    const w = window as any;
    w.heard = [];
    w.pu.on("change", (s: any) => w.heard.push(s.commentMode));
  });
  await page.evaluate(() => (window as any).pu.setCommentMode(true));
  await commenting(page);
  expect(await page.evaluate(() => (window as any).pu.commentMode)).toBe(true);
  // Turned off by the reviewer, with Esc: the page hears that too.
  await page.keyboard.press("Escape");
  await commenting(page, false);
  await control(page).click();
  await commenting(page);
  await expect.poll(() => page.evaluate(() => (window as any).heard)).toEqual([true, false, true]);
});

test("the page's code sets the reviewer's name, and hears when they change it", async ({ page }) => {
  await open(page, "doc.html");
  await page.evaluate(() => {
    const w = window as any;
    w.names = [];
    w.pu.on("change", (s: any) => w.names.push(s.name));
  });
  await page.evaluate(() => (window as any).pu.setName("  Ada   Lovelace "));
  expect(await page.evaluate(() => (window as any).pu.name)).toBe("Ada Lovelace");
  await expect.poll(() => page.evaluate(() => (window as any).names)).toEqual(["Ada Lovelace"]);
  // Kept as if typed: a fresh start remembers it.
  await page.reload();
  await page.evaluate(async () => ((window as any).pu = await (window as any).Pipeup.mount()));
  expect(await page.evaluate(() => (window as any).pu.name)).toBe("Ada Lovelace");
});

test("when Pipeup can't start, the page learns why", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  const why = await page.evaluate(async () => {
    const broken = new Proxy({}, { get: () => () => Promise.reject(new Error("disk full")) });
    try {
      await (window as any).Pipeup.mount({ store: broken });
      return null;
    } catch (e: any) {
      return { code: e.code, message: e.message };
    }
  });
  expect(why?.code).toBe("failed");
  expect(why?.message).toContain("disk full");
});

test.describe("by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 760 } });

  test("pressing and holding the control opens its menu, and comment mode stays as it was", async ({
    page,
  }) => {
    await open(page, "doc.html");
    await control(page).evaluate(async (b) => {
      const at = { bubbles: true, composed: true, pointerType: "touch", isPrimary: true };
      b.dispatchEvent(new PointerEvent("pointerdown", at));
      await new Promise((r) => setTimeout(r, 650));
      b.dispatchEvent(new PointerEvent("pointerup", at));
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    });
    await expect(page.locator(".menu.show")).toHaveCount(1);
    await commenting(page, false);
  });

  test("a tap starts comment mode, and the first hint says where the menu went", async ({ page }) => {
    await open(page, "doc.html");
    await control(page).tap();
    await commenting(page);
    await expect(page.locator(".toast.show")).toContainText("Press and hold this button for more");
  });
});
