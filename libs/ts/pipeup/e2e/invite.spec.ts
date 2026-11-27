import { expect, test } from "@playwright/test";
import { open, openMenu } from "./helpers";

// Pipeup for your browser (§7c): the test browser is Chrome, whose listing is public. Design: docs/design/extension-invite.md.
const menu = (page: import("@playwright/test").Page) => page.locator(".menu.show");
const invite = (page: import("@playwright/test").Page) =>
  menu(page).getByRole("menuitem", { name: "Pipeup for Chrome" });

test("the offer is one row first from the top, folded, that opens to the store and to Don't tell me again", async ({
  page,
}) => {
  await open(page, "site.html");
  await openMenu(page);
  const row = invite(page);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(row).toHaveAttribute("aria-description", "Comment on any page, not only this one.");
  // First from the top: nothing but the quiet status line is above it.
  const first = await menu(page).evaluate((m) => m.querySelector(".mi")?.querySelector(".lb")?.textContent);
  expect(first).toBe("Pipeup for Chrome");
  // An ordinary row: one line, the same height as the others.
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(36);
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const store = menu(page).getByRole("menuitem", { name: "Chrome Web Store" });
  await expect(store).toBeVisible();
  await expect(store).toHaveAttribute("href", /^https:\/\/chromewebstore\.google\.com\//);
  await expect(store).toHaveAttribute("target", "_blank");
  await expect(store).toHaveAttribute("rel", /noopener/);
  await expect(store).toHaveAttribute(
    "aria-description",
    "Opens the store in a new tab. Pipeup makes no request itself.",
  );
  await expect(menu(page).getByRole("menuitem", { name: "Don't tell me again" })).toHaveAttribute(
    "aria-description",
    "Takes this row out of the menu on this site, in this browser.",
  );
  // ← folds the choices; the menu opens with them folded.
  await page.keyboard.press("ArrowLeft");
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(row).toBeFocused();
  await page.keyboard.press("Escape");
  await openMenu(page);
  await expect(invite(page)).toHaveAttribute("aria-expanded", "false");
});

test("Don't tell me again takes the row out while the menu stays open, and it stays out on this site", async ({
  page,
}) => {
  await open(page, "site.html");
  await openMenu(page);
  await invite(page).click();
  await menu(page).getByRole("menuitem", { name: "Don't tell me again" }).click();
  // The menu stays open; the block eases out and is out of the keyboard's reach; focus moves to your name.
  await expect(menu(page)).toHaveCount(1);
  await expect(menu(page).locator(".inv")).toHaveAttribute("inert", "");
  await expect(menu(page).locator(".inv")).not.toHaveClass(/\bopen\b/);
  await expect(menu(page).locator("[data-item=name]")).toBeFocused();
  // Remembered for this site in this browser: not in the next menu, nor after a reload.
  await page.keyboard.press("Escape");
  await openMenu(page);
  await expect(invite(page)).toHaveCount(0);
  await expect(menu(page).locator(".inv")).toHaveCount(0);
  await page.reload();
  await page.evaluate(async () => {
    (window as any).pu = await (window as any).Pipeup.mount({});
  });
  await openMenu(page);
  await expect(invite(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("pipeup:invite"))).toBe("1");
});

test("Get it from the store opens the listing in a new tab, closes the menu and ends the offer here", async ({
  page,
  context,
}) => {
  await context.route("https://chromewebstore.google.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<title>Store</title>" }),
  );
  await open(page, "site.html");
  await openMenu(page);
  await invite(page).click();
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    menu(page).getByRole("menuitem", { name: "Chrome Web Store" }).click(),
  ]);
  expect(popup.url()).toMatch(/^https:\/\/chromewebstore\.google\.com\//);
  await popup.close();
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page);
  await expect(invite(page)).toHaveCount(0);
});

test("no row where the author turned the offer off, or on a screen with only touch", async ({ page }) => {
  await open(page, "site.html", { settings: { "data-pipeup-extension": "off" } });
  await openMenu(page);
  await expect(invite(page)).toHaveCount(0);
  await expect(menu(page).locator(".inv")).toHaveCount(0);
});

test("no row on a screen with only touch", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await open(page, "site.html");
  await openMenu(page);
  await expect(invite(page)).toHaveCount(0);
  await context.close();
});
