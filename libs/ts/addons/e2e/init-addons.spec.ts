import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const cli = new URL("../../pipeup/cli/pipeup.mjs", import.meta.url).pathname;
const dist = (f: string) => new URL(`../../pipeup/dist/${f}`, import.meta.url).pathname;
const VERSION = JSON.parse(await readFile(new URL("../../pipeup/package.json", import.meta.url), "utf8"))
  .version as string;

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Q3 plan</title>
  </head>
  <body>
    <nav><h2>Menu</h2></nav>
    <h1>Q3 plan for Sam's team</h1>
    <section>
      <h2>New onboarding flow</h2>
      <p>We will ship the flow.</p>
    </section>
    <h2 data-pipeup-id="kept">Already named</h2>
    <img src="charts/revenue-by-month.png" alt="Revenue by month" />
    <table><tr><td>Lee</td></tr></table>
  </body>
</html>
`;

/** A fresh copy of a page in its own folder. */
async function page(html = PAGE): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-init-"));
  const file = join(dir, "page.html");
  await writeFile(file, html);
  return file;
}

/** Runs `pipeup init` with these arguments, answering from `input` a line at a time. */
function run(args: string[], input = "", env: Record<string, string> = {}) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn("node", [cli, "init", ...args], { env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
    child.stdin.end(input);
  });
}

// `pipeup init` with add-ons: these need dist/addons.json, which the add-ons build writes into the pipeup package.
test.describe.configure({ mode: "parallel" });

test("--addon adds it pinned, says what it sends, and starts the add-on list with those the page already loads", async () => {
  const table = JSON.parse(await readFile(dist("addons.json"), "utf8"));
  const withShare = PAGE.replace(
    "  </body>",
    '    <script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.7.0/dist/share.min.js"></script>\n  </body>',
  );
  const file = await page(withShare);
  const r = await run([file, "--yes", "--addon", "emoji"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain(`What it sends: ${table.emoji.says}`);
  const html = await readFile(file, "utf8");
  expect(html).toContain(
    `<script src="https://cdn.jsdelivr.net/npm/@pipeup/emoji@${VERSION}/dist/emoji.min.js" integrity="${table.emoji.integrity}" crossorigin="anonymous"></script>`,
  );
  expect(html).toContain('data-pipeup-addons="share,emoji"');
  // Pipeup first, then the add-on.
  expect(html.indexOf("pipeup.min.js")).toBeLessThan(html.indexOf("emoji.min.js"));
});
test("an add-on that needs something asks for it, or with --yes says what to pass; a wrong value is refused", async () => {
  const file = await page();
  const refused = await run([file, "--yes", "--addon", "inbox"]);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain(
    "the inbox add-on needs the address of your inbox service (https://…); pass it with --inbox <value>",
  );
  const wrong = await run([file, "--yes", "--addon", "github", "--github-repo", "not a repo"]);
  expect(wrong.code).toBe(2);
  expect(await readFile(file, "utf8")).toBe(PAGE);
  const asked = await run([file, "--addon", "inbox"], "https://inbox.example.test\ny\nq\n");
  expect(asked.out).toContain("The inbox add-on needs the address of your inbox service");
  const html = await readFile(file, "utf8");
  expect(html).toContain('data-pipeup-inbox="https://inbox.example.test"');
  expect(html).toContain('data-pipeup-addons="inbox"');
  const unknown = await run([file, "--yes", "--addon", "nope"]);
  expect(unknown.code).toBe(2);
  expect(unknown.err).toContain('there is no add-on called "nope"');
});
test("--agent lists this computer's agent and adds the agents add-on; with no agent it says to make one", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-agent-"));
  const keyfile = join(dir, "agent.json");
  const file = await page();
  const none = await run([file, "--yes", "--agent"], "", { PIPEUP_AGENT_FILE: keyfile });
  expect(none.code).toBe(2);
  expect(none.err).toContain("run `pipeup agent` first");
  await writeFile(keyfile, JSON.stringify({ name: "Claude", publicKey: "AgentKey123" }));
  const r = await run([file, "--yes", "--agent"], "", { PIPEUP_AGENT_FILE: keyfile });
  expect(r.code).toBe(0);
  const html = await readFile(file, "utf8");
  expect(html).toContain('data-pipeup-agents="AgentKey123"');
  expect(html).toContain("/@pipeup/agents@");
});
