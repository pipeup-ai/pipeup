import { expect, test } from "@playwright/test";
import { open, shareInfo } from "./share-helpers";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

test("unconfigured: off, with the reason, no row, nothing sent", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => r.url().startsWith("http") && requests.push(r.url()));
  await open(page, null);
  expect(await shareInfo(page)).toMatchObject({
    id: "share",
    state: "off",
    reason: "sharing isn't set up for this page",
  });
  await openMenu(page);
  await expect(page.locator(".menu.show")).not.toContainText("Shared");
  expect(requests).toEqual([]);
});

test("a malformed or http address is off with the reason", async ({ page }) => {
  await open(page, "http://paste.example.org/?f468483c313401e8#" + "a".repeat(43));
  expect(await shareInfo(page)).toMatchObject({
    state: "off",
    reason: "data-pipeup-share isn't a sharing address",
  });
});

test("without data-pipeup-doc it is off: needs a document identity", async ({ page }) => {
  await blank(page);
  await page.evaluate(
    (a) => {
      document.documentElement.removeAttribute("data-pipeup-doc");
      document.documentElement.setAttribute("data-pipeup-share", a);
    },
    "https://paste.example.org/?f468483c313401e8#" + "a".repeat(43),
  );
  await load(page, CORE, addon("share"));
  await mount(page);
  expect(await shareInfo(page)).toMatchObject({ state: "off", reason: "needs a document identity" });
});
