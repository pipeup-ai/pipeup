// Builds dist/hello.min.js (a classic script that registers itself) and dist/hello.esm.js (for `use(createAddon())`).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const common = { bundle: true, minify: true, target: "es2020", legalComments: "none", logLevel: "warning" };
await build({ ...common, entryPoints: ["src/index.ts"], format: "iife", outfile: "dist/hello.min.js" });
await build({ ...common, entryPoints: ["src/addon.ts"], format: "esm", outfile: "dist/hello.esm.js" });

const size = gzipSync(readFileSync("dist/hello.min.js")).length;
console.log(`hello.min.js: ${(size / 1024).toFixed(2)} KB gzip`);
