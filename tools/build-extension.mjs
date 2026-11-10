#!/usr/bin/env node
// Packs the browser extension from apps/extension/src and the release's own Pipeup file, unchanged, once per browser,
// each with a zip beside it.
//
//   node tools/build-extension.mjs          needs libs/ts/pipeup/dist (npm run build in libs/ts/pipeup)
//   node tools/build-extension.mjs --test   also dist/chromium-test and dist/firefox-test, for the tests only: they may
//                                           reach any page without a press on the toolbar button, which a test can't
//                                           make. Never published.
//   node tools/build-extension.mjs --safari also builds Safari's app (a Mac with Xcode)
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;
const src = `${root}apps/extension/src`;
const ADDONS = ["emoji", "voice", "share", "live", "github", "identity"];
const pipeup = `${root}libs/ts/pipeup/dist/pipeup.esm.js`;
if (!existsSync(pipeup)) {
  console.error("build-extension: build Pipeup first (npm run build in libs/ts/pipeup)");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(`${root}libs/ts/pipeup/package.json`, "utf8"));
// Stores take only numbers: a pre-release (0.10.0-beta.1) can't be packed for them.
if (!/^\d+\.\d+\.\d+$/.test(version))
  console.warn(`build-extension: ${version} is a pre-release; the stores won't take it`);

// One folder per browser, from the same files:
//
//   dist/chromium  Chrome, Edge, Brave and the other Chromium browsers: load unpacked
//   dist/firefox   Firefox: about:debugging → This Firefox → Load Temporary Add-on → its manifest.json
//   dist/safari    Safari's web extension, wrapped (with --safari, on a Mac with Xcode) in dist/safari-app, an app
//                  that brings it into Safari
const manifest = JSON.parse(readFileSync(`${src}/manifest.json`, "utf8"));
manifest.version = version.replace(/-.*/, "");

/** What each browser's manifest keeps of the source one, which serves them all: each warns about the others' keys. */
const TARGETS = {
  chromium(m) {
    delete m.sidebar_action;
    delete m.browser_specific_settings;
    m.version_name = version;
    m.background = { service_worker: m.background.service_worker, type: m.background.type };
    return m;
  },
  firefox(m) {
    delete m.side_panel;
    delete m.minimum_chrome_version;
    m.permissions = m.permissions.filter((p) => p !== "sidePanel");
    m.background = { scripts: m.background.scripts, type: m.background.type };
    // Firefox's add-ons site asks what an extension collects: nothing.
    m.browser_specific_settings.gecko.data_collection_permissions = { required: ["none"] };
    return m;
  },
  safari(m) {
    // No panel beside the page, and no reaching programs on the computer except the app it comes in (browser.js).
    delete m.side_panel;
    delete m.sidebar_action;
    delete m.minimum_chrome_version;
    m.permissions = m.permissions.filter((p) => p !== "sidePanel" && p !== "nativeMessaging");
    m.browser_specific_settings = { safari: { strict_min_version: "17.0" } };
    // Safari's background takes no "type" (the background script imports nothing), and opens settings where it likes.
    m.background = { service_worker: m.background.service_worker };
    delete m.options_ui.open_in_tab;
    return m;
  },
};

const sri = (b) => `sha384-${createHash("sha384").update(b).digest("base64")}`;
let inside = "";
const zips = [];
for (const [target, shape] of Object.entries(TARGETS)) {
  const dir = `${root}apps/extension/dist/${target}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(`${dir}/pipeup`, { recursive: true });
  mkdirSync(`${dir}/icons`, { recursive: true });
  cpSync(src, dir, { recursive: true });
  cpSync(pipeup, `${dir}/pipeup/pipeup.esm.js`);
  // The add-ons the reviewer can turn on, each its release file unchanged (build them with npm run build in libs/ts/addons).
  mkdirSync(`${dir}/addons`, { recursive: true });
  for (const id of ADDONS) {
    const file = `${root}libs/ts/addons/${id}/dist/${id}.esm.js`;
    if (existsSync(file)) cpSync(file, `${dir}/addons/${id}.esm.js`);
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(shape(structuredClone(manifest)), null, 2) + "\n");
  for (const size of [16, 32, 48, 128]) writeFileSync(`${dir}/icons/${size}.png`, icon(size));
  // The file inside is the release's file, byte for byte: the same hash as on npm.
  inside = sri(readFileSync(`${dir}/pipeup/pipeup.esm.js`));
  if (inside !== sri(readFileSync(pipeup)))
    throw new Error("build-extension: Pipeup's file changed while packing");
  if (target === "safari") continue;
  const zip = `${root}apps/extension/dist/pipeup-extension-${version}-${target}.zip`;
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: dir });
  zips.push(zip);
}
for (const id of ADDONS)
  if (!existsSync(`${root}libs/ts/addons/${id}/dist/${id}.esm.js`))
    console.warn(`build-extension: the ${id} add-on isn't built; the extension is packed without it`);

if (process.argv.includes("--test")) {
  // Every page: the tests can't press the toolbar button, which is what lets the extension see a tab (and take a picture).
  for (const target of ["chromium", "firefox"]) {
    const test = `${root}apps/extension/dist/${target}-test`;
    rmSync(test, { recursive: true, force: true });
    cpSync(`${root}apps/extension/dist/${target}`, test, { recursive: true });
    const m = JSON.parse(readFileSync(`${test}/manifest.json`, "utf8"));
    writeFileSync(`${test}/manifest.json`, JSON.stringify({ ...m, host_permissions: ["<all_urls>"] }, null, 2) + "\n");
  }
}

let app = "";
if (process.argv.includes("--safari")) app = safariApp();

console.log(`Pipeup extension ${version}: ${root}apps/extension/dist`);
console.log(`  pipeup/pipeup.esm.js ${inside}`);
for (const z of zips) console.log(`  ${z}`);
if (app) console.log(`  ${app}`);

/**
 * Safari takes web extensions inside a Mac app. Apple's converter makes the Xcode project around dist/safari, and
 * xcodebuild builds it, signed for this Mac only: Safari runs it once Develop → Allow Unsigned Extensions is on.
 */
function safariApp() {
  if (process.platform !== "darwin") throw new Error("build-extension: Safari's app is built on a Mac");
  const project = `${root}apps/extension/dist/safari-app`;
  rmSync(project, { recursive: true, force: true });
  execFileSync(
    "xcrun",
    [
      "safari-web-extension-converter",
      `${root}apps/extension/dist/safari`,
      "--project-location",
      project,
      "--app-name",
      "Pipeup",
      "--bundle-identifier",
      "ai.pipeup.Pipeup",
      "--swift",
      "--macos-only",
      "--no-open",
      "--no-prompt",
      "--force",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync(
    "xcodebuild",
    [
      "-project",
      `${project}/Pipeup/Pipeup.xcodeproj`,
      "-scheme",
      "Pipeup",
      "-configuration",
      "Debug",
      "-derivedDataPath",
      `${project}/build`,
      "CODE_SIGN_IDENTITY=-",
      "CODE_SIGN_STYLE=Manual",
      "DEVELOPMENT_TEAM=",
      `MARKETING_VERSION=${manifest.version}`,
      "build",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  return `${project}/build/Build/Products/Debug/Pipeup.app`;
}

/**
 * The toolbar icon: Pipeup's own comment glyph (the outlined bubble with a plus, `comment` in src/ui/icons.ts), white on
 * the accent in a rounded square. Drawn here from the glyph's geometry, with four samples a pixel each way, so the
 * extension needs no image tools.
 */
function icon(n) {
  const [r, g, b] = [0x53, 0x4a, 0xb7];
  const px = Buffer.alloc(n * n * 4);
  const S = 4;
  // The glyph's 24-unit box, fitted inside the tile with a margin; strokes a little heavier when the icon is small.
  const margin = 0.14;
  const unit = (1 - 2 * margin) / 24;
  const half = (n <= 16 ? 2.6 : n <= 32 ? 2.3 : 2) / 2;
  const [cx, cy, R] = [12.5, 11.5, 8];
  // The circle's gap where the tail leaves it: between the tail's two ends, the short way round.
  const gap = [Math.atan2(18.6 - cy, 8.8 - cx), Math.atan2(15.4 - cy, 5.2 - cx)];
  const segments = [
    [8.8, 18.6, 4, 19.8],
    [4, 19.8, 5.2, 15.4],
    [12.3, 8.2, 12.3, 14.8],
    [9, 11.5, 15.6, 11.5],
  ];
  const toSegment = (x, y, [x1, y1, x2, y2]) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };
  const inGlyph = (x, y) => {
    const a = Math.atan2(y - cy, x - cx);
    if (Math.abs(Math.hypot(x - cx, y - cy) - R) <= half && !(a > gap[0] && a < gap[1])) return true;
    return segments.some((sg) => toSegment(x, y, sg) <= half);
  };
  const inTile = (x, y) => {
    const k = 0.22;
    const qx = Math.min(Math.max(x, k), 1 - k);
    const qy = Math.min(Math.max(y, k), 1 - k);
    return (x - qx) ** 2 + (y - qy) ** 2 <= k * k;
  };
  for (let py = 0; py < n; py++)
    for (let qx = 0; qx < n; qx++) {
      let tile = 0;
      let white = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const x = (qx + (sx + 0.5) / S) / n;
          const y = (py + (sy + 0.5) / S) / n;
          if (!inTile(x, y)) continue;
          tile++;
          if (inGlyph((x - margin) / unit, (y - margin) / unit)) white++;
        }
      const w = tile ? white / tile : 0;
      const i = (py * n + qx) * 4;
      px[i] = Math.round(r + (255 - r) * w);
      px[i + 1] = Math.round(g + (255 - g) * w);
      px[i + 2] = Math.round(b + (255 - b) * w);
      px[i + 3] = Math.round((tile / (S * S)) * 255);
    }
  return png(n, px);
}

function png(n, rgba) {
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) rgba.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
