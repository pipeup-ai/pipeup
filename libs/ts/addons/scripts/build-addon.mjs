// Builds one add-on: classic script, ESM, headless engine (if it has one), CLI (if it has one), and the combined
// file `pipeup+<id>.min.js` (the core's classic build, a newline, then the add-on's classic build, byte for byte).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { build } from "esbuild";

const id = process.argv[2];
if (!id) throw new Error("usage: build-addon.mjs <id>");
const root = new URL(`../${id}/`, import.meta.url).pathname;
const core = new URL("../../pipeup/dist/pipeup.min.js", import.meta.url).pathname;
mkdirSync(`${root}dist/types`, { recursive: true });

// Scripts an agent runs (the agents add-on's shell link): published in dist as they are, and their checksums built into
// the add-on, so the text it copies for an agent names the exact file to fetch and how to check it.
const shell = {};
if (existsSync(`${root}shell`)) {
  for (const name of readdirSync(`${root}shell`)) {
    copyFileSync(`${root}shell/${name}`, `${root}dist/${name}`);
    shell[name] = createHash("sha256")
      .update(readFileSync(`${root}shell/${name}`))
      .digest("hex");
  }
}
const version = JSON.parse(readFileSync(`${root}package.json`, "utf8")).version;

const common = {
  bundle: true,
  define: Object.keys(shell).length ? { __PIPEUP_SHELL__: JSON.stringify({ version, sha256: shell }) } : {},
  target: ["es2022"],
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "warning",
};
// No mangleProps: an add-on's own wire keys must survive, and it must never share the core's mangled names.
await build({
  ...common,
  entryPoints: [`${root}src/auto.ts`],
  format: "iife",
  outfile: `${root}dist/${id}.min.js`,
});
await build({
  ...common,
  entryPoints: [`${root}src/index.ts`],
  format: "esm",
  outfile: `${root}dist/${id}.esm.js`,
});
if (existsSync(`${root}src/headless.ts`))
  await build({
    ...common,
    entryPoints: [`${root}src/headless.ts`],
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    outfile: `${root}dist/${id}.headless.js`,
  });
if (existsSync(`${root}src/cli.ts`))
  await build({
    ...common,
    minify: false,
    entryPoints: [`${root}src/cli.ts`],
    format: "esm",
    platform: "node",
    banner: { js: "#!/usr/bin/env node" },
    outfile: `${root}dist/cli.js`,
  });
if (existsSync(`${root}types.d.ts`)) copyFileSync(`${root}types.d.ts`, `${root}dist/types/index.d.ts`);

if (existsSync(core)) {
  const code = readFileSync(`${root}dist/${id}.min.js`, "utf8");
  if (!code.startsWith('"use strict"'))
    throw new Error(`${id}: the classic build must begin with "use strict"`);
  writeFileSync(`${root}dist/pipeup+${id}.min.js`, `${readFileSync(core, "utf8")}\n${code}`);
} else console.warn(`build-addon: ${core} not found; build the core first for the combined file`);
