import { execFile, spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { openMenu, stubClipboard } from "./helpers";

const run = promisify(execFile);
const cli = new URL("../../pipeup/cli/pipeup.mjs", import.meta.url).pathname;
const dist = new URL("../../pipeup/dist/pipeup.min.js", import.meta.url).pathname;
const agents = new URL("../agents/dist/agents.min.js", import.meta.url).pathname;
const DOC = 'data-pipeup-doc="aLiNkFiXtUrE0001:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"';

const html = `<!doctype html>
<html lang="en" ${DOC}>
<head><meta charset="utf-8"><title>Brief</title></head>
<body><main><p id="p1">The plan promises a 20% lift in the first quarter.</p></main>
<script src="pipeup.min.js"></script><script src="agents.min.js"></script></body></html>`;

const children: ChildProcess[] = [];
test.afterEach(() => {
  for (const c of children.splice(0)) c.kill();
});

async function start() {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-link-"));
  const env = { ...process.env, PIPEUP_AGENT_FILE: join(dir, "agent.json") };
  const file = join(dir, "brief.html");
  await writeFile(file, html);
  await copyFile(dist, join(dir, "pipeup.min.js"));
  await copyFile(agents, join(dir, "agents.min.js"));
  const pipeup = (...args: string[]) => run("node", [cli, ...args], { env });
  const child = spawn("node", [cli, "watch", file, "--agent", "Claude"], { env });
  children.push(child);
  const url = await new Promise<string>((ok, no) => {
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
      const m = /Open this page: (\S+)/.exec(out);
      if (m) ok(m[1]!);
    });
    child.on("error", no);
    child.on("exit", () => no(new Error(`watch ended: ${out}`)));
  });
  return { dir, file, url, child, pipeup };
}

const comment = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const w = window as any;
    const pu = await w.Pipeup.mount();
    return pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("#p1"), document.body),
      "Is 20% realistic?",
    );
  });

const share = (page: Page) => page.getByRole("menuitemcheckbox", { name: "Share with my agent" });

test.beforeEach(async ({ page }) => stubClipboard(page));

test("sharing is off until the person switches it on; then the agent reads and answers without a browser", async ({
  page,
}) => {
  const { file, url, pipeup } = await start();
  await page.goto(url);
  const id = await comment(page);

  // Off on load: nothing has been shared, and the menu says what the switch does.
  await openMenu(page);
  await expect(share(page)).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".menu .sec").getByText("Claude can answer comments here")).toBeVisible();
  expect(existsSync(file.replace(/html$/, "comments.json"))).toBe(false);
  await expect(pipeup("comments", file)).rejects.toThrow(/nothing is shared/);

  // On: the agent reads the comment with one command.
  await share(page).click();
  await expect(share(page)).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".menu .sec").getByText("Sharing comments with Claude")).toBeVisible();
  await expect.poll(async () => (await pipeup("comments", file)).stdout).toContain(`- **Thread:** ${id}`);
  const data = JSON.parse((await pipeup("comments", file, "--json")).stdout);
  expect(data.threads[0]).toMatchObject({ id, state: "open" });

  // It answers; the reply reaches the open page by itself, and the agent sees the person's resolve.
  await pipeup("reply", "--page", file, "--thread", id, "Changed it to 15 to 20%.", "--addressed", "done");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".bub")).toHaveCount(1);
  await page.locator(".bub").first().dispatchEvent("click");
  await expect(page.locator(".pop .rps .it .tx")).toHaveText("Changed it to 15 to 20%.", { timeout: 12000 });
  await page.locator(".pop .adr").getByRole("button", { name: "Resolve" }).click();
  await expect
    .poll(async () => JSON.parse((await pipeup("comments", file, "--all", "--json")).stdout).threads[0].state)
    .toBe("resolved");
});

test("switching it off stops sending at once", async ({ page }) => {
  const { file, url, pipeup } = await start();
  await page.goto(url);
  await comment(page);
  await openMenu(page);
  await share(page).click();
  await expect.poll(async () => (await pipeup("comments", file)).stdout).toContain("Is 20% realistic?");
  await share(page).click();
  await expect(share(page)).toHaveAttribute("aria-checked", "false");
  await page.evaluate(async () => {
    const w = window as any;
    await (
      await w.Pipeup.mount()
    ).document.comment(
      w.Pipeup.describeElement(document.querySelector("#p1"), document.body),
      "Second thought",
    );
  });
  await page.waitForTimeout(800);
  expect((await pipeup("comments", file)).stdout).not.toContain("Second thought");
});

test("if the link goes away the page says so, and the comments stay", async ({ page }) => {
  const { url, child } = await start();
  await page.goto(url);
  await comment(page);
  await openMenu(page);
  await share(page).click();
  await expect(share(page)).toHaveAttribute("aria-checked", "true");
  child.kill();
  await page.evaluate(async () => {
    const w = window as any;
    await (
      await w.Pipeup.mount()
    ).document.comment(
      w.Pipeup.describeElement(document.querySelector("#p1"), document.body),
      "After it stopped",
    );
  });
  await expect(share(page)).toHaveAttribute("aria-checked", "false", { timeout: 5000 });
  expect(
    await page.evaluate(() => (window as any).Pipeup.comments().then((c: any) => c.threads.length)),
  ).toBe(2);
});

test("only the page it serves is answered: wrong host, wrong origin, other paths and escapes are refused", async ({
  page,
}) => {
  const { url } = await start();
  await page.goto(url);
  const base = await page.evaluate(() => document.documentElement.getAttribute("data-pipeup-link")!);
  const u = new URL(url);
  const ask = (path: string, headers: Record<string, string>, method = "POST") =>
    new Promise<number>((ok, no) => {
      const req = request({ host: "127.0.0.1", port: u.port, path, method, headers, agent: false }, (res) => {
        res.resume();
        ok(res.statusCode!);
      });
      req.on("error", (e) => no(new Error(`${method} ${path} ${JSON.stringify(headers)}: ${e.message}`)));
      req.end('{"v":1,"open":{"threads":[]},"all":{"threads":[]}}');
    });
  const good = { host: u.host, origin: u.origin, "content-type": "application/json" };
  expect(await ask(`${base}/comments`, { ...good, origin: "https://evil.test" })).toBe(403);
  expect(await ask(`${base}/comments`, { ...good, origin: "" })).toBe(403);
  expect(await ask(`${base}/comments`, { ...good, host: "evil.test" })).toBe(403);
  expect(await ask(`/__pipeup/wrongsecretwrongsecret/comments`, good)).toBe(404);
  expect(await ask("/..%2f..%2f..%2fetc%2fpasswd", good, "GET")).toBe(404);
  expect(await ask(`${base}/comments`, good)).toBe(204);
});

test("a page not shown through a link has no switch", async ({ page }) => {
  const { dir } = await start();
  await page.goto(`file://${join(dir, "brief.html")}`);
  await comment(page);
  await openMenu(page);
  await expect(share(page)).toHaveCount(0);
});
