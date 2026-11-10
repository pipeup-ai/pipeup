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
import { INK, listed, toolbar } from "./extension-icons.mjs";

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
    m.background = {
      service_worker: m.background.service_worker,
      type: m.background.type,
    };
    return m;
  },
  firefox(m) {
    delete m.side_panel;
    delete m.minimum_chrome_version;
    m.permissions = m.permissions.filter((p) => p !== "sidePanel");
    m.background = { scripts: m.background.scripts, type: m.background.type };
    // Firefox picks the toolbar bubble for its own theme (light icons for dark themes), before any page has said.
    m.action.theme_icons = [16, 32].map((size) => ({
      light: `icons/toolbar-dark-${size}.png`,
      dark: `icons/toolbar-light-${size}.png`,
      size,
    }));
    // Firefox's add-ons site asks what an extension collects: nothing.
    m.browser_specific_settings.gecko.data_collection_permissions = {
      required: ["none"],
    };
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
    // One black bubble: Safari takes a grayscale toolbar icon as a template and tints it for its toolbar.
    m.action.default_icon = Object.fromEntries([16, 19, 32, 38].map((s) => [s, `icons/toolbar-${s}.png`]));
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
  for (const size of [16, 32, 48, 128]) writeFileSync(`${dir}/icons/${size}.png`, listed(size));
  // The toolbar button: the bubble alone, dark for light toolbars and light for dark ones (Safari: one template).
  for (const size of [16, 19, 32, 38])
    if (target === "safari") writeFileSync(`${dir}/icons/toolbar-${size}.png`, toolbar(size, INK.template));
    else
      for (const look of ["light", "dark"])
        writeFileSync(`${dir}/icons/toolbar-${look}-${size}.png`, toolbar(size, INK[look]));
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
    writeFileSync(
      `${test}/manifest.json`,
      JSON.stringify({ ...m, host_permissions: ["<all_urls>"] }, null, 2) + "\n",
    );
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
