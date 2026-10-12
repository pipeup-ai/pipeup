#!/usr/bin/env node
// The skills have one source, apps/agent-skills. The Claude Code plugin carries copies (plugins/pipeup/skills): this
// makes them, or with --check says whether they are up to date (CI runs it).
//
//   node tools/sync-skills.mjs [--check]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = join(root, "apps/agent-skills");
const target = join(root, "plugins/pipeup/skills");
const names = readdirSync(source).filter((n) => n.startsWith("pipeup-") && existsSync(join(source, n, "SKILL.md")));
const check = process.argv.includes("--check");

if (check) {
  const have = existsSync(target) ? readdirSync(target).sort() : [];
  const stale = [...names.filter((n) => !have.includes(n)), ...have.filter((n) => !names.includes(n))];
  for (const n of names)
    if (have.includes(n) && readFileSync(join(source, n, "SKILL.md"), "utf8") !== readFileSync(join(target, n, "SKILL.md"), "utf8"))
      stale.push(n);
  if (stale.length) {
    console.error(`the plugin's skills are out of date (${[...new Set(stale)].join(", ")}): run node tools/sync-skills.mjs`);
    process.exit(1);
  }
  console.log(`the plugin carries the ${names.length} skills as they are`);
} else {
  rmSync(target, { recursive: true, force: true });
  for (const n of names) {
    mkdirSync(join(target, n), { recursive: true });
    cpSync(join(source, n, "SKILL.md"), join(target, n, "SKILL.md"));
  }
  console.log(`copied ${names.length} skills to plugins/pipeup/skills`);
}
