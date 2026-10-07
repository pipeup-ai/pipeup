import { readFile } from "node:fs/promises";
import { build, transform } from "esbuild";

// The stylesheet's comments and line breaks are for reading the source: the bundles carry it minified.
const minifyStyles = {
  name: "minify-styles",
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]ui[\\/]styles\.ts$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const found = /export const STYLES = `([^`$\\]*)`;/.exec(source);
      if (!found) throw new Error("build: STYLES must be one plain template literal in src/ui/styles.ts");
      const { code } = await transform(found[1], { loader: "css", minify: true });
      return { contents: source.replace(found[0], `export const STYLES = ${JSON.stringify(code.trim())};`), loader: "ts" };
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
  mangleProps:
    /^(showResolved|commenting|listing|reading|draft|quoteAt|readsAt|owns|claim|claimed|focusReply|startDraft|moveDraft|draftEmpty|keepCaret|postDraft|cancelDraft|setCommenting|dismiss|registerDraft|toast|report|pulse|render|frame|layer|pending|actions|visible|hideLabel|setLabel|isEmpty|caret|onSend|onCancel|want|toggleResolved|picking|gutter|fade|room|drawn|grouped|viewport|box|popovers|variant|active|hot|menu|here|holds|navigate|elsewhere|recheck)$/,
};

// Classic script for <script> tags (also works from file://): core + UI + auto-mount.
await build({ ...common, entryPoints: ["src/auto.ts"], format: "iife", globalName: "Pipeup", outfile: "dist/pipeup.min.js" });
// ESM for bundlers: core + UI, no side effects.
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: "dist/pipeup.esm.js" });
// Core only, for tools that never draw UI (CLI, servers).
await build({ ...common, entryPoints: ["src/core.ts"], format: "esm", outfile: "dist/pipeup.core.js" });
