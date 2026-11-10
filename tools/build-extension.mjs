#!/usr/bin/env node
// Packs the browser extension from apps/extension/src and the release's own Pipeup file, unchanged, once per browser,
// each with a zip beside it.
//
//   node tools/build-extension.mjs          needs libs/ts/pipeup/dist (npm run build in libs/ts/pipeup)
//   node tools/build-extension.mjs --test   also dist/chromium-test and dist/firefox-test, for the tests only: they may
//                                           reach any page without a press on the toolbar button, which a test can't
//                                           make. Never published.
//   node tools/build-extension.mjs --safari also builds Safari's app (a Mac with Xcode), for this Mac only
//   APPLE_TEAM_ID=… node tools/build-extension.mjs --safari-release
//                                           archives Safari's app for the Mac App Store, signed by that team
//                                           (dist/Pipeup.xcarchive; upload it from Xcode's Organizer)
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { appIcon, INK, listed, toolbar } from "./extension-icons.mjs";

const root = new URL("..", import.meta.url).pathname;
const src = `${root}apps/extension/src`;
const ADDONS = ["emoji", "voice", "share", "live", "github", "identity"];
/**
 * What each browser's package holds beyond the manifest (build.json): the add-ons that work there, and whether it takes
 * pictures of where comments were made. Firefox can't turn speech into text, so no Voice; Safari leaves out Share and
 * Live (they show other people's comments, which Apple's store requires ways to report and block for) and pictures
 * (it has no side panel to show them in).
 */
const PACKAGE = {
  chromium: { addons: ADDONS, pictures: true },
  firefox: { addons: ADDONS.filter((a) => a !== "voice"), pictures: true },
  safari: { addons: ADDONS.filter((a) => a !== "share" && a !== "live"), pictures: false },
};
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
    // Firefox's add-ons site asks what an extension sends: nothing on its own; Share, Live, Save to GitHub and Send
    // to my agent send what the reviewer writes, once the reviewer agrees (browser.js agreeToSend, from Firefox 140).
    m.browser_specific_settings.gecko.data_collection_permissions = {
      required: ["none"],
      optional: ["websiteContent", "browsingActivity", "personalCommunications", "personallyIdentifyingInfo"],
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

const emojibase = `${root}libs/ts/addons/node_modules/emojibase-data`;
if (!existsSync(`${emojibase}/LICENSE`))
  throw new Error("build-extension: emojibase-data's licence is missing (npm ci in libs/ts/addons)");
const notices = [
  "Pipeup for browsers includes the following third-party material.",
  "",
  `emojibase-data ${JSON.parse(readFileSync(`${emojibase}/package.json`, "utf8")).version}: the emoji names, groups and search words in addons/emoji.esm.js`,
  "https://github.com/milesj/emojibase",
  "",
  readFileSync(`${emojibase}/LICENSE`, "utf8").trim(),
  "",
].join("\n");

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
  for (const id of PACKAGE[target].addons) {
    const file = `${root}libs/ts/addons/${id}/dist/${id}.esm.js`;
    if (!existsSync(file))
      throw new Error(`build-extension: the ${id} add-on isn't built (npm run build in libs/ts/addons)`);
    cpSync(file, `${dir}/addons/${id}.esm.js`);
  }
  writeFileSync(`${dir}/build.json`, JSON.stringify(PACKAGE[target]) + "\n");
  // The licences: Pipeup's, and the emoji table's (Emoji's names and groups come from emojibase-data, MIT), which the
  // packed add-on carries with no notice of its own.
  cpSync(`${root}LICENSE`, `${dir}/LICENSE`);
  writeFileSync(`${dir}/THIRD-PARTY-NOTICES.txt`, notices);
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
    // The tests reach into Pipeup's UI, which the published build keeps in a closed shadow root.
    const start = readFileSync(`${test}/start.js`, "utf8");
    if (!start.includes("const closed = true;")) throw new Error("build-extension: start.js has no `closed` switch");
    writeFileSync(`${test}/start.js`, start.replace("const closed = true;", "const closed = false;"));
  }
}

let app = "";
if (process.argv.includes("--safari-release")) app = safariApp(true);
else if (process.argv.includes("--safari")) app = safariApp(false);

console.log(`Pipeup extension ${version}: ${root}apps/extension/dist`);
console.log(`  pipeup/pipeup.esm.js ${inside}`);
for (const z of zips) console.log(`  ${z}`);
if (app) console.log(`  ${app}`);

/**
 * Safari takes web extensions inside a Mac app. Apple's converter makes the Xcode project around dist/safari, and
 * xcodebuild builds it, signed for this Mac only: Safari runs it once Develop → Allow Unsigned Extensions is on.
 */
function safariApp(release) {
  if (process.platform !== "darwin") throw new Error("build-extension: Safari's app is built on a Mac");
  const team = process.env.APPLE_TEAM_ID;
  if (release && !team) throw new Error("build-extension: --safari-release needs APPLE_TEAM_ID (the developer team)");
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
  // The app's own window and icon, kept in apps/extension/safari, over the converter's stock ones.
  const app = `${project}/Pipeup/Pipeup`;
  const ours = `${root}apps/extension/safari`;
  cpSync(`${ours}/Main.html`, `${app}/Resources/Base.lproj/Main.html`);
  for (const f of ["Style.css", "Script.js"]) cpSync(`${ours}/${f}`, `${app}/Resources/${f}`);
  cpSync(`${ours}/ViewController.swift`, `${app}/ViewController.swift`);
  writeFileSync(`${app}/Resources/Icon.png`, appIcon(192));
  // The window fits the page: the converter's is 425 × 325, which cuts off the steps and the links.
  const board = `${app}/Base.lproj/Main.storyboard`;
  writeFileSync(board, readFileSync(board, "utf8").replace(/width="425" height="325"/g, 'width="480" height="640"'));
  for (const size of [16, 32, 128, 256, 512])
    for (const k of [1, 2]) writeFileSync(`${app}/Assets.xcassets/AppIcon.appiconset/mac-icon-${size}@${k}x.png`, appIcon(size * k));
  // What the store reads from the project: the version and build, the Mac it needs (Safari 17 runs on macOS 12 and
  // later), the category and copyright. The app keeps its outgoing-network entitlement: a sandboxed app's web view
  // shows nothing without it, even its own page (measured: a blank window).
  const pbx = `${project}/Pipeup/Pipeup.xcodeproj/project.pbxproj`;
  const build = process.env.PIPEUP_BUILD_NUMBER ?? "1";
  writeFileSync(
    pbx,
    readFileSync(pbx, "utf8")
      .replace(/MACOSX_DEPLOYMENT_TARGET = [\d.]+;/g, "MACOSX_DEPLOYMENT_TARGET = 12.0;")
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${manifest.version};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
      .replace(
        /INFOPLIST_KEY_NSHumanReadableCopyright = "";/g,
        'INFOPLIST_KEY_NSHumanReadableCopyright = "Copyright © 2026 Pipeup contributors. MIT licence.";',
      )
      .replace(
        /(\t+)INFOPLIST_KEY_CFBundleDisplayName = Pipeup;/g,
        '$1INFOPLIST_KEY_CFBundleDisplayName = Pipeup;\n$1INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.productivity";',
      ),
  );
  const xcode = (args) => execFileSync("xcodebuild", args, { stdio: ["ignore", "ignore", "inherit"] });
  const common = ["-project", `${project}/Pipeup/Pipeup.xcodeproj`, "-scheme", "Pipeup"];
  if (release) {
    const archive = `${root}apps/extension/dist/Pipeup.xcarchive`;
    rmSync(archive, { recursive: true, force: true });
    xcode([
      ...common,
      "-configuration",
      "Release",
      "-archivePath",
      archive,
      `DEVELOPMENT_TEAM=${team}`,
      "CODE_SIGN_STYLE=Automatic",
      "-allowProvisioningUpdates",
      "archive",
    ]);
    return archive;
  }
  xcode([
    ...common,
    "-configuration",
    "Debug",
    "-derivedDataPath",
    `${project}/build`,
    "CODE_SIGN_IDENTITY=-",
    "CODE_SIGN_STYLE=Manual",
    "DEVELOPMENT_TEAM=",
    "build",
  ]);
  return `${project}/build/Build/Products/Debug/Pipeup.app`;
}
