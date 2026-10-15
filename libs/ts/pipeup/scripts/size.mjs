import { readFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";

// 50 KB: it was 42 KB while add-on support was in (+3.8 KB over 0.4.1's 36.8 KB), then agents reading and answering comments
// added 2.6 KB and the live link to an agent 0.4 KB (design: docs/design/agent-replies.md); then reading the
// page's light or dark look reliably and the reviewer's Look choice added 0.3 KB (design: docs/design/page-isolation.md); the budget
// went to 50 KB for reactions and mentions, and to 56 KB when reactions, the picker slot, mentions, portable
// identities and the page-isolation work all landed in core (agent support had left it); then back to 50 KB in 0.8,
// when portable identities moved out to @pipeup/identity (docs/design/size-pass.md); then 51 KB for one compact card
// everywhere, the panel's footer and new comments written in it, editing and deleting from ⋯, and Cancel and Comment
// buttons: +1.6 KB of Pipeup's own UI, which every page shows (docs/design/panel-hub.md); then 52 KB for the
// walkthrough's fixes (+0.4 KB): messages beside the round button, popovers and the selection's icon that never cover
// what they're about, and new comments clear of the button (docs/design/walkthrough-fixes.md).
const BUDGETS = {
  "dist/pipeup.min.js": 52 * 1024,
  "dist/pipeup.esm.js": 52 * 1024,
  "dist/pipeup.core.js": 12 * 1024,
};
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let over = false;
for (const [file, limit] of Object.entries(BUDGETS)) {
  const bytes = readFileSync(file);
  // A combined file can sit inside a page's own <script>: no build may contain a closing or opening script tag.
  if (/<\/script|<script/i.test(bytes.toString("utf8"))) {
    console.error(`pipeup: ${file} contains </script or <script`);
    process.exit(1);
  }
  const gz = gzipSync(bytes).length;
  console.log(
    `${file}: ${kb(bytes.length)} min · ${kb(gz)} gzip · ${kb(brotliCompressSync(bytes).length)} brotli (budget ${kb(limit)})`,
  );
  if (gz > limit) {
    console.error(`pipeup: ${file} is over its ${kb(limit)} gzip budget`);
    over = true;
  }
}
if (over) process.exit(1);

const code = readFileSync("dist/pipeup.min.js", "utf8");
const Pipeup = new Function(`${code}; return Pipeup;`)();
for (const name of [
  "PipeupDocument",
  "newDocumentAttribute",
  "copyAll",
  "mount",
  "setViewState",
  "onReveal",
]) {
  if (typeof Pipeup[name] !== "function") {
    console.error(`pipeup: the Pipeup global is missing ${name}`);
    process.exit(1);
  }
}
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (Pipeup.VERSION !== version) {
  console.error(
    `pipeup: VERSION in src/core.ts (${Pipeup.VERSION}) does not match package.json (${version})`,
  );
  process.exit(1);
}
console.log(`Pipeup global OK (version ${Pipeup.VERSION})`);
