// Builds dist/send-to-git.min.js (a classic script that registers itself), dist/send-to-git.esm.js, and the one bundled
// file a company can host and pin: Pipeup and this add-on together. Prints each file's integrity hash.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

const common = { bundle: true, minify: true, target: "es2020", legalComments: "none", logLevel: "warning" };
await build({ ...common, entryPoints: ["src/index.ts"], format: "iife", outfile: "dist/send-to-git.min.js" });
await build({ ...common, entryPoints: ["src/addon.ts"], format: "esm", outfile: "dist/send-to-git.esm.js" });

const sri = (file) => `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`;
const out = ["dist/send-to-git.min.js", "dist/send-to-git.esm.js"];
// The bundled file: Pipeup's own classic build, then the add-on (Pipeup finds the add-on whether it loads first or after).
const pipeup = ["../../../pipeup/dist/pipeup.min.js", "node_modules/pipeup/dist/pipeup.min.js"].find((p) =>
  existsSync(p),
);
if (pipeup) {
  writeFileSync(
    "dist/pipeup+send-to-git.min.js",
    `${readFileSync(pipeup, "utf8")}\n${readFileSync(out[0], "utf8")}`,
  );
  out.push("dist/pipeup+send-to-git.min.js");
}
for (const f of out)
  console.log(`${f}: ${(gzipSync(readFileSync(f)).length / 1024).toFixed(2)} KB gzip  ${sri(f)}`);
