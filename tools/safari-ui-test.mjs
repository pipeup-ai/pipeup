#!/usr/bin/env node
// Drives Safari with Pipeup's extension in it, with Apple's UI testing (apps/extension/safari/ui-tests), and keeps a
// screenshot of every step. Design note: docs/design/safari-ui-tests.md.
//
//   node tools/safari-ui-test.mjs        needs: a Pipeup extension on in Safari, the site built (apps/site/build.sh)
//
// Output: apps/extension/dist/safari-ui-test/NN-step.png (and NN-step.txt, Safari's accessibility tree, where a step
// couldn't find what it expected), exported from results.xcresult. The test runner is sandboxed and takes no
// environment, so the page's address is fixed in the test: http://localhost:8792/extension-test.html.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
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

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

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
