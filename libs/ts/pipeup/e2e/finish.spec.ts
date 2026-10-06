import { expect, test } from "@playwright/test";
import {
  bodySnapshot,
  fixture,
  open,
  seedText,
  selectWords,
  settled,
  showComments,
  openMenu,
} from "./helpers";

test("when this browser can't store comments, Pipeup says so and keeps working", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw new Error("blocked");
        },
      },
    });
  });
  await open(page, "doc.html");
  await expect(page.locator(".toast.show")).toContainText("can't keep comments");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Still works");
  await expect(page.locator(".th")).toContainText("Still works");
});

test("unmount removes everything Pipeup added", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.evaluate(() => (window as any).pu.unmount());
  await expect(page.locator("pipeup-root")).toHaveCount(0);
  expect(await page.evaluate(() => CSS.highlights.has("pipeup-quote"))).toBe(false);
  expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
});

test("opening threads and drafts never changes the page", async ({ page }) => {
  await page.goto(fixture("doc.html"));
  const before = await bodySnapshot(page);
  await page.evaluate(async () => {
    (window as any).pu = await (window as any).Pipeup.mount({ name: "Sam" });
  });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.locator(".th").click();
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  await page.evaluate(() => getSelection()!.removeAllRanges());
  await page.waitForTimeout(400);
  expect(await bodySnapshot(page)).toBe(before);
});

test("comments survive a framework-style re-render of the page", async ({ page }) => {
  await open(page, "doc.html");
  await seedText(page, "#p2", "second designer", "Why Q4?");
  await page.evaluate(() => {
    const a = document.querySelector("article")!;
    a.innerHTML = a.innerHTML;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = [...(CSS.highlights.get("pipeup-quote") ?? [])][0] as Range | undefined;
        return r?.startContainer.isConnected ? r.toString() : "";
      }),
    )
    .toBe("second designer");
  await expect(page.locator(".th.lost")).toHaveCount(0);
});

test("a comment waiting for the deferred pass never flashes under 'No longer on the page'", async ({
  page,
}) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "targeting a 20% lift in week-one retention", "Is this realistic?");
  await expect(page.locator(".th")).toHaveCount(1);
  await settled(page.locator(".th"));
  const rest = await page.locator(".th").evaluate((el) => (el as HTMLElement).style.transform);
  await page.evaluate(() => {
    const w = window as any;
    w.__lostSeen = false;
    // Sample the thread's transform every frame so any glide toward the column's end shows up.
    w.__seen = new Set<string>();
    const sample = () => {
      const th = document.querySelector("pipeup-root")!.shadowRoot!.querySelector<HTMLElement>(".th");
      if (th) w.__seen.add(getComputedStyle(th).transform);
      w.__raf = requestAnimationFrame(sample);
    };
    sample();
    const layer = document.querySelector("pipeup-root")!.shadowRoot!;
    new MutationObserver(() => {
      if (layer.querySelector(".th.lost")) w.__lostSeen = true;
    }).observe(layer, { subtree: true, attributes: true, childList: true });
    // A slow page: the first pass has no time left for fuzzy matching, so it is deferred.
    const real = performance.now.bind(performance);
    let t = 0;
    performance.now = () => (t += 100);
    w.__restoreClock = () => (performance.now = real);
    const p = document.querySelector("#p1")!;
    p.innerHTML = p.innerHTML.replace("week-one", "week one");
  });
  await page.waitForTimeout(150);
  // While pending, the thread stays on its line: its transform never changed.
  const during = await page.evaluate(() => [...(window as any).__seen]);
  expect(during).toHaveLength(1);
  expect(during[0]).toBe(
    await page.locator(".th").evaluate((el, r) => {
      el.setAttribute("style", `transform:${r};transition:none`);
      const v = getComputedStyle(el).transform;
      el.setAttribute("style", `transform:${r}`);
      return v;
    }, rest),
  );
  await page.evaluate(() => (window as any).__restoreClock());
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get("pipeup-quote")?.size ?? 0), { timeout: 3000 })
    .toBe(1);
  await page.evaluate(() => cancelAnimationFrame((window as any).__raf));
  expect(await page.evaluate(() => (window as any).__lostSeen)).toBe(false);
});

test("a comment that has never been placed stays hidden until its place is found", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await seedText(page, "#p1", "targeting a 20% lift in week-one retention", "Is this realistic?");
  await page.evaluate(async () => {
    const w = window as any;
    await w.pu.unmount();
    const p = document.querySelector("#p1")!;
    p.innerHTML = p.innerHTML.replace("week-one", "week one");
    const real = performance.now.bind(performance);
    let t = 0;
    performance.now = () => (t += 100);
    w.__restoreClock = () => (performance.now = real);
    w.pu = await w.Pipeup.mount({ name: "Sam" });
  });
  await showComments(page);
  const th = page.locator(".th");
  await expect(th).toHaveCount(1);
  await page.waitForTimeout(150);
  expect(
    await th.evaluate((el) => ({ wait: el.classList.contains("wait"), o: getComputedStyle(el).opacity })),
  ).toEqual({
    wait: true,
    o: "0",
  });
  await expect(page.locator(".th.lost")).toHaveCount(0);
  await page.evaluate(() => (window as any).__restoreClock());
  await expect(th).not.toHaveClass(/\bwait\b/);
  await expect.poll(() => th.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(th).not.toHaveClass(/\blost\b/);
});

test("a draft replaced by another fades out instead of vanishing", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await selectWords(page, "#p1", "pricing changes");
  await page.locator(".selbar.show button").click();
  const old = await page.locator(".th:has(.draft)").elementHandle();
  await expect(page.locator(".draft")).toHaveCount(1);
  await selectWords(page, "#p2", "second designer");
  await page.locator(".selbar.show button").click();
  const state = await old!.evaluate((el) => ({
    connected: el.isConnected,
    out: el.classList.contains("out"),
  }));
  expect(state).toEqual({ connected: true, out: true });
  await expect.poll(() => old!.evaluate((el) => el.isConnected)).toBe(false);
});

test("hostile page styles can't break or hide Pipeup's own UI", async ({ page }) => {
  await open(page, "doc.html", { name: "Sam" });
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.addStyleTag({
    content: `* { all: revert !important; color: red !important; font-size: 40px !important; display: block !important }
      pipeup-root { display: none !important; visibility: hidden !important; opacity: 0 !important }`,
  });
  await expect(page.locator(".launch .mode .n.on")).toBeVisible();
  const look = await page
    .locator(".th .tx")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, size: s.fontSize };
    });
  expect(look.color).not.toBe("rgb(255, 0, 0)");
  expect(look.size).toBe("14px");
  // The page's text moved (its own styles), so the thread follows it; the launcher stays put and works.
  await openMenu(page);
  await expect(page.locator(".menu.show .mi")).toHaveCount(5);
  expect(
    await page
      .locator(".menu .mi")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("13px");
});

test("Escape closes an open thread even while the pointer is still on it", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  const th = page.locator(".th", { hasText: "Is 20% realistic?" });
  await th.locator(".tx").first().click();
  await expect(th).toHaveClass(/\bon\b/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".th.on")).toHaveCount(0);
  expect(await th.evaluate((el) => el.matches(":hover"))).toBe(true);
});

test("Escape closes the comment menu and returns focus to its button", async ({ page }) => {
  await open(page, "doc.html");
  await showComments(page);
  await seedText(page, "#p1", "20% lift", "Is 20% realistic?");
  await page.locator(".th .tx").first().click();
  await expect(page.locator(".th.on")).toHaveCount(1);
  await openMenu(page);
  await expect(page.locator(".menu.show")).toBeVisible();
  await page.locator(".menu.show [data-item=name]").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu.show")).toHaveCount(0);
  await expect(page.locator(".launch .mode")).toBeFocused();
  await expect(page.locator(".th.on")).toHaveCount(1);
});
