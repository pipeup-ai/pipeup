import { expect, test } from "@playwright/test";

test("the add-on is on, says what it sends, and its row opens a panel", async ({ page }) => {
  await page.goto("/page/");
  // Pipeup mounts itself; wait for its comment control, then turn comments on.
  await expect(page.locator(".launch")).toHaveCount(1);
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);

  // Pipeup knows the add-on, it is on, and it gave its one sentence about what it sends.
  const info = await page.evaluate(() =>
    (window as any).Pipeup.addons().find((a: any) => a.id === "acme-hello"),
  );
  expect(info.state).toBe("on");
  expect(info.network.says).toMatch(/\S/);

  await page.locator(".launch .mode").click();
  await page.locator(".menu.show").getByText("Say hello").click();
  await expect(page.locator(".xp.show")).toContainText("It sends nothing anywhere");
});
