// pipeup skills install | remove | list: puts Pipeup's agent skills where Claude Code and Codex look for them.
// It writes only SKILL.md files and a small marker beside each (so it can tell its own from yours), asks before
// replacing one you changed, and makes no network request: the skills ship inside this package.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const MARKER = ".pipeup-installed";
const sha = (text) => createHash("sha256").update(text).digest("hex");

/** Where the skills come from: inside this package, or (running from the repository) the one source. */
function sourceDir() {
  for (const rel of ["../skills", "../../../../apps/agent-skills"]) {
    const dir = new URL(`${rel}/`, import.meta.url).pathname;
    if (existsSync(dir)) return dir;
  }
  throw new Error("this copy of pipeup doesn't carry the skills");
}

function loadSkills() {
  const dir = sourceDir();
  return readdirSync(dir)
    .filter((n) => n.startsWith("pipeup-") && existsSync(join(dir, n, "SKILL.md")))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name, "SKILL.md"), "utf8") }));
}

const version = () => JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/** The places to write: each agent's skills folder, for the person (every project) or for this project only. */
export function targets({
  agent = "all",
  project = false,
  home = process.env.PIPEUP_SKILLS_HOME || homedir(),
  cwd = process.cwd(),
}) {
  const base = project ? cwd : home;
  const out = [];
  if (agent === "all" || agent === "claude")
    out.push({ agent: "Claude Code", dir: join(base, ".claude", "skills") });
  if (agent === "all" || agent === "codex")
    out.push({ agent: "Codex", dir: join(base, ".agents", "skills") });
  if (!out.length) throw new Error(`unknown agent "${agent}": use claude, codex or all`);
  return out;
}

/** What is there now for one skill: nothing, ours and unchanged, or changed by you (or not ours). */
async function stateOf(dir, name) {
  const file = join(dir, name, "SKILL.md");
  if (!existsSync(file)) return "new";
  const text = await readFile(file, "utf8");
  try {
    const marker = JSON.parse(await readFile(join(dir, name, MARKER), "utf8"));
    return marker.sha256 === sha(text) ? "ours" : "changed";
  } catch {
    return "changed";
  }
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

export async function install(o) {
  const skills = loadSkills();
  const where = targets(o);
  const plan = [];
  for (const t of where)
    for (const s of skills)
      plan.push({ ...t, ...s, state: await stateOf(t.dir, s.name), path: join(t.dir, s.name, "SKILL.md") });
  const say = o.log ?? console.log;
  say(`Pipeup skills ${version()} (${skills.length}) will be written to:`);
  for (const t of where) say(`  ${t.agent}: ${t.dir}`);
  const mine = (st) => plan.filter((p) => p.state === st).length;
  say(
    `  ${mine("new")} new, ${mine("ours")} already from Pipeup (updated if different), ${mine("changed")} you have changed or didn't come from here`,
  );
  if (mine("changed")) say("  Skills you have changed are left alone unless you choose to replace them.");
  if (o.dryRun) return { written: 0, skipped: 0, dry: true };
  if (!o.yes) {
    if (!process.stdin.isTTY) {
      say(
        "Nothing written. Run it again with --yes to go ahead (--replace also replaces skills you changed).",
      );
      return { written: 0, skipped: plan.length };
    }
    if (!(await ask("Go ahead?"))) return { written: 0, skipped: plan.length };
  }
  let written = 0;
  let skipped = 0;
  for (const p of plan) {
    if (p.state === "changed") {
      const replace =
        o.replace ||
        (process.stdin.isTTY && !o.yes ? await ask(`${p.path} has been changed. Replace it?`) : false);
      if (!replace) {
        say(`  kept yours: ${p.path}`);
        skipped++;
        continue;
      }
    }
    await mkdir(join(p.dir, p.name), { recursive: true });
    await writeFile(p.path, p.text);
    await writeFile(
      join(p.dir, p.name, MARKER),
      JSON.stringify({ version: version(), sha256: sha(p.text) }) + "\n",
    );
    written++;
  }
  say(
    `Wrote ${written} skill${written === 1 ? "" : "s"}${skipped ? `, kept ${skipped} of yours` : ""}. Restart the agent if it was open.`,
  );
  return { written, skipped };
}

export async function remove(o) {
  const say = o.log ?? console.log;
  const skills = loadSkills();
  let removed = 0;
  for (const t of targets(o))
    for (const s of skills) {
      const state = await stateOf(t.dir, s.name);
      if (state === "new") continue;
      if (state === "changed" && !o.replace) {
        say(`  kept (not from Pipeup, or changed by you): ${join(t.dir, s.name)}`);
        continue;
      }
      if (o.dryRun) say(`  would remove ${join(t.dir, s.name)}`);
      else await rm(join(t.dir, s.name), { recursive: true, force: true });
      removed++;
    }
  say(`${o.dryRun ? "Would remove" : "Removed"} ${removed} skill${removed === 1 ? "" : "s"}.`);
  return { removed };
}

export async function list(o) {
  const say = o.log ?? console.log;
  const skills = loadSkills();
  for (const t of targets(o)) {
    say(`${t.agent}: ${t.dir}`);
    for (const s of skills)
      say(
        `  ${s.name}: ${{ new: "not installed", ours: "installed", changed: "there, but not from Pipeup or changed" }[await stateOf(t.dir, s.name)]}`,
      );
  }
}
