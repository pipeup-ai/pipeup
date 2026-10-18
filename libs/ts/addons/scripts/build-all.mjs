import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Gzip budgets (add-ons design §15); a combined file is checked against core + add-on.
const BUDGETS = {
  share: 8.5 * 1024,
  voice: 4 * 1024,
  live: 11 * 1024,
  assist: 10 * 1024,
  agents: 5 * 1024,
  emoji: 32 * 1024,
  github: 3 * 1024,
  updates: 4 * 1024,
  inbox: 8 * 1024,
  identity: 4 * 1024,
};
const CORE = 60 * 1024;
let over = false;
const here = new URL(".", import.meta.url).pathname;
// The fixture add-on the e2e tests load: no budget.
execFileSync("node", [`${here}build-addon.mjs`, "test"], { stdio: "inherit" });
for (const id of Object.keys(BUDGETS)) {
  if (!existsSync(`${here}../${id}/src/auto.ts`)) continue;
  execFileSync("node", [`${here}build-addon.mjs`, id], { stdio: "inherit" });
  execFileSync("node", [`${here}check-addon.mjs`, id], { stdio: "inherit" });
  const gz = (f) => gzipSync(readFileSync(`${here}../${id}/dist/${f}`)).length;
  const own = gz(`${id}.min.js`);
  console.log(
    `${id}.min.js: ${(own / 1024).toFixed(2)} KB gzip (budget ${(BUDGETS[id] / 1024).toFixed(1)} KB)`,
  );
  if (own > BUDGETS[id]) {
    console.error(`${id} is over its budget`);
    over = true;
  }
  if (existsSync(`${here}../${id}/dist/pipeup+${id}.min.js`)) {
    const both = gz(`pipeup+${id}.min.js`);
    console.log(`pipeup+${id}.min.js: ${(both / 1024).toFixed(2)} KB gzip`);
    if (both > CORE + BUDGETS[id]) {
      console.error(`pipeup+${id}.min.js is over its budget`);
      over = true;
    }
  }
}
// `pipeup init` pins add-ons without the network: the pipeup package carries each add-on's hash, its sentence about
// what it sends, and what it needs from the author (docs/design/cli-init.md).
const table = {};
for (const id of Object.keys(BUDGETS)) {
  const file = `${here}../${id}/dist/${id}.min.js`;
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(`${here}../${id}/package.json`, "utf8"));
  table[id] = {
    integrity: `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`,
    says: pkg.pipeup?.network?.says ?? "",
    ...(pkg.pipeup?.asks ? { asks: pkg.pipeup.asks } : {}),
  };
}
writeFileSync(`${here}../../pipeup/dist/addons.json`, `${JSON.stringify(table, null, 2)}\n`);
// `pipeup watch` serves the agents add-on from the pipeup package, so the package carries a copy of it.
if (existsSync(`${here}../agents/dist/agents.min.js`))
  copyFileSync(`${here}../agents/dist/agents.min.js`, `${here}../../pipeup/dist/pipeup.agents.js`);
// The example a company would write for itself (Send to Git): built with the others so its tests and the site can use it.
execFileSync("node", [`${here}../examples/send-to-git/build.mjs`], {
  cwd: `${here}../examples/send-to-git`,
  stdio: "inherit",
});
execFileSync("node", [`${here}../examples/save-to-github/build.mjs`], {
  cwd: `${here}../examples/save-to-github`,
  stdio: "inherit",
});
if (over) process.exit(1);
