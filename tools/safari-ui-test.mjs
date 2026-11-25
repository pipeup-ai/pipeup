#!/usr/bin/env node
// Drives Safari with Pipeup's extension in it, with Apple's UI testing (apps/extension/safari/ui-tests), and keeps a
// screenshot of every step. Design note: docs/design/safari-ui-tests.md.
//
//   node tools/safari-ui-test.mjs        needs: the app installed (npm run safari-install) and on in Safari, the site built
//
// Output: apps/extension/dist/safari-ui-test/NN-step.png (and NN-step.txt, Safari's accessibility tree, where a step
// couldn't find what it expected), exported from results.xcresult. The test runner is sandboxed and takes no
// environment, so the page's address is fixed in the test: http://localhost:8792/extension-test-fresh.html, a copy of
// the sample page with a new document id for each run.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = new URL("..", import.meta.url).pathname;
const site = `${root}apps/site/_site`;
const out = `${root}apps/extension/dist/safari-ui-test`;
const project = `${root}apps/extension/safari/ui-tests/PipeupSafariTests.xcodeproj`;
const port = 8792;

if (process.platform !== "darwin") fail("Safari's test runs on a Mac");
if (!existsSync(`${site}/extension-test.html`))
  fail("build the site first (apps/site/build.sh)");

// What Safari runs is the installed app (npm run safari-install): one copy, in its one place, the current build.
const home = process.env.PIPEUP_SAFARI_HOME || `${root}apps/extension/dist/Pipeup.app`;
const appex = `${home}/Contents/PlugIns/Pipeup Extension.appex`;
if (!existsSync(appex)) fail("no installed Safari app: run npm run safari-install first");
const registered = spawnSync("pluginkit", ["-m", "-v", "-A", "-i", "ai.pipeup.Pipeup.Extension"], { encoding: "utf8" })
  .stdout.split("\n")
  .filter((l) => l.includes("/"));
if (registered.length !== 1 || !registered[0].includes(home))
  fail(`Safari sees ${registered.length} Pipeup extensions, not the installed one alone; run npm run safari-install:\n${registered.join("\n")}`);
const installed = JSON.parse(readFileSync(`${appex}/Contents/Resources/manifest.json`, "utf8")).version;
const current = existsSync(`${root}apps/extension/dist/safari/manifest.json`)
  ? JSON.parse(readFileSync(`${root}apps/extension/dist/safari/manifest.json`, "utf8")).version
  : installed;
if (installed !== current)
  fail(`the installed Safari app is ${installed} but the last build is ${current}: run npm run safari-install`);
const signed = spawnSync("codesign", ["-dv", appex], { encoding: "utf8" }).stderr;
if (!/TeamIdentifier=[A-Z0-9]{10}/.test(signed))
  console.warn("safari-ui-test: the installed app is unsigned; Safari turns it off at every start unless Develop → Allow Unsigned Extensions is on");
console.log(`Safari's Pipeup: ${installed} at ${home}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// A fresh copy of the sample page for this run: comments are kept by the page's document id, so the same page would
// open the last run's comment where the test expects an empty paragraph. The id is random, in the shape Pipeup makes
// (16 and 43 base64url characters), and the test opens this copy.
const b64u = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url");
const sample = readFileSync(`${site}/extension-test.html`, "utf8");
if (!/data-pipeup-doc="[^"]+"/.test(sample)) fail("extension-test.html has no data-pipeup-doc");
writeFileSync(
  `${site}/extension-test-fresh.html`,
  sample.replace(/data-pipeup-doc="[^"]+"/, `data-pipeup-doc="${b64u(12)}:${b64u(32)}"`),
);

// The sample page, served locally unless something already serves that port.
const free = await new Promise((resolve) => {
  const probe = createServer()
    .once("error", () => resolve(false))
    .once("listening", () => probe.close(() => resolve(true)));
  probe.listen(port, "127.0.0.1");
});
const server = free
  ? spawn(
      "python3",
      [
        "-m",
        "http.server",
        String(port),
        "--bind",
        "127.0.0.1",
        "--directory",
        site,
      ],
      { stdio: "ignore" },
    )
  : null;
if (server) await new Promise((r) => setTimeout(r, 600));

const result = spawnSync(
  "xcodebuild",
  [
    "test",
    "-project",
    project,
    "-scheme",
    "PipeupSafariTests",
    "-destination",
    "platform=macOS",
    "-derivedDataPath",
    `${out}/build`,
    "-resultBundlePath",
    `${out}/results.xcresult`,
    "CODE_SIGN_IDENTITY=-",
    "CODE_SIGN_STYLE=Manual",
    "DEVELOPMENT_TEAM=",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
server?.kill();

const log = (result.stdout ?? "") + (result.stderr ?? "");
// The screenshots and trees, out of the result bundle under the names the test gave them.
if (existsSync(`${out}/results.xcresult`)) {
  const exported = `${out}/attachments`;
  spawnSync(
    "xcrun",
    [
      "xcresulttool",
      "export",
      "attachments",
      "--path",
      `${out}/results.xcresult`,
      "--output-path",
      exported,
    ],
    { stdio: "ignore" },
  );
  const manifest = existsSync(`${exported}/manifest.json`)
    ? JSON.parse(readFileSync(`${exported}/manifest.json`, "utf8"))
    : [];
  for (const test of manifest)
    for (const a of test.attachments ?? []) {
      // The test's own attachments, under the names it gave (xcresulttool adds _0_<uuid>); not XCTest's debug dumps.
      const name = a.suggestedHumanReadableName.replace(
        /_\d+_[0-9A-F-]{36}(\.\w+)$/,
        "$1",
      );
      if (
        /^\d\d-/.test(name) &&
        existsSync(`${exported}/${a.exportedFileName}`)
      )
        renameSync(`${exported}/${a.exportedFileName}`, `${out}/${name}`);
    }
  rmSync(exported, { recursive: true, force: true });
}
const lines = log
  .split("\n")
  .filter((l) =>
    /error|failed|passed|Executed|Test Case|XCTAssert|see \//i.test(l),
  );
console.log(lines.join("\n"));
const shots = readdirSync(out)
  .filter((f) => /\.(png|txt)$/.test(f))
  .sort();
console.log(`\n${shots.length} files in ${out}`);
for (const s of shots) console.log(`  ${s}`);
if (result.status !== 0) {
  if (/No toolbar-button/.test(log))
    console.error(
      "\nPipeup's button isn't in Safari's toolbar, so Safari doesn't have the extension on. Safari → Settings → " +
        "Extensions → tick Pipeup (once; a signed build then stays on). If the list shows more than one Pipeup, " +
        "or none, run npm run safari-install.",
    );
  if (/not authorized|not permitted|AXIsProcessTrusted|TCC/.test(log))
    console.error(
      "\nmacOS must allow the test runner to control the computer: System Settings → Privacy & Security → Accessibility.",
    );
  process.exit(result.status ?? 1);
}

function fail(why) {
  console.error(`safari-ui-test: ${why}`);
  process.exit(1);
}
