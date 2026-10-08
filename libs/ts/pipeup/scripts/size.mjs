import { readFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";

// 44 KB while add-on support is in (it measured +4.4 KB over 0.4.1's 36.8 KB); see add-ons design §15.
const BUDGETS = {
  "dist/pipeup.min.js": 44 * 1024,
  "dist/pipeup.esm.js": 44 * 1024,
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
