import { expect, test, type Page } from "@playwright/test";
import { control, fixture, openAll, seedText } from "./helpers";

// A page's own dialog never takes Pipeup's focus or closes for what happens in Pipeup (spec §9), and while All
// comments is open, messages sit inside the panel (spec §7).

const open = async (page: Page, name: string) => {
  await page.goto(fixture(name));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
};
const draftLine = (page: Page) => page.locator(".draft").getByRole("textbox", { name: "Comment" });

/** Comment mode from the comment control's menu (the shortcut is the page's while a field has focus). */
async function startCommenting(page: Page): Promise<void> {
  await control(page).click();
  await page.getByRole("menuitemcheckbox", { name: /Start commenting/ }).click();
  await expect(control(page)).toHaveClass(/\bon\b/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
}

for (const kind of ["radix", "trap"] as const)
  test(`in a page's ${kind === "radix" ? "library" : "focus-trapping"} dialog, a comment can be written: the dialog keeps neither the caret nor closes`, async ({
    page,
  }) => {
    await open(page, "modals.html");
    await page.click(`#open-${kind}`);
    await expect(page.locator(`#${kind}-input`)).toBeFocused();
    await startCommenting(page);
    // The dialog is still open: presses in Pipeup aren't presses outside it.
    await expect(page.locator(`#${kind}`)).toBeVisible();
    await page.locator(`#${kind}-p`).click();
    await expect(draftLine(page)).toBeFocused();
    await page.keyboard.type("Clearer, please");
    await expect(draftLine(page)).toHaveValue("Clearer, please");
    await expect(page.locator(`#${kind}-input`)).toHaveValue("");
    // Back in the box with a click after focus went elsewhere: the trap doesn't keep it out.
    await page.locator(`#${kind}-input`).focus();
    await draftLine(page).click();
    await expect(draftLine(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as any).pu.document.threads().length)).toBe(1);
    await expect(page.locator(`#${kind}`)).toBeVisible();
  });

/** Where Pipeup's element is: the id of its parent (a dialog), or its tag (HTML when it is home). */
const home = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector("pipeup-root")!.parentElement!;
    return p.id || p.tagName;
  });
/** Whether the page hit-tests Pipeup at the middle of `sel` (the comment control, a comment box): it is on top. */
const onTop = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector("pipeup-root")!.shadowRoot!.querySelector(sel)!;
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.localName === "pipeup-root";
  }, sel);
const threads = (page: Page) => page.evaluate(() => (window as any).pu.document.threads().length);

test("in a native modal dialog, Pipeup works above it and its backdrop, and its contents can be commented on", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  expect(await onTop(page, ".launch .mode")).toBe(true);
  await startCommenting(page);
  await page.locator("#native-p").click();
  await expect(draftLine(page)).toBeFocused();
  expect(await onTop(page, ".draft textarea")).toBe(true);
  await page.keyboard.type("Say what is lost");
  await page.keyboard.press("Enter");
  await expect.poll(() => threads(page)).toBe(1);
  // The dialog is still open, and closing it brings Pipeup's element home, still working.
  await expect(page.locator("#native")).toHaveAttribute("open", "");
  await page.evaluate(() => (document.getElementById("native") as HTMLDialogElement).close());
  await expect.poll(() => home(page)).toBe("HTML");
  expect(await onTop(page, ".launch .mode")).toBe(true);
});

test("a native dialog closed by Esc or its own button gives Pipeup back to the page", async ({ page }) => {
  await open(page, "modals.html");
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  await page.keyboard.press("Escape");
  await expect(page.locator("#native")).not.toHaveAttribute("open", "");
  await expect.poll(() => home(page)).toBe("HTML");
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  await page.click("#native-cancel");
  await expect.poll(() => home(page)).toBe("HTML");
  await control(page).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
});

test("nested native modals: Pipeup is in the one on top, and steps back out as each closes", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-native");
  await page.click("#open-nested");
  await expect.poll(() => home(page)).toBe("nested");
  expect(await onTop(page, ".launch .mode")).toBe(true);
  await page.click("#nested-close");
  await expect.poll(() => home(page)).toBe("native");
  await page.click("#native-cancel");
  await expect.poll(() => home(page)).toBe("HTML");
});

test("a native modal removed while open gives Pipeup back to the page, still working", async ({ page }) => {
  await open(page, "modals.html");
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  await page.evaluate(() => document.getElementById("native")!.remove());
  await expect.poll(() => home(page)).toBe("HTML");
  await control(page).click();
  await expect(page.locator(".menu.show")).toHaveCount(1);
});

test("a native dialog that isn't modal leaves Pipeup where it is, and can be commented on", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-plain");
  await startCommenting(page);
  expect(await home(page)).toBe("HTML");
  await page.locator("#plain-p").click();
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.type("Fine");
  await expect(draftLine(page)).toHaveValue("Fine");
});

test("a dialog that makes the rest of the page inert (Headless UI, MUI) leaves Pipeup working", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-inert");
  await startCommenting(page);
  await page.locator("#inertd-p").click();
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.type("Who is anyone?");
  await page.keyboard.press("Enter");
  await expect.poll(() => threads(page)).toBe(1);
});

test("an overlay at the highest z-index never covers Pipeup's control or its comment box", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-top");
  expect(await onTop(page, ".launch .mode")).toBe(true);
  await startCommenting(page);
  await page.locator("#top-p").click();
  await expect(draftLine(page)).toBeFocused();
  expect(await onTop(page, ".draft textarea")).toBe(true);
});

test("the Esc that closes the menu doesn't also leave comment mode, with focus on the page", async ({
  page,
}) => {
  await open(page, "doc.html");
  await control(page).click();
  await page.getByRole("menuitemcheckbox", { name: /Start commenting/ }).click();
  await page.evaluate(() => (document.querySelector("article a") as HTMLElement).focus());
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(control(page)).toHaveClass(/\bon\b/);
});

test("while All comments is open, messages sit inside the panel, above its footer, never over the page", async ({
  page,
}) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await openAll(page);
  const card = page.locator(".all .cd").first();
  await card.hover();
  await card.getByRole("button", { name: "Resolve" }).click();
  const toast = page.locator(".toast.show");
  await expect(toast).toBeVisible();
  const [t, panel, foot] = await Promise.all([
    toast.boundingBox(),
    page.locator(".all.show").boundingBox(),
    page.locator(".all.show .pf").boundingBox(),
  ]);
  expect(t!.x).toBeGreaterThanOrEqual(panel!.x);
  expect(t!.x + t!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  expect(t!.y + t!.height).toBeLessThanOrEqual(foot!.y);
  // On top of the panel, not behind it.
  const onTop = await toast.evaluate((el) => {
    // Hit-tested as if it took the pointer (it doesn't), so what is drawn on top answers.
    (el as HTMLElement).style.pointerEvents = "auto";
    const r = el.getBoundingClientRect();
    return el.contains(
      (el.getRootNode() as ShadowRoot).elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
    );
  });
  expect(onTop).toBe(true);
});
