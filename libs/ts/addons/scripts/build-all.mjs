import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Gzip budgets (add-ons design §15); a combined file is checked against core + add-on.
const BUDGETS = { share: 7.5 * 1024, voice: 4 * 1024, live: 10.5 * 1024 };
const CORE = 44 * 1024;
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
if (over) process.exit(1);
