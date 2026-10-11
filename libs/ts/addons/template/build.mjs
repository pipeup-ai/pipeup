// Builds dist/hello.min.js (a classic script that registers itself) and dist/hello.esm.js (for `use(createAddon())`).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const common = { bundle: true, minify: true, target: "es2020", legalComments: "none", logLevel: "warning" };
await build({ ...common, entryPoints: ["src/index.ts"], format: "iife", outfile: "dist/hello.min.js" });
await build({ ...common, entryPoints: ["src/addon.ts"], format: "esm", outfile: "dist/hello.esm.js" });

// The one file a company hosts and pins: Pipeup's own build, then your add-on. Pipeup finds an add-on whether it loads
// first or after, so the order here is only a convenience.
writeFileSync(
  "dist/pipeup+hello.min.js",
  `${readFileSync("node_modules/pipeup/dist/pipeup.min.js", "utf8")}\n${readFileSync("dist/hello.min.js", "utf8")}`,
);

// Pin each file with its integrity hash: <script src="..." integrity="sha384-..." crossorigin="anonymous">
for (const f of ["dist/hello.min.js", "dist/hello.esm.js", "dist/pipeup+hello.min.js"]) {
  const gz = (gzipSync(readFileSync(f)).length / 1024).toFixed(2);
  console.log(`${f}: ${gz} KB gzip  sha384-${createHash("sha384").update(readFileSync(f)).digest("base64")}`);
}
