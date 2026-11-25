#!/usr/bin/env node
// Puts the current Safari build into Safari, the same way every time: signed by the Mac's own development
// certificate, one copy in one place, a fresh build number. Design note: docs/design/safari-ui-tests.md.
//
//   npm run safari-install        (in apps/extension)       needs: APPLE_TEAM_ID in the environment or .env.local
//
// Why each step is here, learned the hard way (25 November 2026):
//   - unsigned, Safari turns the extension off at every start until Develop → Allow Unsigned Extensions is on
//     again, while still listing it as on: a signed build loads like any store extension;
//   - Safari lists every copy of the app it has ever seen, and the system elects one of them at random: one copy;
//   - replacing the app under the same path makes Safari untick it, and opening the new copy only wakes the old
//     process when one is running: the old one is quit first, and the new one launched, so Safari sees it;
//   - Safari keeps an extension's files by version: a new build number makes it read the new build.
// It ends by saying what, if anything, is left to do in Safari (one tick, the first time).
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { teamId } from "./apple-team.mjs";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}apps/extension/dist`;
// The one place. PIPEUP_SAFARI_HOME moves it, for a checkout that builds for another (the path Safari keeps).
const home = process.env.PIPEUP_SAFARI_HOME || `${dist}/Pipeup.app`;
const appex = (app) => `${app}/Contents/PlugIns/Pipeup Extension.appex`;
const EXT = "ai.pipeup.Pipeup.Extension";
const APP = "ai.pipeup.Pipeup";
const lsregister =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

if (process.platform !== "darwin")
  fail("Safari's app is built and installed on a Mac");
const team = teamId(root);
if (!team)
  fail(
    "no Apple team: put APPLE_TEAM_ID=<your team id> in .env.local at the repository's root (Xcode → Settings → " +
      "Accounts shows it). Unsigned builds don't stay on in Safari.",
  );
const identities = run("security", [
  "find-identity",
  "-v",
  "-p",
  "codesigning",
]);
if (!/Apple Development:/.test(identities))
  fail(
    "no Apple Development certificate on this Mac: sign in to Xcode → Settings → Accounts and make one under " +
      "Manage Certificates. The build can't be signed without it.",
  );

// Copies of the app the system knows about, other than the one place: forgotten, so Safari sees one Pipeup.
const others = [];
for (const p of run("mdfind", [`kMDItemCFBundleIdentifier == '${APP}'`])
  .split("\n")
  .filter(Boolean))
  if (p !== home) others.push(p);
for (const line of run("pluginkit", ["-m", "-v", "-A", "-i", EXT]).split(
  "\n",
)) {
  const p = line.split("\t").pop()?.trim();
  if (p && p.startsWith("/") && !p.startsWith(home))
    others.push(p.replace(/\/Contents\/PlugIns\/.*$/, ""));
}
for (const p of new Set(others)) {
  if (existsSync(appex(p)))
    spawnSync("pluginkit", ["-r", appex(p)], { stdio: "ignore" });
  spawnSync(lsregister, ["-u", p], { stdio: "ignore" });
  console.log(`forgot another copy: ${p}`);
}

// A fresh build number, kept in dist (ignored by git), so each install is a new version to Safari.
const counter = `${dist}/safari-build-number`;
const build =
  (existsSync(counter) ? Number(readFileSync(counter, "utf8")) || 0 : 0) + 1;
mkdirSync(dist, { recursive: true });
writeFileSync(counter, String(build));
console.log(`building Safari's app, signed by team ${team}, build ${build}`);
execFileSync("node", [`${root}tools/build-extension.mjs`, "--safari"], {
  stdio: "inherit",
  env: {
    ...process.env,
    APPLE_TEAM_ID: team,
    PIPEUP_BUILD_NUMBER: String(build),
  },
});
const built = `${dist}/safari-app/build/Build/Products/Debug/Pipeup.app`;
if (!existsSync(built)) fail(`the build left no app at ${built}`);
const signed = run("codesign", ["-dv", appex(built)], true);
if (!signed.includes(`TeamIdentifier=${team}`))
  fail(`the extension isn't signed by ${team}:\n${signed}`);

// The old copy out, the new one in, launched so Safari sees it.
spawnSync("pkill", ["-f", `${home}/Contents/MacOS/Pipeup`], {
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 800));
if (existsSync(home))
  spawnSync("pluginkit", ["-r", appex(home)], { stdio: "ignore" });
rmSync(home, { recursive: true, force: true });
cpSync(built, home, { recursive: true });
execFileSync("codesign", ["--verify", "--deep", "--strict", home]);
execFileSync("pluginkit", ["-a", appex(home)]);
execFileSync("open", [home]);
await new Promise((r) => setTimeout(r, 2500));
const running = run("pgrep", ["-fl", "Pipeup.app/Contents/MacOS/Pipeup"], true);
if (!running.includes(home))
  fail(
    `the app didn't launch from ${home}:\n${running || "(nothing running)"}`,
  );
const registered = run("pluginkit", ["-m", "-v", "-A", "-i", EXT]);
const where = registered.split("\n").filter((l) => l.includes("/"));
if (where.length !== 1 || !where[0].includes(home))
  fail(`Safari would see more than one Pipeup:\n${registered}`);

const manifest = JSON.parse(
  readFileSync(`${appex(home)}/Contents/Resources/manifest.json`, "utf8"),
);
console.log(
  `\nPipeup ${manifest.version} is installed at ${home}, signed, the only copy.`,
);
console.log(
  "Its window says whether Safari has it on. The first time: Safari → Settings → Extensions → tick Pipeup.",
);
console.log(
  "It then stays on across Safari's restarts. Nothing in the Develop menu is needed.",
);

function run(cmd, args, quiet = false) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0 && !quiet)
    fail(`${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  return (r.stdout ?? "") + (quiet ? (r.stderr ?? "") : "");
}
function fail(why) {
  console.error(`safari-install: ${why}`);
  process.exit(1);
}
