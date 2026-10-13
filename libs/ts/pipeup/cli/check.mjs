// pipeup check <page.html>: loads a page with and without Pipeup at phone, tablet and desktop widths and reports what
// Pipeup changes or covers, and what the page could do better for it. It uses Playwright (yours; Pipeup depends on none).
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const WIDTHS = [375, 768, 1440];
const SHIFT_PX = 0.5;
/** Requests that load Pipeup or one of its add-ons: blocked for the page as it is without Pipeup. */
const PIPEUP_SCRIPT = /(?:^|\/)pipeup[^/]*\.js(?:\?|$)|\/@pipeup\/|\/pipeup@/i;

async function playwright() {
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      return await import(name);
    } catch {
      // try the next
    }
  }
  throw new Error(
    "pipeup check needs Playwright and a browser: npm i -D playwright && npx playwright install chromium",
  );
}

/** Every visible element's box (without Pipeup's own), in document order, so two loads can be compared. */
const boxes = () =>
  [...document.body.querySelectorAll("*")]
    .filter((e) => e.tagName !== "PIPEUP-ROOT" && !e.closest("pipeup-root"))
    .slice(0, 4000)
    .map((e) => {
      const r = e.getBoundingClientRect();
      const label = e.tagName.toLowerCase() + (e.id ? `#${e.id}` : "");
      return {
        label,
        x: r.x + scrollX,
        y: r.y + scrollY,
        w: r.width,
        h: r.height,
        shown: r.width > 0 && r.height > 0,
      };
    });

/** What is checked once, with Pipeup running at the widest width. */
const inspect = async () => {
  const w = window;
  const out = {
    scripts: 0,
    roots: document.querySelectorAll("pipeup-root").length,
    blocks: 0,
    doc: document.documentElement.hasAttribute("data-pipeup-doc"),
    addons: [],
    appearance: null,
    tabbable: false,
    agents: document.documentElement.getAttribute("data-pipeup-agents") || "",
    viewport: Boolean(document.querySelector('meta[name="viewport"]')),
  };
  out.scripts = [...document.querySelectorAll("script[src]")].filter(
    (s) =>
      /(?:^|\/)pipeup(?:\.min|\.esm)?(?:@[^/]*)?\.js|\/pipeup@[^/]*\//i.test(s.src) &&
      !/@pipeup\//i.test(s.src),
  ).length;
  const marked = (e) => e.closest("[data-pipeup-id]") !== null;
  out.blocks = [...document.querySelectorAll("svg, canvas, img, figure, table, video")].filter(
    (e) => !e.closest("pipeup-root") && !marked(e) && e.getBoundingClientRect().width > 40,
  ).length;
  try {
    const pu = await w.Pipeup.mount();
    out.addons = (w.Pipeup.addons?.() ?? []).map((a) => ({
      id: a.id,
      state: a.state,
      reason: a.reason ?? "",
      says: a.network?.says ?? "",
    }));
    out.appearance = pu.appearance?.() ?? null;
  } catch {
    out.addons = null;
  }
  const control = document.querySelector("pipeup-root")?.shadowRoot?.querySelector(".launch .mode");
  out.tabbable = Boolean(control) && control.tabIndex >= 0;
  return out;
};

/** The control's box and the page's interactive and text boxes it could cover, at the current width. */
const overlaps = () => {
  const root = document.querySelector("pipeup-root");
  const mode = root?.shadowRoot?.querySelector(".launch .mode");
  if (!mode) return { control: null, hits: [] };
  const c = mode.getBoundingClientRect();
  const hit = (r) =>
    r.width > 0 &&
    r.height > 0 &&
    r.left < c.right &&
    r.right > c.left &&
    r.top < c.bottom &&
    r.bottom > c.top;
  const hits = [];
  for (const e of document.body.querySelectorAll("*")) {
    if (e.closest("pipeup-root")) continue;
    const r = e.getBoundingClientRect();
    if (!hit(r)) continue;
    const style = getComputedStyle(e);
    if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
    const interactive = e.matches(
      "a[href], button, input, select, textarea, summary, [role=button], [role=link], [tabindex]:not([tabindex='-1'])",
    );
    const text = !interactive && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (interactive || text)
      hits.push({ what: e.tagName.toLowerCase() + (e.id ? `#${e.id}` : ""), interactive });
  }
  return { control: { x: c.x, y: c.y, w: c.width, h: c.height }, hits: hits.slice(0, 5) };
};

/** Runs the check; resolves to { results: [{ status, what, detail }], ok }. */
export async function check({ page, widths = WIDTHS, log = () => {} }) {
  const url = /^https?:|^file:/i.test(page) ? page : pathToFileURL(resolve(page)).href;
  const { chromium } = await playwright();
  const browser = await chromium.launch();
  const results = [];
  const add = (status, what, detail = "") => results.push({ status, what, detail });
  try {
    for (const width of widths) {
      const without = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
      await without.route("**/*", (route) =>
        PIPEUP_SCRIPT.test(route.request().url()) ? route.abort() : route.continue(),
      );
      await without.goto(url);
      await without.waitForLoadState("load");
      const before = await without.evaluate(boxes);
      await without.context().close();

      const withp = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
      const said = [];
      withp.on("console", (m) => said.push(m.text()));
      await withp.goto(url);
      await withp.waitForLoadState("load");
      let started = await withp.waitForSelector("pipeup-root", { state: "attached", timeout: 3000 }).then(
        () => true,
        () => false,
      );
      // A page that mounts Pipeup itself (data-pipeup-auto="off") is started the way its author would.
      if (!started && (await withp.evaluate(() => typeof window.Pipeup?.mount === "function")))
        started = await withp.evaluate(() =>
          window.Pipeup.mount().then(
            () => true,
            () => false,
          ),
        );
      if (!started) {
        add(
          "fail",
          `Pipeup starts (${width}px)`,
          "no Pipeup appeared on the page: is its script included, and does it need data-pipeup-doc?",
        );
        await withp.context().close();
        continue;
      }
      await withp.waitForTimeout(400);
      const after = await withp.evaluate(boxes);
      const moved = [];
      if (before.length !== after.length)
        moved.push(`the page has ${after.length} elements with Pipeup and ${before.length} without`);
      else
        for (let i = 0; i < before.length; i++) {
          const a = before[i];
          const b = after[i];
          if (
            a.shown &&
            b.shown &&
            Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) >
              SHIFT_PX
          )
            moved.push(
              `${a.label} moved by ${Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)).toFixed(1)}px`,
            );
        }
      if (moved.length)
        add(
          "fail",
          `Pipeup changes nothing on the page (${width}px)`,
          `${moved.length} difference${moved.length === 1 ? "" : "s"}: ${moved.slice(0, 3).join("; ")}`,
        );
      else add("pass", `Pipeup changes nothing on the page (${width}px)`);

      const covered = await withp.evaluate(overlaps);
      const touching = covered.hits.filter((h) => h.interactive);
      if (touching.length)
        add(
          "fail",
          `Pipeup's button covers nothing you use (${width}px)`,
          `it sits over ${touching.map((h) => h.what).join(", ")}`,
        );
      else if (covered.hits.length)
        add(
          "warn",
          `Pipeup's button covers nothing you use (${width}px)`,
          `it sits over text in ${covered.hits.map((h) => h.what).join(", ")}`,
        );
      else add("pass", `Pipeup's button covers nothing you use (${width}px)`);

      if (width === widths[widths.length - 1]) {
        const o = await withp.evaluate(inspect);
        if (o.scripts > 1 || o.roots > 1)
          add(
            "fail",
            "Pipeup is included once",
            `the page loads Pipeup ${Math.max(o.scripts, o.roots)} times: remove the extra script`,
          );
        else add("pass", "Pipeup is included once");
        add(
          o.doc ? "pass" : "warn",
          "The page has a document identity",
          o.doc
            ? ""
            : "no data-pipeup-doc on <html>: copies of this file on other computers won't share comments",
        );
        add(
          o.blocks ? "warn" : "pass",
          "Charts, images and tables have stable names",
          o.blocks
            ? `${o.blocks} without data-pipeup-id: comments on them may lose their place when the page changes`
            : "",
        );
        add(o.tabbable ? "pass" : "fail", "Pipeup's button can be reached with the keyboard");
        add(
          o.viewport ? "pass" : "warn",
          "The page suits phones",
          o.viewport
            ? ""
            : 'no <meta name="viewport" content="width=device-width, initial-scale=1">: phones show the page zoomed out, and Pipeup with it',
        );
        if (o.addons)
          for (const a of o.addons)
            add(a.state === "on" ? "pass" : "warn", `Add-on ${a.id} is ${a.state}`, a.reason || a.says);
        if (o.appearance) {
          const e = o.appearance.effects;
          add(
            e.length || o.appearance.ratio < 3 ? "warn" : "pass",
            `Pipeup looks right on this page (${o.appearance.look} look, from ${o.appearance.source})`,
            e.length
              ? `the page's styles on <html> change it and can't be undone from inside: ${e.join("; ")}`
              : "",
          );
        }
        if (o.agents && !(o.addons ?? []).some((a) => a.id === "agents"))
          add(
            "warn",
            "A listed agent can answer",
            "the page lists an agent (data-pipeup-agents) but has no agents add-on",
          );
        const unreadable = said.find((t) => /couldn't be read|could not be read/i.test(t));
        add(unreadable ? "warn" : "pass", "Saved comments can be read", unreadable ?? "");
      }
      await withp.context().close();
    }
  } finally {
    await browser.close();
  }
  log(results);
  return { results, ok: !results.some((r) => r.status === "fail") };
}

/** The report as a table of words for a person. */
export function table(results) {
  const mark = { pass: "pass", warn: "WARN", fail: "FAIL" };
  return results
    .map((r) => `${mark[r.status].padEnd(5)} ${r.what}${r.detail ? `\n      ${r.detail}` : ""}`)
    .join("\n");
}
