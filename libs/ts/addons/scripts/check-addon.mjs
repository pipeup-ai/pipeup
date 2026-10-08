// Fails an add-on's built files on anything the file:// rules (add-ons design §11) forbid.
import { existsSync, readFileSync } from "node:fs";

const id = process.argv[2];
const root = new URL(`../${id}/`, import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
let bad = 0;
const fail = (m) => (console.error(`check-addon ${id}: ${m}`), bad++);

if (pkg.dependencies && Object.keys(pkg.dependencies).length)
  fail("it has runtime dependencies (R11): there must be none");
if (!pkg.pipeup?.network?.says) fail('package.json needs pipeup.network ("when", "to", "says")');

// Patterns that must not appear in the classic or ESM builds (R1-R10). The CLI and headless builds run in Node.
const BANNED = [
  [/\bimport\s*\(/, "import() (R1)"],
  [/\bimport\.meta\b/, "import.meta (R1)"],
  [/\beval\s*\(/, "eval (R9)"],
  [/\bnew Function\s*\(/, "new Function (R9)"],
  [/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/, "innerHTML and friends (comment text is text only)"],
  [/importScripts\s*\(/, "importScripts (R3, R11)"],
  [/SharedArrayBuffer/, "SharedArrayBuffer (R4)"],
  [/type\s*:\s*["']module["']/, "a module worker (R1)"],
  [/<\/script|<script/i, "</script or <script (R10)"],
];
const browser = [`${id}.min.js`, `${id}.esm.js`].filter((f) => existsSync(`${root}dist/${f}`));
for (const f of browser) {
  const code = readFileSync(`${root}dist/${f}`, "utf8");
  for (const [re, what] of BANNED) if (re.test(code)) fail(`${f} contains ${what}`);
  if (f.endsWith(".min.js")) {
    if (!code.startsWith('"use strict"')) fail(`${f} must begin with "use strict" (R1)`);
    if (/^\s*export\s|\bexport\s*\{/.test(code)) fail(`${f} must not export (R1)`);
    if (/\bnew Worker\(/.test(code) && !/createObjectURL/.test(code))
      fail(`${f} starts a worker not made from a Blob (R3)`);
  }
}
if (bad) process.exit(1);
console.log(`check-addon ${id}: ok (${browser.join(", ")})`);
