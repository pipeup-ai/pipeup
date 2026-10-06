import { expect, test } from "@playwright/test";
import { fixture } from "./helpers";

test("the classic script defines the Pipeup global without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(fixture("doc.html"));
  expect(await page.evaluate(() => typeof (window as any).Pipeup?.PipeupDocument)).toBe("function");
  expect(errors).toEqual([]);
});
