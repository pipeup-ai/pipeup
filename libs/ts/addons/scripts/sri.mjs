// Prints one SRI line per built classic file (the add-ons and their combined files), for the release notes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const here = new URL("../", import.meta.url).pathname;
for (const id of ["share", "voice", "live"]) {
  for (const f of [`${id}.min.js`, `pipeup+${id}.min.js`]) {
    const path = `${here}${id}/dist/${f}`;
    if (!existsSync(path)) continue;
    const hash = createHash("sha384").update(readFileSync(path)).digest("base64");
    console.log(`SRI for \`@pipeup/${id}/dist/${f}\`: \`sha384-${hash}\``);
  }
}
