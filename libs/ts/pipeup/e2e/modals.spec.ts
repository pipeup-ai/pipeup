import { expect, test, type Page } from "@playwright/test";
import { control, fixture, openAll, openMenu, seedText } from "./helpers";

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
  await openMenu(page);
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

/** Pipeup's element, wherever it is: under <html>, in a page's dialog, or in a web component's dialog. */
const ROOT = `(() => document.querySelector("pipeup-root") ??
  [...document.querySelectorAll("*")].map((e) => e.shadowRoot?.querySelector("pipeup-root")).find(Boolean))()`;
/** Where Pipeup's element is: the id of its parent (a dialog), or its tag (HTML when it is home). */
const home = (page: Page) =>
  page.evaluate((root) => {
    const p = (eval(root) as Element).parentElement!;
    return p.id || p.tagName;
  }, ROOT);
/** Whether what is drawn at the middle of `sel` in Pipeup (the comment control, a comment box) is Pipeup: on top. */
const onTop = (page: Page, sel: string) =>
  page.evaluate(
    ([root, sel]) => {
      const host = eval(root) as Element;
      const el = host.shadowRoot!.querySelector(sel)!;
      const r = el.getBoundingClientRect();
      const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
      let hit = document.elementFromPoint(x, y);
      // Into web components' shadow roots, down to what is drawn there.
      while (hit?.shadowRoot && hit !== host) {
        const inner = hit.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === hit) break;
        hit = inner;
      }
      return hit === host;
    },
    [ROOT, sel] as const,
  );
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
  await openMenu(page);
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
  await openMenu(page);
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

for (const kind of ["radix", "trap"] as const)
  test(`in a page's ${kind === "radix" ? "library" : "focus-trapping"} dialog that hears keys first, Esc and Tab in a comment box stay Pipeup's`, async ({
    page,
  }) => {
    await open(page, "modals.html");
    await page.click(`#open-${kind}`);
    await startCommenting(page);
    await page.locator(`#${kind}-p`).click();
    await page.keyboard.type("Half a thought");
    // Tab moves within the box (to Cancel), not into the dialog's own field.
    await page.keyboard.press("Tab");
    await expect(page.locator(`#${kind}-input`)).not.toBeFocused();
    await expect(page.locator(".draft").getByRole("button", { name: "Cancel" })).toBeFocused();
    // Esc in the box throws the words away (with Undo), and the dialog stays open.
    await draftLine(page).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(".toast.show")).toContainText("Comment discarded");
    await expect(page.locator(`#${kind}`)).toBeVisible();
    expect(await page.evaluate(() => (window as any).closedBy)).toBeUndefined();
    // Typing and Enter still do what they do: the words are written, and Enter sends.
    await page.locator(`#${kind}-p`).click();
    await page.keyboard.type("Clearer");
    await page.keyboard.press("Enter");
    await expect.poll(() => threads(page)).toBe(1);
  });

test("in a web component's modal dialog, Pipeup moves in with it and stays usable", async ({ page }) => {
  await open(page, "modals.html");
  await seedText(page, "#page-p", "behind the dialogs", "Is this the right page?");
  await page.click("#open-wc");
  await expect
    .poll(() =>
      page.evaluate(() => !!document.getElementById("wc")!.shadowRoot!.querySelector("dialog > pipeup-root")),
    )
    .toBe(true);
  expect(await onTop(page, ".launch .mode")).toBe(true);
  // The comment control and All comments work: a reply can be written there.
  await openAll(page);
  await page.locator(".all.show .mi").first().click();
  await page.keyboard.type("Yes");
  await expect(page.locator(".all.show .rbox textarea")).toHaveValue("Yes");
  // Closed, Pipeup's element is home again.
  await page.evaluate(() => (document.getElementById("wc") as any).close());
  await page.locator("#page-p").click({ force: true });
  await expect.poll(() => home(page)).toBe("HTML");
});

test("a web component's dialog closed by its own button, with focus going nowhere, gives Pipeup back to the page", async ({
  page,
}) => {
  await open(page, "modals.html");
  // Opened by the page's script, with nothing focused before it.
  await page.evaluate(() => (document.getElementById("wc") as any).open());
  await expect.poll(() => home(page)).not.toBe("HTML");
  await page.locator("#wc #leave").click();
  await expect.poll(() => home(page)).toBe("HTML");
  expect(await onTop(page, ".launch .mode")).toBe(true);
});

test("a dialog centred with a transform never holds Pipeup inside its own box: Pipeup waits outside it", async ({
  page,
}) => {
  await open(page, "modals.html");
  await page.click("#open-moved");
  await expect(page.locator("#moved")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await home(page)).toBe("HTML");
  // The comment control is still in the window's corner, not the dialog's.
  const c = (await control(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(c.x + c.width).toBeGreaterThan(vp.width - 2);
  expect(c.y + c.height).toBeGreaterThan(vp.height - 2);
  await page.keyboard.press("Escape");
  await expect(page.locator("#moved")).toBeHidden();
  expect(await onTop(page, ".launch .mode")).toBe(true);
});

test("a dialog that renders its contents again keeps the caret in the comment box", async ({ page }) => {
  await open(page, "modals.html");
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  await startCommenting(page);
  await page.locator("#native-p").click();
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.type("Say what ");
  // The page puts its dialog's contents back, taking Pipeup's element out with them.
  await page.evaluate(() => {
    const d = document.getElementById("native")!;
    const kept = [...d.children].filter((c) => c.localName !== "pipeup-root");
    d.replaceChildren(...kept);
  });
  await expect.poll(() => home(page)).toBe("native");
  await page.keyboard.type("is lost");
  await expect(draftLine(page)).toHaveValue("Say what is lost");
});

test("an element shown fullscreen holds Pipeup while it is, and can be commented on", async ({ page }) => {
  await open(page, "modals.html");
  await page.click("#open-fs");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe("stage");
  await expect.poll(() => home(page)).toBe("stage");
  expect(await onTop(page, ".launch .mode")).toBe(true);
  await startCommenting(page);
  await page.locator("#stage-p").click();
  await expect(draftLine(page)).toBeFocused();
  await page.keyboard.type("Which quarter?");
  await page.keyboard.press("Enter");
  await expect.poll(() => threads(page)).toBe(1);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => home(page)).toBe("HTML");
});

test("the Esc that closes the menu doesn't also leave comment mode, with focus on the page", async ({
  page,
}) => {
  await open(page, "doc.html");
  await openMenu(page);
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

test("with a modal dialog or an inert overlay open, the block cursor only visits what is in it", async ({
  page,
}) => {
  await open(page, "modals.html");
  /** Whether the block the cursor is on is inside `sel`. */
  const cursorIn = (sel: string) =>
    page.evaluate(
      ([root, sel]) => {
        const a = (eval(root) as Element).shadowRoot!.activeElement;
        if (!a?.matches(".km")) return null;
        const el = a.ariaLabelledByElements?.[1]?.matches("span")
          ? a.ariaDescribedByElements?.at(-1)
          : a.ariaLabelledByElements?.[1];
        return !!el?.closest(sel);
      },
      [ROOT, sel] as const,
    );
  await page.click("#open-native");
  await expect.poll(() => home(page)).toBe("native");
  await page.keyboard.press("Shift+Alt+KeyC");
  for (let i = 0; i < 6; i++) {
    await expect.poll(() => cursorIn("#native")).toBe(true);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator("#native")).toBeHidden();
  await page.click("#open-inert");
  await page.keyboard.press("Shift+Alt+KeyC");
  for (let i = 0; i < 4; i++) {
    await expect.poll(() => cursorIn("#inertd")).toBe(true);
    await page.keyboard.press("Tab");
  }
});
