#!/usr/bin/env node
// Builds the update list (apps/site/updates.json, unsigned) from the package version, the built script's integrity
// hash, and docs/advisories.json. Then: node tools/sign-updates.mjs sign. See docs/design/update-notices.md.
//
//   node tools/make-updates.mjs [--out apps/site/updates.json] [--days 90]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sha384 } from "./updates.mjs";

const root = new URL("..", import.meta.url).pathname;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg("out", `${root}apps/site/updates.json`);
const days = Number(arg("days", "90"));
const pkg = JSON.parse(readFileSync(`${root}libs/ts/pipeup/package.json`, "utf8"));
const advisories = JSON.parse(readFileSync(`${root}docs/advisories.json`, "utf8"));
const core = readFileSync(`${root}libs/ts/pipeup/src/core.ts`, "utf8");
const built = /BUILT = "([0-9-]+)"/.exec(core)?.[1] ?? "";
const dist = `${root}libs/ts/pipeup/dist/pipeup.min.js`;
const now = Date.now();

const list = {
  v: 1,
  at: new Date(now).toISOString(),
  expires: new Date(now + days * 864e5).toISOString(),
  latest: pkg.version,
  minimum: advisories.minimum,
  versions: {
    [pkg.version]: {
      date: built,
      integrity: existsSync(dist) ? sha384(readFileSync(dist)) : "",
      notes: `https://github.com/pipeup-ai/pipeup/releases/tag/v${pkg.version}`,
    },
  },
  advisories: advisories.advisories,
};
writeFileSync(out, `${JSON.stringify(list, null, 2)}\n`);
console.log(`wrote ${out} (latest ${pkg.version}, ${list.advisories.length} advisories, expires ${list.expires.slice(0, 10)}); now sign it: node tools/sign-updates.mjs sign`);
