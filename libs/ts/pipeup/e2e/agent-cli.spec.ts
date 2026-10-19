import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// An agent on the author's computer answers the first time (spec §15b, The commands an agent runs).

const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const DOC = "aGeNtClIfIxTr001:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const VIEWER = `<!doctype html>
<html lang="en" data-pipeup-doc="${DOC}">
  <head><meta charset="utf-8" /><title>Wiki</title></head>
  <body><main id="note"></main><script src="pipeup.min.js"></script></body>
</html>
`;

/** A wiki that shows its notes through one viewer page, with its own agent key file. */
async function wiki(html = VIEWER) {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-agent-"));
  await mkdir(join(dir, "wiki", "syntheses"), { recursive: true });
  await writeFile(join(dir, "wiki", "viewer.html"), html);
  await writeFile(join(dir, "wiki", "syntheses", "q3-plan.md"), "# Q3 plan\n\nWe launch in July.\n");
  return { dir, viewer: join(dir, "wiki", "viewer.html"), key: join(dir, "agent.json") };
}

/** Runs the command line in `dir` with no terminal attached, as an agent's shell does. */
function run(dir: string, key: string, args: string[]) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn("node", [cli, ...args], {
      cwd: dir,
      env: { ...process.env, PIPEUP_AGENT_FILE: key },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.stdin.end();
    child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
  });
}
const exists = (f: string) =>
  readFile(f).then(
    () => true,
    () => false,
  );
const answer = ["--thread", "t1", "Changed the links.", "--addressed", "Links updated"];

test("reply, given a note a viewer shows, writes nothing and names the page that runs Pipeup", async () => {
  const w = await wiki();
  const r = await run(w.dir, w.key, ["reply", "--page", "wiki/syntheses/q3-plan.md", ...answer]);
  expect(r.code).toBe(1);
  expect(r.err).toContain("wiki/syntheses/q3-plan.md doesn't run Pipeup, so nothing was written.");
  expect(r.err).toContain("--page wiki/viewer.html");
  expect(await exists(join(w.dir, "wiki", "syntheses", "q3-plan.replies.js"))).toBe(false);
});

test("reply writes where the page reads, says so, and before the agent is listed says how to list it", async () => {
  const w = await wiki();
  const unlisted = await run(w.dir, w.key, ["reply", "--page", "wiki/viewer.html", ...answer]);
  expect(unlisted.code).toBe(0);
  expect(unlisted.out).toContain("Wrote 2 entries to wiki/viewer.replies.js.");
  expect(unlisted.err).toContain("The page will ignore them until it lists");
  expect(unlisted.err).toContain("npx --yes pipeup@0 agent --page wiki/viewer.html --yes");
  expect(await readFile(join(w.dir, "wiki", "viewer.replies.js"), "utf8")).toContain('"kind":"addressed"');
  // Listed: it says the page will show them.
  await run(w.dir, w.key, ["agent", "--name", "Muse", "--page", "wiki/viewer.html", "--yes"]);
  const listed = await run(w.dir, w.key, ["reply", "--page", "wiki/viewer.html", ...answer]);
  expect(listed.out).toContain("Wrote 2 entries to wiki/viewer.replies.js.");
  expect(listed.out).toContain(
    "The page reads this file: the reply shows in its thread within a few seconds.",
  );
  expect(listed.err).not.toContain("will ignore");
});

test("reply writes to the file the page names for its replies", async () => {
  const w = await wiki(VIEWER.replace("<html ", '<html data-pipeup-replies="answers/wiki.replies.js" '));
  await mkdir(join(w.dir, "wiki", "answers"));
  const r = await run(w.dir, w.key, ["reply", "--page", "wiki/viewer.html", ...answer]);
  expect(r.out).toContain("Wrote 2 entries to wiki/answers/wiki.replies.js.");
  expect(await exists(join(w.dir, "wiki", "viewer.replies.js"))).toBe(false);
});

test("agent --page lists the agent only after a yes: where it can't ask it changes nothing, and it changes nothing else", async () => {
  const w = await wiki();
  const asked = await run(w.dir, w.key, ["agent", "--name", "Muse", "--page", "wiki/viewer.html"]);
  expect(asked.code).toBe(2);
  expect(asked.out).toContain("This adds one attribute on wiki/viewer.html, and changes nothing else:");
  expect(asked.out).toContain("data-pipeup-agents=");
  expect(asked.out).toContain("This shell can't ask, so nothing was changed.");
  expect(await readFile(w.viewer, "utf8")).toBe(VIEWER);

  const yes = await run(w.dir, w.key, ["agent", "--name", "Muse", "--page", "wiki/viewer.html", "--yes"]);
  expect(yes.code).toBe(0);
  expect(yes.out).toContain("Listed Muse on wiki/viewer.html.");
  const key = JSON.parse(await readFile(w.key, "utf8")).publicKey as string;
  const after = await readFile(w.viewer, "utf8");
  expect(after).toBe(
    VIEWER.replace(`data-pipeup-doc="${DOC}"`, `data-pipeup-doc="${DOC}" data-pipeup-agents="${key}"`),
  );

  const again = await run(w.dir, w.key, ["agent", "--page", "wiki/viewer.html", "--yes"]);
  expect(again.out).toContain("Muse is already listed on wiki/viewer.html; nothing was changed.");
  expect(await readFile(w.viewer, "utf8")).toBe(after);
});

test("agent --page refuses a file that doesn't run Pipeup, and options a release doesn't know are said, not fatal", async () => {
  const w = await wiki();
  const note = await run(w.dir, w.key, ["agent", "--page", "wiki/syntheses/q3-plan.md", "--yes"]);
  expect(note.code).toBe(1);
  expect(note.err).toContain("doesn't run Pipeup, so nothing was changed.");
  const r = await run(w.dir, w.key, ["agent", "--name", "Muse", "--colour", "teal"]);
  expect(r.code).toBe(0);
  expect(r.err).toContain("this release doesn't know --colour; carrying on without it");
  expect(r.out).toContain("Or list it in one step: npx --yes pipeup@0 agent --page <page.html>");
});
