import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { open, openMenu, stubClipboard } from "./helpers";

const CODE = /PU1(-[0-9A-Z]{4}){14}/;
const me = (page: Page) => page.evaluate(() => (window as any).pu.document.me as string);
const dialog = (page: Page) => page.getByRole("dialog", { name: "Your identity" });
const reopen = async (page: Page) => {
  await page.reload();
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount();
  });
};
const identity = async (page: Page) => {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /My identity/ }).click();
  await expect(dialog(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => stubClipboard(page));

test("an ordinary identity can be made portable: the code is shown, copied and saved, and used after a reload", async ({
  page,
}) => {
  await open(page, "doc.html");
  const before = await me(page);
  await identity(page);
  await expect(dialog(page)).toContainText("stays in this browser");
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  await expect(dialog(page)).toContainText("nothing is left behind");
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  const code = (await dialog(page).locator("code").textContent())!;
  expect(code).toMatch(CODE);
  await dialog(page).getByRole("button", { name: "Copy code" }).click();
  await expect(dialog(page)).toContainText("Copied.");
  expect(await page.evaluate(() => (window as any).__copied)).toEqual([code]);
  const download = page.waitForEvent("download");
  await dialog(page).getByRole("button", { name: "Save as a file" }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe("pipeup-identity.pipeup-id");
  expect((await readFile((await saved.path())!, "utf8")).trim()).toBe(code);
  await dialog(page).getByRole("button", { name: "Done, and use it now" }).click();
  await page.waitForLoadState("load");
  await reopen(page);
  expect(await me(page)).not.toBe(before);
  // Now it can be backed up again, and shows the same code.
  await identity(page);
  await dialog(page).getByRole("button", { name: "Back up my identity" }).click();
  await expect(dialog(page).locator("code")).toHaveText(code);
});

test("a recovery code brings the same identity back in another browser", async ({ page, browser }) => {
  await open(page, "doc.html");
  await identity(page);
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  await expect(dialog(page)).toContainText("nothing is left behind");
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  const code = (await dialog(page).locator("code").textContent())!;
  await dialog(page).getByRole("button", { name: "Done, and use it now" }).click();
  await reopen(page);
  const mine = await me(page);

  const other = await (await browser.newContext()).newPage();
  await open(other, "doc.html");
  expect(await me(other)).not.toBe(mine);
  await identity(other);
  await dialog(other).getByRole("button", { name: "Use a recovery code" }).click();
  // A code with a mistake is refused, in words, and nothing changes.
  const chars = code.split("");
  const at = chars.findIndex((c, i) => i > 6 && c !== "-");
  chars[at] = chars[at] === "A" ? "B" : "A";
  await dialog(other).getByRole("textbox", { name: "Recovery code" }).fill(chars.join(""));
  await dialog(other).getByRole("button", { name: "Use this identity" }).click();
  await expect(dialog(other)).toContainText("The code has a mistake");
  await dialog(other)
    .getByRole("textbox", { name: "Recovery code" })
    .fill(code.toLowerCase().replace(/-/g, " "));
  await dialog(other).getByRole("button", { name: "Use this identity" }).click();
  await expect(dialog(other)).toContainText("Your identity is back");
  await dialog(other).getByRole("button", { name: "Reload" }).click();
  await other.waitForLoadState("load");
  await reopen(other);
  expect(await me(other)).toBe(mine);
  await other.context().close();
});

test("something that isn't a code is said so in words, and Escape closes the dialog", async ({ page }) => {
  await open(page, "doc.html");
  await identity(page);
  await dialog(page).getByRole("button", { name: "Use a recovery code" }).click();
  await dialog(page).getByRole("textbox", { name: "Recovery code" }).fill("hello");
  await dialog(page).getByRole("button", { name: "Use this identity" }).click();
  await expect(dialog(page)).toContainText("doesn't look like a recovery code");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
});
