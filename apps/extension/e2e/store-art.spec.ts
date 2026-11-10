// The stores' screenshots and art, made from the extension itself on the site's sample page (apps/site/
// extension-test.html): run with `npm run store-art` (STORE_ART=1). Written to dist/store/<store>/. Never part of the
// check. Light look, the name Sam, fictional pages only. Scenes a script can't reach (the browser's own right-click menu,
// Firefox's and Safari's own prompts, Safari's window) are taken by hand.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test, tabOf } from "./fixtures";
import { appIcon, listed } from "../../../tools/extension-icons.mjs";

test.skip(!process.env.STORE_ART, "makes the stores' pictures: STORE_ART=1 npm run store-art");
test.setTimeout(180_000);

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${repo}apps/extension/dist/store`;
const SAMPLE = "https://lumen.example/launch-plan";
const ADDRESS = "lumen.example/launch-plan";

/** Each store's screenshot size: the page as drawn (CSS pixels) and the scale it is saved at. */
const STORES = {
  chrome: { w: 1280, h: 800, scale: 1 },
  edge: { w: 1280, h: 800, scale: 1 },
  firefox: { w: 1280, h: 960, scale: 1.25 },
  safari: { w: 1440, h: 900, scale: 2 },
} as const;

interface Scene {
  name: string;
  caption: string;
  page: Buffer;
  /** Drawn over the page under the toolbar button (the toolbar menu), or beside it (the side panel). */
  popup?: Buffer;
  panel?: Buffer;
  /** A page of the extension's own, in place of the web page (its settings). */
  address?: string;
  /** An app's window: no address bar. */
  bare?: boolean;
  not?: (keyof typeof STORES)[];
}

/** Draws `page` at `w`×`h`, `f` device pixels to each (sharp captures for the Mac's 2× screenshots). */
async function size(page: Page, w: number, h: number, f = 2): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: h,
    deviceScaleFactor: f,
    mobile: false,
  });
}

const b64 = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

/** One framed screenshot: a caption, then a plain window holding what was captured. */
function frame(s: Scene, store: keyof typeof STORES): string {
  const { w, h } = STORES[store];
  const icon = b64(listed(32));
  const side = s.panel ? `<img class="panel" src="${b64(s.panel)}" alt="">` : "";
  const pop = s.popup ? `<img class="popup" src="${b64(s.popup)}" alt="">` : "";
  return `<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; width: ${w}px; height: ${h}px; background: #f3f1fb; font: 15px/1.4 -apple-system, "Segoe UI", sans-serif; color: #1d1b2e; overflow: hidden; display: flex; flex-direction: column; }
    h1 { margin: 0; padding: ${Math.round(h * 0.045)}px 48px ${Math.round(h * 0.03)}px; font-size: ${Math.round(w / 40)}px; font-weight: 600; letter-spacing: -0.01em; text-align: center; }
    .win { flex: 1; margin: 0 48px; border-radius: 12px 12px 0 0; background: #fff; box-shadow: 0 10px 40px rgba(40, 30, 90, 0.16); display: flex; flex-direction: column; overflow: hidden; position: relative; }
    .bar { height: 44px; flex: none; background: #f7f7f8; border-bottom: 1px solid #e4e3ea; display: flex; align-items: center; gap: 8px; padding: 0 14px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #dcdbe2; }
    .url { margin-left: 18px; flex: 1; height: 28px; border-radius: 8px; background: #fff; border: 1px solid #e4e3ea; display: flex; align-items: center; padding: 0 12px; color: #66646f; font-size: 13px; }
    .btn { width: 30px; height: 30px; border-radius: 7px; display: grid; place-items: center; background: ${s.popup ? "#e9e6fb" : "transparent"}; }
    .btn img { width: 18px; height: 18px; }
    .body { flex: 1; display: flex; min-height: 0; }
    .page { flex: 1; min-width: 0; object-fit: cover; object-position: top left; width: 100%; height: 100%; }
    .panel { height: 100%; width: auto; flex: none; border-left: 1px solid #e4e3ea; }
    .popup { position: absolute; top: 48px; right: 10px; width: 340px; border-radius: 10px; box-shadow: 0 12px 36px rgba(30, 20, 70, 0.22); border: 1px solid #e4e3ea; }
  </style></head><body>
    <h1>${s.caption}</h1>
    <div class="win">
      <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        ${s.bare ? "" : `<span class="url">${s.address ?? ADDRESS}</span><span class="btn"><img src="${icon}" alt=""></span>`}</div>
      <div class="body"><img class="page" src="${b64(s.page)}" alt="">${side}</div>
      ${pop}
    </div>
  </body></html>`;
}

async function shoot(page: Page, scenes: Scene[]): Promise<void> {
  for (const [store, dims] of Object.entries(STORES) as [
    keyof typeof STORES,
    (typeof STORES)[keyof typeof STORES],
  ][]) {
    mkdirSync(`${out}/${store}`, { recursive: true });
    await size(page, dims.w, dims.h, dims.scale);
    let n = 0;
    for (const s of scenes) {
      if (s.not?.includes(store)) continue;
      await page.setContent(frame(s, store));
      await page.waitForLoadState("load");
      const shot = await page.screenshot({ type: "jpeg", quality: 92, scale: "device" });
      writeFileSync(`${out}/${store}/${++n}-${s.name}.jpg`, shot);
    }
  }
}

test("the stores' screenshots and art", async ({ context, worker, id }) => {
  const sample = readFileSync(`${repo}apps/site/extension-test.html`, "utf8");
  await context.route(SAMPLE, (r) => r.fulfill({ contentType: "text/html", body: sample }));
  // Sam, who has written before.
  await worker.evaluate(async () => {
    const seed = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await chrome.storage.local.set({ profile: { seed, name: "Sam" } });
  });

  const page = await context.newPage();
  await size(page, 1180, 700);
  await page.goto(SAMPLE);
  const tab = await tabOf(worker, page);
  const popup = await context.newPage();
  await size(popup, 340, 560);
  await popup.goto(`chrome-extension://${id}/popup.html?tab=${tab}`);
  await popup.getByRole("button", { name: "Comment on this page" }).click();
  await expect(page.locator("pipeup-root")).toHaveCount(1);
  await page.bringToFront();

  const write = async (selector: string, words: string, send = true) => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const at = (await page.locator(selector).boundingBox())!;
    await page.mouse.click(at.x + 40, at.y + Math.min(at.height / 2, 30));
    await expect(page.frameLocator(".draft .line iframe").locator(".box")).toBeFocused();
    await page.keyboard.type(words);
    if (send) {
      await page.keyboard.press("Enter");
      await expect(page.locator(".pop.show .draft")).toHaveCount(0);
    }
  };
  await write("#p1", "Is the beta open to everyone, or only Ada's team?");
  await write("figure", "Can the chart start at zero?");
  await write("#p3", "Same day works if Lee has the guide ready.");
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(5, 5);
  await write("#p2", "Should this say which renewal?", false);
  await page.waitForTimeout(600);
  const commenting = await page.screenshot();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop.show .draft")).toHaveCount(0);

  // A thread open on the page, with a reply.
  await page.keyboard.press("Escape");
  await page.locator(".bub").first().click();
  const reply = page.frameLocator(".pop.show .rbox iframe").locator(".box");
  await reply.click();
  await page.keyboard.type("Ada's team first, then everyone in May.");
  await page.keyboard.press("Enter");
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  const thread = await page.screenshot();
  await page.keyboard.press("Escape");

  // The toolbar menu, with Copy comments open.
  await popup.reload();
  await popup.getByRole("button", { name: /^Copy comments/ }).click();
  await popup.waitForTimeout(500);
  const menu = await popup.screenshot({ fullPage: true });

  // The side panel beside the page.
  const side = await context.newPage();
  await size(side, 380, 700);
  await side.goto(`chrome-extension://${id}/panel.html?tab=${tab}`);
  await expect(side.locator(".card").first()).toBeVisible();
  await side.waitForTimeout(500);
  const panel = await side.screenshot();
  await page.bringToFront();
  await page.waitForTimeout(300);
  const plain = await page.screenshot();
  // Beside the side panel the page is narrower, as in the browser.
  await size(page, 820, 700);
  await page.waitForTimeout(400);
  const narrow = await page.screenshot();
  await size(page, 1180, 700);

  // The settings: every page commented on, and the add-ons.
  const settings = await context.newPage();
  await size(settings, 1180, 700);
  await settings.goto(`chrome-extension://${id}/comments.html`);
  await settings.evaluate(() => void (document.body.style.zoom = "0.72"));
  await settings.waitForTimeout(500);
  const options = await settings.screenshot();

  // The Mac app's window (Safari's Pipeup comes in it).
  const app = await context.newPage();
  await size(app, 1180, 700);
  await app.route("http://localhost:4931/app/**", (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    if (name === "Icon.png") return r.fulfill({ contentType: "image/png", body: appIcon(192) });
    const file = `${repo}apps/extension/safari/${name}`;
    return r.fulfill({
      contentType: name.endsWith(".css")
        ? "text/css"
        : name.endsWith(".js")
          ? "text/javascript"
          : "text/html",
      body: readFileSync(file),
    });
  });
  await app.goto("http://localhost:4931/app/Base.lproj/Main.html");
  await app.evaluate(() => (window as unknown as { show(a: boolean, b: boolean): void }).show(true, true));
  const appWindow = await app.screenshot();

  const scenes: Scene[] = [
    { name: "comment", caption: "Point at words, a picture or a block, and write", page: commenting },
    { name: "thread", caption: "Read, reply and resolve, right on the page", page: thread },
    {
      name: "side-panel",
      caption: "Every comment on the page, beside the page",
      page: narrow,
      panel,
      not: ["safari"],
    },
    { name: "menu", caption: "Copy, save or send the comments to whoever asked", page: plain, popup: menu },
    {
      name: "settings",
      caption: "Every page you've commented on, and the add-ons",
      page: options,
      address: "Pipeup · Comments you've made",
    },
    {
      name: "mac-app",
      caption: "Turn Pipeup on in Safari Settings",
      page: appWindow,
      bare: true,
      not: ["chrome", "edge", "firefox"],
    },
  ];
  const art = await context.newPage();
  await shoot(art, scenes);

  // Art: Chrome's small promotional tile, Edge's logo, and the Mac app's icon at full size.
  mkdirSync(`${out}/art`, { recursive: true });
  await size(art, 440, 280, 1);
  await art.setContent(`<!doctype html><body style="margin:0;box-sizing:border-box;width:440px;height:280px;background:#f3f1fb;display:flex;align-items:center;gap:22px;padding:0 36px;font:600 30px/1.15 -apple-system,'Segoe UI',sans-serif;color:#1d1b2e">
    <img src="${b64(listed(128))}" width="96" height="96" alt=""><div style="flex:1;min-width:0">Pipeup<div style="font-weight:400;font-size:17px;color:#55536a;margin-top:8px">Comment on any web page, and pass the comments on.</div></div></body>`);
  writeFileSync(
    `${out}/art/chrome-small-tile-440x280.jpg`,
    await art.screenshot({ type: "jpeg", quality: 95 }),
  );
  writeFileSync(`${out}/art/edge-logo-300x300.png`, listed(300));
  writeFileSync(`${out}/art/store-icon-128.png`, listed(128));
  writeFileSync(`${out}/art/mac-app-icon-1024.png`, appIcon(1024));
});
