import { execFile, spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openMenu, stubClipboard } from "./helpers";

// The shell link, for real: the script that ships in the add-on's dist, run with this computer's bash, nc and openssl.
const script = new URL("../agents/dist/pipeup-link.sh", import.meta.url).pathname;
const core = new URL("../../pipeup/dist/pipeup.min.js", import.meta.url).pathname;
const agents = new URL("../agents/dist/agents.min.js", import.meta.url).pathname;
const DOC = 'data-pipeup-doc="aShElLlInK000001:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"';

const html = `<!doctype html>
<html lang="en" ${DOC}>
<head><meta charset="utf-8"><title>Lisbon, 23–26 Oct</title></head>
<body><main><p id="p1">Saturday: brunch at 11, then the market.</p></main>
<script src="pipeup.min.js"></script><script src="agents.min.js"></script></body></html>`;

const children: ChildProcess[] = [];
test.afterEach(() => {
  for (const c of children.splice(0)) c.kill();
});
test.beforeEach(async ({ page }) => stubClipboard(page));
test.skip(process.platform === "win32", "the bash script is for macOS and Linux");

async function folder() {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-shell-"));
  const file = join(dir, "lisbon.html");
  await writeFile(file, html);
  await copyFile(core, join(dir, "pipeup.min.js"));
  await copyFile(agents, join(dir, "agents.min.js"));
  return { dir, file, url: `file://${file}` };
}

/** Starts the shell link for the page, and resolves once its link file is next to the page. */
async function startLink(file: string): Promise<ChildProcess> {
  const child = spawn("bash", [script, file], { detached: true });
  children.push(child);
  const linkFile = file.replace(/html$/, "link.js");
  await expect.poll(() => existsSync(linkFile), { timeout: 5000 }).toBe(true);
  return child;
}

const reply = (file: string, block: string) =>
  new Promise<string>((ok, no) => {
    const p = execFile("bash", [script, "reply", file], (e, _out, err) => (e ? no(e) : ok(err)));
    p.stdin!.end(block);
  });

const comment = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const w = window as any;
    const pu = await w.Pipeup.mount();
    return pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("#p1"), document.body),
      "Can we make this 11:30?",
    );
  });

const repliesIn = (page: Page, id: string): Promise<string[]> =>
  page.evaluate(
    (t) =>
      (window as any).Pipeup.mount().then((pu: any) =>
        pu.document
          .threads()
          .find((x: any) => x.id === t)
          .root.replies.map((r: any) => r.text),
      ),
    id,
  );

const share = (page: Page) => page.getByRole("menuitemcheckbox", { name: "Share with my agent" });

test("the page finds a running shell link, shares only once switched on, and tagged replies appear by themselves", async ({
  page,
}) => {
  const { file, url } = await folder();
  await page.goto(url);
  const id = await comment(page);
  await startLink(file);

  // The page finds the link file next to it by itself; the switch is off.
  await openMenu(page);
  await expect(share(page)).toHaveAttribute("aria-checked", "false", { timeout: 10000 });
  const json = file.replace(/html$/, "comments.json");
  expect(existsSync(json)).toBe(false);

  // On: the comments, and this session's key, arrive next to the page.
  await share(page).click();
  await expect(share(page)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => existsSync(json)).toBe(true);
  const sent = JSON.parse(await readFile(json, "utf8"));
  expect(sent.session).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(sent.open.markdown).toContain(id);

  // The agent answers through the script; the reply goes in with no click, as pasted by Ada.
  const said = await reply(
    file,
    `Done.\n\`\`\`pipeup-replies\nagent: Claude\nthread: ${id}\nreply: Moved brunch to 11:30 on Saturday.\naddressed: Changed in Saturday's plan\n\`\`\`\n`,
  );
  expect(said).toMatch(/tagged for this session/);
  await expect
    .poll(() => repliesIn(page, id), { timeout: 12000 })
    .toEqual(["Moved brunch to 11:30 on Saturday."]);

  // Read again later (the file is read every few seconds), the same reply isn't added twice.
  await page.waitForTimeout(5000);
  expect(await repliesIn(page, id)).toHaveLength(1);
});

test("replies the page can't match to this session wait for the person", async ({ page }) => {
  const { file, url } = await folder();
  await page.goto(url);
  const id = await comment(page);
  await startLink(file);
  // Written before sharing was ever switched on, so untagged.
  const said = await reply(
    file,
    `\`\`\`pipeup-replies\nagent: Claude\nthread: ${id}\nreply: Brunch is at 11:30 now.\n\`\`\``,
  );
  expect(said).toMatch(/asks the person/);

  await openMenu(page);
  const waiting = page.getByRole("menuitem", { name: /Replies from Claude/ });
  await expect(waiting).toBeVisible({ timeout: 10000 });
  expect(await repliesIn(page, id)).toEqual([]);
  await waiting.click();
  const add = page.getByRole("button", { name: "Add 1 reply" });
  await expect(add).toBeVisible();
  await add.click();
  await expect.poll(() => repliesIn(page, id)).toEqual(["Brunch is at 11:30 now."]);
});

test("when the link stops, its file goes, the switch goes, and the page says so", async ({ page }) => {
  const { file, url } = await folder();
  await page.goto(url);
  await comment(page);
  const child = await startLink(file);
  await openMenu(page);
  await share(page).click({ timeout: 10000 });
  await expect(share(page)).toHaveAttribute("aria-checked", "true");
  process.kill(-child.pid!, "SIGTERM");
  await expect.poll(() => existsSync(file.replace(/html$/, "link.js"))).toBe(false);
  await expect(page.getByText("The link to your agent stopped")).toBeVisible({ timeout: 10000 });
  // The row eases out of the open menu.
  await expect(share(page)).toHaveCount(0);
});
