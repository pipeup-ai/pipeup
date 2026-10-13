import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const root = new URL("../../../../", import.meta.url).pathname;
const NAMES = [
  "pipeup-add",
  "pipeup-apply",
  "pipeup-integrate",
  "pipeup-send-to-git-setup",
  "pipeup-summarise",
];

async function pipeup(home: string, args: string[], cwd = home) {
  const { stdout } = await run("node", [cli, "skills", ...args], {
    env: { ...process.env, PIPEUP_SKILLS_HOME: home },
    cwd,
  });
  return stdout;
}
const skillFile = (home: string, agent: ".claude" | ".agents", name: string) =>
  join(home, agent, "skills", name, "SKILL.md");

describe("pipeup skills install", () => {
  it("says what it will write and writes nothing without a yes (or with --dry-run)", async () => {
    const home = await mkdtemp(join(tmpdir(), "pipeup-skills-"));
    const out = await pipeup(home, ["install"]);
    expect(out).toContain("will be written to");
    expect(out).toContain("Nothing written");
    await pipeup(home, ["install", "--yes", "--dry-run"]);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });

  it("puts every skill where Claude Code and Codex look, each with a marker", async () => {
    const home = await mkdtemp(join(tmpdir(), "pipeup-skills-"));
    await pipeup(home, ["install", "--yes"]);
    for (const n of NAMES) {
      expect(existsSync(skillFile(home, ".claude", n))).toBe(true);
      expect(readFileSync(skillFile(home, ".agents", n), "utf8")).toBe(
        readFileSync(skillFile(home, ".claude", n), "utf8"),
      );
      expect(existsSync(join(home, ".claude", "skills", n, ".pipeup-installed"))).toBe(true);
    }
    expect(await pipeup(home, ["list"])).toContain("pipeup-add: installed");
  });

  it("can write for one agent, or for this project only", async () => {
    const home = await mkdtemp(join(tmpdir(), "pipeup-skills-"));
    const project = await mkdtemp(join(tmpdir(), "pipeup-project-"));
    await pipeup(home, ["install", "--yes", "--agent", "codex"]);
    expect(existsSync(join(home, ".claude"))).toBe(false);
    expect(existsSync(skillFile(home, ".agents", "pipeup-add"))).toBe(true);
    await pipeup(home, ["install", "--yes", "--project"], project);
    expect(existsSync(skillFile(project, ".claude", "pipeup-add"))).toBe(true);
  });

  it("updates its own skills, but leaves one you changed unless told to replace it", async () => {
    const home = await mkdtemp(join(tmpdir(), "pipeup-skills-"));
    await pipeup(home, ["install", "--yes"]);
    const mine = skillFile(home, ".claude", "pipeup-add");
    await writeFile(mine, "my own version\n");
    const out = await pipeup(home, ["install", "--yes"]);
    expect(out).toContain("kept yours");
    expect(await readFile(mine, "utf8")).toBe("my own version\n");
    await pipeup(home, ["install", "--yes", "--replace"]);
    expect(await readFile(mine, "utf8")).toContain("Add Pipeup to this page");
  });

  it("removes only what it installed", async () => {
    const home = await mkdtemp(join(tmpdir(), "pipeup-skills-"));
    await pipeup(home, ["install", "--yes"]);
    await writeFile(skillFile(home, ".claude", "pipeup-apply"), "mine\n");
    await pipeup(home, ["remove"]);
    expect(existsSync(skillFile(home, ".claude", "pipeup-add"))).toBe(false);
    expect(existsSync(skillFile(home, ".agents", "pipeup-add"))).toBe(false);
    expect(existsSync(skillFile(home, ".claude", "pipeup-apply"))).toBe(true);
  });
});

describe("the skills, the plugin and the package agree", () => {
  const version = JSON.parse(readFileSync(join(root, "libs/ts/pipeup/package.json"), "utf8"))
    .version as string;
  const sources = readdirSync(join(root, "apps/agent-skills")).filter((n) => n.startsWith("pipeup-"));

  it("the plugin carries exactly the skills' text", () => {
    expect(readdirSync(join(root, "plugins/pipeup/skills")).sort()).toEqual(sources.sort());
    for (const n of sources)
      expect(readFileSync(join(root, "plugins/pipeup/skills", n, "SKILL.md"), "utf8")).toBe(
        readFileSync(join(root, "apps/agent-skills", n, "SKILL.md"), "utf8"),
      );
  });

  it("every skill says which Pipeup version it was written for, and it is this one", () => {
    for (const n of sources)
      expect(readFileSync(join(root, "apps/agent-skills", n, "SKILL.md"), "utf8")).toContain(
        `Written for Pipeup ${version}`,
      );
  });

  it("the plugin is listed in the marketplace and has this version", () => {
    const market = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
    expect(market.plugins.map((p: { name: string }) => p.name)).toContain("pipeup");
    expect(
      JSON.parse(readFileSync(join(root, "plugins/pipeup/.claude-plugin/plugin.json"), "utf8")).version,
    ).toBe(version);
  });
});
