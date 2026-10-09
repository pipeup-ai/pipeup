import { readFile, writeFile } from "node:fs/promises";
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

// Classic script for <script> tags (also works from file://): core + UI + auto-mount.
await build({
  ...common,
  entryPoints: ["src/auto.ts"],
  format: "iife",
  globalName: "Pipeup",
  outfile: "dist/pipeup.min.js",
});
// ESM for bundlers: core + UI, no side effects.
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/pipeup.esm.js" });
// Core only, for tools that never draw UI (CLI, servers).
await build({ ...common, entryPoints: ["src/core.ts"], format: "esm", outfile: "dist/pipeup.core.js" });

// A second minifier over esbuild's output: terser folds and mangles more, and its output is a few percent smaller
// both gzipped and brotli compressed. Top-level names are left alone (the classic script's `Pipeup` global, and
// the modules' exports), and the source maps are carried through.
for (const [file, module] of [["pipeup.min.js", false], ["pipeup.esm.js", true], ["pipeup.core.js", true]]) {
  const path = `dist/${file}`;
  const result = await minify(await readFile(path, "utf8"), {
    module,
    ecma: 2022,
    compress: { passes: 2, drop_debugger: true },
    mangle: true,
    format: { comments: false },
    sourceMap: { content: await readFile(`${path}.map`, "utf8") },
  });
  await writeFile(path, result.code);
  await writeFile(`${path}.map`, result.map);
}
