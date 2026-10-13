import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu, stubClipboard } from "./helpers";

const CODE = /PU1(-[0-9A-Z]{4}){14}/;
const me = (page: Page) => page.evaluate(() => (window as any).pu.document.me as string);
const dialog = (page: Page) => page.getByRole("dialog", { name: "Your identity" });
/** Pipeup with the identity add-on, or without it. */
const start = async (page: Page, withAddon = true) => {
  await blank(page);
  await load(page, CORE, ...(withAddon ? [addon("identity")] : []));
  await mount(page);
};
const identity = async (page: Page) => {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /My identity/ }).click();
  await expect(dialog(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => stubClipboard(page));

test("without the add-on the menu has no My identity row, and with it the row is there", async ({ page }) => {
  await start(page, false);
  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: /My identity/ })).toHaveCount(0);
  await start(page);
  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: /My identity/ })).toHaveCount(1);
});

test("an ordinary identity can be made portable: the code is shown, copied and saved, and used after a reload", async ({
  page,
}) => {
  await start(page);
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
  await start(page);
  expect(await me(page)).not.toBe(before);
  // Now it can be backed up again, and shows the same code.
  await identity(page);
  await dialog(page).getByRole("button", { name: "Back up my identity" }).click();
  await expect(dialog(page).locator("code")).toHaveText(code);
});

test("a recovery code brings the same identity back in another browser, and Pipeup keeps using it without the add-on", async ({
  page,
  browser,
}) => {
  await start(page);
  await identity(page);
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  await expect(dialog(page)).toContainText("nothing is left behind");
  await dialog(page).getByRole("button", { name: "Make it portable" }).click();
  const code = (await dialog(page).locator("code").textContent())!;
  await dialog(page).getByRole("button", { name: "Done, and use it now" }).click();
  await page.waitForLoadState("load");
  await start(page);
  const mine = await me(page);

  const other = await (await browser.newContext()).newPage();
  await start(other);
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
  await start(other);
  expect(await me(other)).toBe(mine);
  // A page without the add-on still writes as that identity.
  await start(other, false);
  expect(await me(other)).toBe(mine);
  await other.context().close();
});

test("something that isn't a code is said so in words, and Escape closes the dialog", async ({ page }) => {
  await start(page);
  await identity(page);
  await dialog(page).getByRole("button", { name: "Use a recovery code" }).click();
  await dialog(page).getByRole("textbox", { name: "Recovery code" }).fill("hello");
  await dialog(page).getByRole("button", { name: "Use this identity" }).click();
  await expect(dialog(page)).toContainText("doesn't look like a recovery code");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
});

test("sharing your own email is a choice in My identity, and can be taken back", async ({ page }) => {
  await start(page);
  await identity(page);
  await dialog(page).getByRole("textbox", { name: "Email or GitHub name" }).fill("not an address");
  await dialog(page).getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog(page)).toContainText("isn't an email address or a GitHub name");
  await dialog(page).getByRole("textbox", { name: "Email or GitHub name" }).fill("ada@example.test");
  await dialog(page).getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog(page)).toContainText("Shared with everyone");
  expect(await page.evaluate(() => [...(window as any).pu.document.contacts().values()])).toEqual([
    "ada@example.test",
  ]);
  await dialog(page).getByRole("button", { name: "Stop sharing" }).click();
  expect(await page.evaluate(() => (window as any).pu.document.contacts().size)).toBe(0);
});

test("an add-on can only hand Pipeup an extractable Ed25519 private key as an identity", async ({ page }) => {
  await start(page);
  const refused = await page.evaluate(async () => {
    const w = window as any;
    let host: any;
    w.Pipeup.use({
      id: "probe",
      api: 1,
      version: "1",
      needs: ["identity"],
      network: { when: "never", to: [], says: "x" },
      setup: (h: any) => void (host = h),
    });
    await new Promise((r) => setTimeout(r, 50));
    const ordinary = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    const out: string[] = [];
    try {
      await host.identity.use((ordinary as CryptoKeyPair).privateKey);
    } catch (e) {
      out.push(String(e));
    }
    out.push(String(host.identity.portable), String(await host.identity.seed()));
    return out;
  });
  expect(refused[0]).toContain("extractable Ed25519 private key");
  expect(refused.slice(1)).toEqual(["false", "null"]);
});
