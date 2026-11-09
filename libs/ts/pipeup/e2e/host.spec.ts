import { expect, test } from "@playwright/test";
import { open, seedText } from "./helpers";

/** Pipeup with its threads and comment box drawn by a host (the extension's side panel); what it says, kept. */
async function hosted(page: import("@playwright/test").Page): Promise<void> {
  await open(page, "doc.html", { ui: "host", control: "off" });
  await page.evaluate(() => {
    const w = window as any;
    w.heard = [];
    w.pu.on("open", (id: string | null) => w.heard.push(["open", id]));
    w.pu.on("pick", (p: { label: string; anchor: unknown }) => w.heard.push(["pick", p.label, !!p.anchor]));
  });
}
const heard = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).heard as unknown[]);

test("with a host, a click on a highlight tells the host and opens nothing on the page", async ({ page }) => {
  await hosted(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const at = await page.evaluate(() => {
    const q = ([...CSS.highlights.get("pipeup-quote")!][0] as Range).getClientRects()[0]!;
    return { x: q.left + 4, y: q.top + q.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => heard(page)).toEqual([["open", id]]);
  await expect(page.locator(".pop.show, .col .th, .all.show")).toHaveCount(0);
});

test("with a host, picking a place in comment mode tells the host, and no comment box opens on the page", async ({
  page,
}) => {
  await hosted(page);
  await page.evaluate(() => (window as any).pu.setCommentMode(true));
  const at = (await page.locator("#p2").boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  await expect.poll(() => heard(page)).toEqual([["pick", expect.stringMatching(/Paragraph/), true]]);
  await expect(page.locator(".draft")).toHaveCount(0);
});

test("a host can copy the comments as text, set the look and Hide comments, and go to a thread", async ({
  page,
}) => {
  await hosted(page);
  const id = await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const got = await page.evaluate(async (thread) => {
    const pu = (window as any).pu;
    const md = pu.commentsAs("ai");
    const text = pu.commentsAs("text");
    await pu.setLook("dark");
    await pu.setHidden(true);
    const after = { look: pu.look, hidden: pu.hidden };
    await pu.setHidden(false);
    await pu.openThread(thread);
    return { md, text, after };
  }, id);
  expect(got.md).toContain("# Comments on");
  expect(got.md).toContain("Is 20% realistic?");
  expect(got.text).toContain("Is 20% realistic?");
  expect(got.after).toEqual({ look: "dark", hidden: true });
  await expect(page.locator(".layer")).toHaveClass(/dark/);
  // Going to it opens nothing on the page, and doesn't tell the host it was opened from the page.
  await expect(page.locator(".pop.show, .col .th")).toHaveCount(0);
  expect(await heard(page)).toEqual([]);
});
