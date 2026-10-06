// Prints the Subresource Integrity value for dist/pipeup.min.js, for the release notes and pinned
// CDN script tags: <script src=".../pipeup@X.Y.Z/dist/pipeup.min.js" integrity="<this>" crossorigin="anonymous">
// Run after `npm run build`: node scripts/sri.mjs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const file = new URL("../dist/pipeup.min.js", import.meta.url);
const digest = createHash("sha384").update(readFileSync(file)).digest("base64");
console.log(`sha384-${digest}`);
