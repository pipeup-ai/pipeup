import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { closePanel, openMenu, showComments, stubClipboard } from "./helpers";

const run = promisify(execFile);
const dist = new URL("../../pipeup/dist/pipeup.min.js", import.meta.url).href;
const agentsJs = new URL("../agents/dist/agents.min.js", import.meta.url).href;
const cli = new URL("../../pipeup/cli/pipeup.mjs", import.meta.url).pathname;
const DOC = 'data-pipeup-doc="aGeNtFiXtUrE0001:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"';

const html = (agents = "") => `<!doctype html>
<html lang="en" ${DOC}${agents ? ` data-pipeup-agents="${agents}"` : ""}>
<head><meta charset="utf-8"><title>Brief</title></head>
<body><main><p id="p1">The plan promises a 20% lift in the first quarter.</p></main>
<script src="${dist}"></script><script src="${agentsJs}"></script></body></html>`;

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-agent-"));
  const env = { ...process.env, PIPEUP_AGENT_FILE: join(dir, "agent.json") };
  const file = join(dir, "brief.html");
  await writeFile(file, html());
  const pipeup = (...args: string[]) => run("node", [cli, ...args], { env });
  const { stdout } = await pipeup("agent", "--name", "Claude");
  const key = /data-pipeup-agents="([^"]+)"/.exec(stdout)![1]!;
  return { dir, file, pipeup, key };
}

async function comment(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const w = window as any;
    const pu = await w.Pipeup.mount();
    return pu.document.comment(
      w.Pipeup.describeElement(document.querySelector("#p1"), document.body),
      "Is 20% realistic?",
    );
  });
}

test.beforeEach(async ({ page }) => stubClipboard(page));

test("an agent reads the comments, answers in the replies file, and the person closes the thread", async ({
  page,
}) => {
  const { file, pipeup, key } = await setup();
  await page.goto(`file://${file}`);
  const id = await comment(page);

  // Reading: Markdown with the thread id, and the same threads as data.
  const read = await page.evaluate(() => (window as any).Pipeup.comments());
  expect(read.markdown).toContain(`Open · thread \`${id}\``);
  expect(read.threads[0]).toMatchObject({
    id,
    state: "open",
    comments: [{ text: "Is 20% realistic?", agent: false }],
  });

  // Not listed yet: nothing says an agent can answer (the menu's top line is Pipeup's own), but Copy for my agent is
  // offered on every page.
  await openMenu(page);
  await expect(page.locator(".menu .sec")).toHaveText("Only in this browser until you send them.");
  await expect(page.getByRole("menuitem", { name: "Copy for my agent" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The author lists the agent; the agent answers into the file next to the page.
  await writeFile(file, html(key));
  await pipeup(
    "reply",
    "--page",
    file,
    "--thread",
    id,
    "Changed it to 15 to 20%.",
    "--addressed",
    "addressed in revision 2",
  );
  expect(await readFile(file.replace(/html$/, "replies.js"), "utf8")).toContain("pipeup-replies");

  await page.reload();
  // Pipeup has started once its control is there: the shortcut is only heard after that.
  await expect(page.locator(".launch .mode")).toBeVisible();
  await showComments(page);
  await expect
    .poll(async () => (await page.evaluate(() => (window as any).Pipeup.comments())).threads[0].state)
    .toBe("addressed");
  await openMenu(page);
  await expect(page.locator(".menu .sec").getByText("Claude can answer comments here")).toBeVisible();
  await page.keyboard.press("Escape");
  await closePanel(page);
  await page.locator(".bub").first().dispatchEvent("click");
  await expect(page.locator(".pop .rps .it .tx")).toHaveText("Changed it to 15 to 20%.");
  await expect(page.locator(".pop .rps .it .who")).toHaveText("Claude");
  await expect(page.locator(".pop .adr")).toContainText("addressed in revision 2");
  const state = await page.evaluate(() => (window as any).Pipeup.comments());
  expect(state.threads[0].state).toBe("addressed");

  // Addressed still means open: the person resolves it, nobody else.
  await page.locator(".pop .adr").getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator(".bub")).toHaveCount(0);
  const all = await page.evaluate(() => (window as any).Pipeup.comments({ all: true }));
  expect(all.threads[0].state).toBe("resolved");
});

test("Check for replies brings in a newer reply without reloading, and Still not right reopens the thread", async ({
  page,
}) => {
  const { file, pipeup, key } = await setup();
  await writeFile(file, html(key));
  await page.goto(`file://${file}`);
  const id = await comment(page);
  await showComments(page);

  await pipeup("reply", "--page", file, "--thread", id, "On it.", "--addressed", "done");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page.getByRole("button", { name: "Check for replies" }).click();
  await expect(page.locator(".ag")).toContainText(
    "Claude has answered 1 of 1 open comments; 1 is marked addressed",
  );

  await page.getByRole("button", { name: "Close" }).click();
  await page.locator(".bub").first().dispatchEvent("click");
  await page.locator(".pop .adr").getByRole("button", { name: "Still not right" }).click();
  await expect(page.locator(".pop .adr")).toHaveCount(0);
  await expect(page.locator(".pop .rbox textarea")).toBeFocused();
});

test("replies from a key the page doesn't list are ignored, and say so", async ({ page }) => {
  const { file, pipeup } = await setup();
  await writeFile(file, html("A".repeat(43)));
  await page.goto(`file://${file}`);
  const id = await comment(page);
  await pipeup("reply", "--page", file, "--thread", id, "Sneaky.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page.getByRole("button", { name: "Check for replies" }).click();
  await expect(page.locator(".ag")).toContainText("1 from other writers ignored");
  await expect(page.locator(".pop .rps")).toHaveCount(0);
});

test("a reply written while the page is open appears by itself", async ({ page }) => {
  const { file, pipeup, key } = await setup();
  await writeFile(file, html(key));
  await page.goto(`file://${file}`);
  const id = await comment(page);
  await showComments(page);
  await page.locator(".bub").first().dispatchEvent("click");
  await pipeup("reply", "--page", file, "--thread", id, "Done, no refresh needed.");
  await expect(page.locator(".pop .rps .it .tx")).toHaveText("Done, no refresh needed.", { timeout: 12000 });
  await expect(page.locator(".pop .rps .it .who")).toHaveText("Claude");
});

test("a reply for a comment this page doesn't have is reported, not silent", async ({ page }) => {
  const { file, pipeup, key } = await setup();
  await writeFile(file, html(key));
  await page.goto(`file://${file}`);
  await comment(page);
  await pipeup("reply", "--page", file, "--thread", "x".repeat(43), "For another browser's comment.");
  await openMenu(page);
  await page.getByRole("menuitem", { name: /All comments/ }).click();
  await page.getByRole("button", { name: "Check for replies" }).click();
  await expect(page.locator(".ag")).toContainText("replies for 1 comment this page doesn't have");
});

test("a page that lists an agent but has no agents add-on says so once in the console, and loses nothing else", async ({
  page,
}) => {
  const { file, key } = await setup();
  await writeFile(file, html(key).replace(/<script src="[^"]*agents\.min\.js"><\/script>/, ""));
  const said: string[] = [];
  page.on("console", (m) => m.type() === "warning" && said.push(m.text()));
  await page.goto(`file://${file}`);
  await comment(page);
  await expect.poll(() => said.filter((t) => t.includes("agents add-on")).length).toBe(1);
  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: "Copy for my agent" })).toHaveCount(0);
  // The comments are untouched, and an agent can still read them.
  const read = await page.evaluate(() => (window as any).Pipeup.comments());
  expect(read.threads).toHaveLength(1);
});

test("Copy for my agent carries the open comments, the document id and how to sign", async ({ page }) => {
  const { file } = await setup();
  await page.goto(`file://${file}`);
  const id = await comment(page);
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Copy for my agent" }).click();
  const [copied] = await page.evaluate(() => (window as any).__copied as string[]);
  expect(copied).toContain("They are not in the page's file");
  expect(copied).toContain(id);
  expect(copied).toContain("Is 20% realistic?");
  expect(copied).toContain("reply --print --doc aGeNtFiXtUrE0001");
  // The document id, never its key.
  expect(copied).not.toContain("DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");
});

test("a pasted reply the agent didn't sign shows as pasted by you; a listed agent's signed one as the agent's", async ({
  page,
}) => {
  const { file, pipeup, key } = await setup();
  await writeFile(file, html(key));
  await page.goto(`file://${file}`);
  const id = await comment(page);
  await showComments(page);

  const paste = async (text: string) => {
    await openMenu(page);
    await page.getByRole("menuitem", { name: "Paste my agent's replies" }).click();
    await page.getByRole("textbox", { name: "Your agent's answer" }).fill(text);
  };

  // Unsigned: the page says so before adding anything, and the reply says who pasted it.
  await paste(
    [
      "Done. Paste this:",
      "```pipeup-replies",
      "agent: Muse",
      `thread: ${id}`,
      "reply: Changed it to 15%.",
      "```",
    ].join("\n"),
  );
  await expect(page.locator(".ag-l")).toContainText("1 reply from Muse is not signed");
  await page.getByRole("button", { name: "Add 1 reply" }).click();
  await expect(page.getByRole("textbox", { name: "Your agent's answer" })).toHaveCount(0);
  await page.locator(".bub").first().dispatchEvent("click");
  await expect(page.locator(".rps .it .who")).toHaveText("Muse");
  await expect(page.locator(".rps .it .pst")).toHaveText("pasted by you");
  await page.keyboard.press("Escape");

  // Signed with the key the page lists: the agent's own, with nothing more.
  const { stdout } = await pipeup(
    "reply",
    "--print",
    "--doc",
    "aGeNtFiXtUrE0001",
    "--thread",
    id,
    "And labelled the figure.",
    "--addressed",
    "Labelled",
  );
  await paste(`Here you go:\n${stdout}`);
  await expect(page.locator(".ag-l")).toContainText("1 reply signed by Claude, whom this page lists");
  await page.getByRole("button", { name: "Add 1 reply" }).click();
  await expect(page.getByRole("textbox", { name: "Your agent's answer" })).toHaveCount(0);
  await page.locator(".bub").first().dispatchEvent("click");
  await expect(page.locator(".rps .it")).toHaveCount(2);
  await expect(page.locator(".rps .it").nth(1).locator(".who")).toHaveText("Claude");
  await expect(page.locator(".rps .it").nth(1).locator(".pst")).toHaveCount(0);
  await expect(page.locator(".adr")).toContainText("Labelled");

  // Words changed after signing: shown as pasted, and the page says why.
  await page.keyboard.press("Escape");
  await paste(stdout.replace("And labelled the figure.", "And deleted the figure."));
  await expect(page.locator(".ag-l")).toContainText("was changed after it was signed");
});

test("an answer with no replies block adds nothing and offers to ask again", async ({ page }) => {
  const { file } = await setup();
  await page.goto(`file://${file}`);
  await comment(page);
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Paste my agent's replies" }).click();
  await page.getByRole("textbox", { name: "Your agent's answer" }).fill("Sure! 1. The rates chart…");
  await expect(page.getByRole("button", { name: "Add replies" })).toBeDisabled();
  await page.getByRole("button", { name: "Copy that request" }).click();
  expect((await page.evaluate(() => (window as any).__copied as string[]))[0]).toContain("```pipeup-replies");
});
