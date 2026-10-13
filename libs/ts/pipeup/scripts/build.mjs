import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build, transform } from "esbuild";
import { minify } from "terser";
import { MANGLED } from "./mangle.mjs";

// The stylesheet's comments and line breaks are for reading the source: the bundles carry it minified.
const minifyStyles = {
  name: "minify-styles",
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]ui[\\/]styles\.ts$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const found = /export const STYLES = `([^`$\\]*)`;/.exec(source);
      if (!found) throw new Error("build: STYLES must be one plain template literal in src/ui/styles.ts");
      const { code } = await transform(found[1], { loader: "css", minify: true });
      return {
        contents: source.replace(found[0], `export const STYLES = ${JSON.stringify(code.trim())};`),
        loader: "ts",
      };
    });
  },
};

const common = {
  bundle: true,
  target: ["es2022"],
  legalComments: "none",
  drop: ["debugger"],
  // Maps are written for local debugging, but the published bundles carry no sourceMappingURL.
  sourcemap: "external",
  minify: true,
  plugins: [minifyStyles],
  // The UI's internal property names (never public API, never stored or sent) are shortened in the bundles.
  // `navigate` here is Here.navigate; never use it for the Navigation API (window.navigation.navigate).
  // Add a name here only if no public type, stored op or DOM API uses a property of that name.
  mangleProps: MANGLED,
};

// Classic script for <script> tags (also works from file://): core + UI + auto-mount. It is built as a module and
// wrapped by hand, rather than as esbuild's IIFE, which carries CommonJS interop the page never uses (about 0.5 KB
// gzip). The global keeps its shape: the same names, enumerable, read-only and non-configurable, on an extensible
// object with the hidden `__esModule` marker; auto-mount still runs before the global is assigned.
// Written by hand below, so dist/ must exist first (esbuild makes it only when it writes).
await mkdir("dist", { recursive: true });
const classic = await build({
  ...common,
  entryPoints: ["src/auto.ts"],
  format: "esm",
  outfile: "dist/pipeup.min.js",
  write: false,
});
for (const out of classic.outputFiles) {
  if (out.path.endsWith(".map")) {
    await writeFile(out.path, out.text);
    continue;
  }
  const found = /export\s*\{([^}]*)\};?\s*(\/\/# sourceMappingURL=\S*\s*)?$/.exec(out.text);
  if (!found) throw new Error("build: the classic script's module must end with one export list");
  const names = found[1]
    .split(",")
    .map((p) => p.trim().split(/\s+as\s+/))
    .map(([local, name]) => `${JSON.stringify(name ?? local)}:${local}`);
  // One line of wrapper before the body, so the source map's lines move by none.
  await writeFile(
    out.path,
    `"use strict";var Pipeup=(()=>{${out.text.slice(0, found.index)};const o=Object.defineProperty({},"__esModule",{value:!0});for(const[k,v]of Object.entries({${names.join(",")}}))Object.defineProperty(o,k,{value:v,enumerable:!0});return o})();\n`,
  );
}
// ESM for bundlers: core + UI, no side effects.
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/pipeup.esm.js" });
// Core only, for tools that never draw UI (CLI, servers).
await build({ ...common, entryPoints: ["src/core.ts"], format: "esm", outfile: "dist/pipeup.core.js" });

// A second minifier over esbuild's output: terser folds and mangles more, and its output is a few percent smaller
// both gzipped and brotli compressed. Top-level names are left alone (the classic script's `Pipeup` global, and
// the modules' exports), and the source maps are carried through.
for (const [file, module] of [
  ["pipeup.min.js", false],
  ["pipeup.esm.js", true],
  ["pipeup.core.js", true],
]) {
  const path = `dist/${file}`;
  const result = await minify(await readFile(path, "utf8"), {
    module,
    ecma: 2022,
    compress: { passes: 2, drop_debugger: true },
    mangle: true,
    // ASCII only: non-ASCII characters are escaped, which compresses better and is safe in any page encoding.
    format: { comments: false, ascii_only: true },
    sourceMap: { content: await readFile(`${path}.map`, "utf8") },
  });
  await writeFile(path, result.code);
  await writeFile(`${path}.map`, result.map);
}
