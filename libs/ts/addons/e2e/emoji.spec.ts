import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount } from "./helpers";

const start = async (page: Page) => {
  await blank(page);
  await load(page, CORE, addon("emoji"));
  await mount(page);
  await page.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Ready?",
    );
  });
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
  await expect(page.locator(".th .tx")).toContainText("Ready?");
};
const openPicker = async (page: Page) => {
  await page.locator(".th").first().hover();
  await page.locator(".th button[aria-label=React]").click();
  await page.locator(".th button[aria-label='More reactions']").click();
  await expect(page.getByRole("dialog", { name: "Choose a reaction" })).toBeVisible();
};

test("the quick row gains a More button, and the picker finds an emoji by its name", async ({ page }) => {
  await start(page);
  await openPicker(page);
  const picker = page.getByRole("dialog", { name: "Choose a reaction" });
  await expect(picker.getByRole("searchbox", { name: "Search emoji" })).toBeFocused();
  await page.keyboard.type("rocket");
  await expect(picker.getByRole("button", { name: "rocket" })).toBeVisible();
  await picker.getByRole("button", { name: "rocket" }).click();
  // It chose, closed, and the reaction shows with the emoji's own name.
  await expect(picker).toHaveCount(0);
  await expect(page.locator(".th .rx")).toHaveAttribute("aria-label", "rocket, 1 person, including you");
});

test("without the add-on there is no More button", async ({ page }) => {
  await blank(page);
  await load(page, CORE);
  await mount(page);
  await page.evaluate(() => {
    const w = window as any;
    return w.pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("[data-pipeup-id=p1]"), document.body),
      "Ready?",
    );
  });
  await page.keyboard.press("Shift+Alt+KeyC");
  await page.locator(".th").first().hover();
  await page.locator(".th button[aria-label=React]").click();
  await expect(page.locator(".th .rxo")).toHaveCount(6);
  await expect(page.locator(".th button[aria-label='More reactions']")).toHaveCount(0);
});

test("the groups, recent emoji and a skin tone are there, and the keyboard moves over the grid", async ({
  page,
}) => {
  await start(page);
  await openPicker(page);
  const picker = page.getByRole("dialog", { name: "Choose a reaction" });
  await expect(picker.getByRole("toolbar", { name: "Groups" }).getByRole("button")).toHaveCount(9);
  await expect(picker.getByRole("heading", { name: "Smileys & emotion" })).toBeVisible();
  // Down from the search goes into the grid; arrows move; Enter chooses.
  await page.keyboard.press("ArrowDown");
  await expect(picker.locator(".emoji-e").first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(picker.locator(".emoji-e").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(picker.locator(".emoji-e").nth(9)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(picker.getByRole("searchbox")).toBeFocused();
  // A skin tone changes the hands.
  await picker.getByRole("button", { name: /Skin tone/ }).click();
  await picker.getByRole("searchbox").fill("waving hand");
  await expect(picker.getByRole("button", { name: "waving hand, light skin tone" })).toBeVisible();
  await picker.getByRole("button", { name: "waving hand, light skin tone" }).click();
  await expect(page.locator(".th .rx")).toContainText("👋🏻");
  // Recent: the choice leads the picker next time.
  await openPicker(page);
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Recent" })).toBeVisible();
});

test("Escape closes the picker and nothing else", async ({ page }) => {
  await start(page);
  await openPicker(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose a reaction" })).toHaveCount(0);
  // Comment mode (and the thread) are still as they were.
  await expect(page.locator(".launch .mode")).toHaveClass(/\bon\b/);
  await expect(page.locator(".th .tx")).toContainText("Ready?");
});

test("a click elsewhere closes it", async ({ page }) => {
  await start(page);
  await openPicker(page);
  await page.mouse.click(30, 700);
  await expect(page.getByRole("dialog", { name: "Choose a reaction" })).toHaveCount(0);
});
