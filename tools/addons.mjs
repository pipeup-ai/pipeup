#!/usr/bin/env node
// The one list of Pipeup's published add-ons: the add-ons workspace's packages that aren't private, in the
// workspace's order. The release, tools/set-version.sh, the SRI lines and the site build all read it, so a new
// add-on is added in one place (libs/ts/addons/package.json's workspaces).
//
//   node tools/addons.mjs            prints the ids, space-separated (share voice live …)
//   node tools/addons.mjs --check    fails if a place that can't read the list (the site's SRI map, the Add-ons
//                                    page's cards) is missing an add-on or names one that isn't published
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const addonsDir = `${root}libs/ts/addons`;
const json = (path) => JSON.parse(readFileSync(path, "utf8"));

/** The published add-ons' ids (their folder names), in the workspace's order. */
export function addons() {
  return json(`${addonsDir}/package.json`).workspaces.filter((id) => {
    const pkg = json(`${addonsDir}/${id}/package.json`);
    return !pkg.private && pkg.name === `@pipeup/${id}`;
  });
}

function check() {
  const ids = addons();
  const problems = [];
  const compare = (where, found) => {
    for (const id of ids) if (!found.includes(id)) problems.push(`${where} is missing ${id}`);
    for (const id of found)
      if (!ids.includes(id)) problems.push(`${where} names ${id}, which isn't a published add-on`);
  };
  const site = readFileSync(`${root}apps/site/addons.js`, "utf8");
  const map = /const SRI = \{(.*)\};/.exec(site)?.[1] ?? "";
  compare(
    "apps/site/addons.js's SRI map",
    [...map.matchAll(/(\w+): "\{\{SRI:(\w+)\}\}"/g)].map((m) => m[1]),
  );
  const catalog = json(`${root}apps/site/addons/catalog.json`);
  const ours = catalog.groups.find((g) => g.title === "From Pipeup")?.cards ?? [];
  compare(
    "apps/site/addons/catalog.json's From Pipeup cards",
    ours.map((c) => c.id),
  );
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`ok: ${ids.length} add-ons, listed everywhere`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--check")) check();
  else console.log(addons().join(" "));
}
