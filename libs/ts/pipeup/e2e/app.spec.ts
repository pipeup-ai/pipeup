import { expect, test } from "@playwright/test";
import { bodySnapshot, fixture, open, seedText, showComments } from "./helpers";

test("mounting leaves the page exactly as it was", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  const before = await bodySnapshot(page);
  await page.evaluate(async () => {
    (window as any).pu = await (window as any).Pipeup.mount();
  });
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.waitForTimeout(400);
  expect(await bodySnapshot(page)).toBe(before);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
});

test("text comments are painted as highlights and follow edits to the page", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await expect.poll(() => page.evaluate(() => CSS.highlights.get("pipeup-quote")?.size ?? 0)).toBe(1);
  await page.evaluate(() => {
    const p = document.getElementById("p1")!;
    p.textContent = "Update: " + p.textContent;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = CSS.highlights.get("pipeup-quote");
        const r = h ? ([...h][0] as Range) : null;
        return r && r.startContainer.isConnected ? r.toString() : "";
      }),
    )
    .toBe("20% lift");
});

test("comments are kept across reloads", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await page.reload();
  await page.evaluate(async () => {
    (window as any).pu = await (window as any).Pipeup.mount();
  });
  expect(
    await page.evaluate(() => (window as any).pu.document.threads().map((t: any) => t.root.text)),
  ).toEqual(["Why Q4?"]);
});

test("pages with data-pipeup-doc mount themselves", async ({ page }) => {
  await page.goto(fixture("auto.html"));
  await expect(page.locator("pipeup-root")).toHaveCount(1);
});

test("a stale unmount does not break a newer mount", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  const same = await page.evaluate(async () => {
    const P = (window as any).Pipeup;
    const a = await P.mount();
    a.unmount();
    const b = await P.mount();
    a.unmount();
    return (await P.mount()) === b;
  });
  expect(same).toBe(true);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
});

test("a failed save leaves one comment in the document, not a duplicate", async ({ page }) => {
  await open(page, "doc.html");
  await page.evaluate(() => (window as any).pu.unmount());
  await page.evaluate(async () => {
    const P = (window as any).Pipeup;
    const inner = new P.MemoryStore();
    let failed = false;
    const store = new Proxy(inner, {
      get(t, k) {
        if (k === "append")
          return async (...a: unknown[]) => {
            if (!failed) {
              failed = true;
              throw new Error("pipeup: disk full");
            }
            return t.append(...a);
          };
        const v = t[k];
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    (window as any).pu = await P.mount({ store });
  });
  await seedText(page, "#p1", "20% lift", "first").catch(() => undefined);
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  const texts = await page.evaluate(() => (window as any).pu.document.threads().map((t: any) => t.root.text));
  expect(texts).toEqual(["first"]);
});

test("dark pages get dark highlight colours, light pages keep the light ones", async ({ page }) => {
  const quoteRule = () =>
    page.evaluate(
      () =>
        [...document.adoptedStyleSheets[0]!.cssRules].find((r) => r.cssText.includes("pipeup-quote"))!
          .cssText,
    );
  await page.goto(fixture("doc.html"));
  await page.evaluate(async () => {
    const w = window as any;
    w.pu = await w.Pipeup.mount({});
  });
  // Highlights show in comment mode, once they have eased in.
  await showComments(page);
  await expect.poll(quoteRule).toContain("250, 227, 188, 0.75");
  await page.reload();
  await page.evaluate(async () => {
    const w = window as any;
    document.body.style.background = "#111";
    document.body.style.color = "#eee";
    w.pu = await w.Pipeup.mount({});
  });
  await showComments(page);
  await expect.poll(quoteRule).toMatch(/rgba\(\d+, \d+, \d+, 0?\.[23]\d*\)/);
  const dark = await quoteRule();
  expect(dark).not.toContain("250, 227, 188");
  expect(dark).toMatch(/rgba\(\d+, \d+, \d+, 0?\.[23]\d*\)/);
});
