#!/usr/bin/env node
// Packs the browser extension from apps/extension/src and the release's own Pipeup file, unchanged, into
// apps/extension/dist/chromium (load it unpacked in Chrome or Edge) and a zip beside it.
//
//   node tools/build-extension.mjs          needs libs/ts/pipeup/dist (npm run build in libs/ts/pipeup)
//   node tools/build-extension.mjs --test   also apps/extension/dist/chromium-test, for the tests only: it may reach
//                                           the test pages' server without a press on the toolbar button, which a
//                                           test can't make. Never published.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;
const src = `${root}apps/extension/src`;
const out = `${root}apps/extension/dist/chromium`;
const pipeup = `${root}libs/ts/pipeup/dist/pipeup.esm.js`;
if (!existsSync(pipeup)) {
  console.error("build-extension: build Pipeup first (npm run build in libs/ts/pipeup)");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(`${root}libs/ts/pipeup/package.json`, "utf8"));
// Stores take only numbers: a pre-release (0.10.0-beta.1) can't be packed for them.
if (!/^\d+\.\d+\.\d+$/.test(version)) console.warn(`build-extension: ${version} is a pre-release; the stores won't take it`);

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/pipeup`, { recursive: true });
mkdirSync(`${out}/icons`, { recursive: true });
cpSync(src, out, { recursive: true });
cpSync(pipeup, `${out}/pipeup/pipeup.esm.js`);
const manifest = JSON.parse(readFileSync(`${src}/manifest.json`, "utf8"));
manifest.version = version.replace(/-.*/, "");
manifest.version_name = version;
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
for (const size of [16, 32, 48, 128]) writeFileSync(`${out}/icons/${size}.png`, icon(size));

// The file inside is the release's file, byte for byte: the same hash as on npm.
const sri = (b) => `sha384-${createHash("sha384").update(b).digest("base64")}`;
const inside = sri(readFileSync(`${out}/pipeup/pipeup.esm.js`));
if (inside !== sri(readFileSync(pipeup))) throw new Error("build-extension: Pipeup's file changed while packing");
const zip = `${root}apps/extension/dist/pipeup-extension-${version}-chromium.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "."], { cwd: out });
if (process.argv.includes("--test")) {
  const test = `${root}apps/extension/dist/chromium-test`;
  rmSync(test, { recursive: true, force: true });
  cpSync(out, test, { recursive: true });
  writeFileSync(
    `${test}/manifest.json`,
    JSON.stringify({ ...manifest, host_permissions: ["http://localhost:4931/*"] }, null, 2) + "\n",
  );
}
console.log(`Pipeup extension ${version}: ${out}`);
console.log(`  pipeup/pipeup.esm.js ${inside}`);
console.log(`  ${zip}`);

/**
 * The toolbar icon: Pipeup's comment bubble with a plus, white on the accent, in a rounded square. Drawn here, with
 * four samples a pixel each way, so the extension needs no image tools.
 */
function icon(n) {
  const [r, g, b] = [0x53, 0x4a, 0xb7];
  const px = Buffer.alloc(n * n * 4);
  const S = 4;
  const inRounded = (x, y) => {
    const k = 0.22;
    const cx = Math.min(Math.max(x, k), 1 - k);
    const cy = Math.min(Math.max(y, k), 1 - k);
    return (x - cx) ** 2 + (y - cy) ** 2 <= k * k;
  };
  const inBubble = (x, y) => {
    const d = (x - 0.52) ** 2 + (y - 0.47) ** 2;
    if (d <= 0.29 ** 2) return true;
    // The tail, down and to the left.
    return x >= 0.2 && x <= 0.42 && y >= 0.6 && y <= 0.82 && x - 0.2 >= (y - 0.6) * 0.0 && 0.82 - y >= (x - 0.2) * 0.9;
  };
  const inPlus = (x, y) =>
    (Math.abs(x - 0.52) <= 0.045 && Math.abs(y - 0.47) <= 0.15) || (Math.abs(y - 0.47) <= 0.045 && Math.abs(x - 0.52) <= 0.15);
  for (let py = 0; py < n; py++)
    for (let qx = 0; qx < n; qx++) {
      let bg = 0;
      let white = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const x = (qx + (sx + 0.5) / S) / n;
          const y = (py + (sy + 0.5) / S) / n;
          if (!inRounded(x, y)) continue;
          bg++;
          if (inBubble(x, y) && !inPlus(x, y)) white++;
        }
      const a = bg / (S * S);
      const w = bg ? white / bg : 0;
      const i = (py * n + qx) * 4;
      px[i] = Math.round(r + (255 - r) * w);
      px[i + 1] = Math.round(g + (255 - g) * w);
      px[i + 2] = Math.round(b + (255 - b) * w);
      px[i + 3] = Math.round(a * 255);
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
