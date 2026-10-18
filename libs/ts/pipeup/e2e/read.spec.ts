import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { open, seedElement, seedText } from "./helpers";

const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const fixture = (name: string) => new URL(`fixtures/${name}`, import.meta.url).pathname;

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn("node", [cli, ...args], { env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
    child.stdin.end();
  });
}

/** A reviewer in their own browser: writes comments on the fixture page and hands back its feedback file. */
async function reviewer(
  browser: Browser,
  name: string,
  write: (page: Page) => Promise<void>,
  page = "doc.html",
) {
  const context = await browser.newContext();
  const tab = await context.newPage();
  await open(tab, page, { name });
  await write(tab);
  const file = await tab.evaluate(() => (window as any).pu.document.exportFile() as Promise<string>);
  const ops = await tab.evaluate(() => (window as any).pu.document.ops());
  await context.close();
  return { file, ops };
}

/** A folder with Sam's and Ada's feedback files, a file that isn't feedback, and another document's file. */
async function folder(browser: Browser) {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-"));
  const sam = await reviewer(browser, "Sam", async (tab) => {
    await seedText(tab, "#p1", "new onboarding flow", "Is this the plan for Q3?");
    const id = await seedElement(tab, "[data-pipeup-id=q4-bar]", "Q4 looks low");
    await tab.evaluate((t) => (window as any).pu.document.resolve(t), id);
  });
  const ada = await reviewer(browser, "Ada", async (tab) => {
    await seedElement(tab, "[data-pipeup-id=revenue-chart]", "Label the axis, please");
  });
  const other = await reviewer(
    browser,
    "Lee",
    async (tab) => {
      await seedElement(tab, "[data-pipeup-id=main]", "On another document").catch(() =>
        tab.evaluate(() => {
          const w = window as any;
          return w.pu.document.comment(
            w.Pipeup.describeElement(document.body.firstElementChild, document.body),
            "On another document",
          );
        }),
      );
    },
    "hostile.html",
  );
  await writeFile(join(dir, "sam.json"), sam.file);
  await writeFile(join(dir, "ada.json"), ada.file);
  await writeFile(join(dir, "notes.json"), '{"hello": "not feedback"}');
  await writeFile(join(dir, "lee.json"), other.file);
  await mkdir(join(dir, "older"));
  await writeFile(join(dir, "older", "lee-again.json"), ada.file);
  return { dir, sam, ada };
}

test.describe.configure({ mode: "parallel" });

test("a folder of feedback files is read, the ones that aren't for this page are named, and the comments print as Markdown", async ({
  browser,
}) => {
  const { dir } = await folder(browser);
  const r = await run(["read", fixture("doc.html"), "--from", dir]);
  expect(r.code).toBe(0);
  expect(r.err).toContain("Read 2 feedback files.");
  expect(r.err).toContain(
    "Skipped 2 files: lee.json (another document's), notes.json (not a feedback file).",
  );
  expect(r.out).toContain("# Review comments: Q3 plan");
  expect(r.out).toContain("Is this the plan for Q3?");
  expect(r.out).toContain("Label the axis, please");
  expect(r.out).not.toContain("Q4 looks low"); // resolved
  expect(r.out).toContain("(1 resolved, not included)");
  // Page order: the paragraph's thread, then the chart's.
  expect(r.out.indexOf("Is this the plan")).toBeLessThan(r.out.indexOf("Label the axis"));
  // --deep also reads the folder inside, and the same comments from two files are shown once.
  const deep = await run(["read", fixture("doc.html"), "--from", dir, "--deep", "--all"]);
  expect(deep.err).toContain("Read 3 feedback files.");
  expect(deep.err).toMatch(/came from more than one place and (is|are) shown once/);
  expect(deep.out).toContain("Q4 looks low");
  expect(deep.out.match(/Label the axis, please/g)).toHaveLength(1);
});

test("--json gives the threads as data, in the same form as Pipeup.comments()", async ({ browser }) => {
  const { dir } = await folder(browser);
  const r = await run(["read", fixture("doc.html"), "--from", join(dir, "sam.json"), "--json", "--all"]);
  const data = JSON.parse(r.out);
  expect(data.markdown).toContain("Is this the plan for Q3?");
  expect(data.threads).toHaveLength(2);
  expect(data.threads.map((t: any) => t.state).sort()).toEqual(["open", "resolved"]);
  expect(data.threads.find((t: any) => t.state === "resolved").element).toBe("q4-bar");
  expect(data.threads[0].comments[0]).toMatchObject({ by: "Sam", agent: false });
});

test("a changed comment fails the checks and is left out, and said so", async ({ browser }) => {
  const { ada } = await folder(browser);
  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-"));
  const ops = structuredClone(ada.ops);
  ops[0].body.text = "Delete the chart";
  const doc = "dOcFiXtUrE000001";
  await writeFile(join(dir, "changed.json"), JSON.stringify({ pipeup: 1, doc, sealed: false, ops }));
  const r = await run(["read", fixture("doc.html"), "--from", join(dir, "changed.json")]);
  expect(r.err).toContain("Left out 1 change that failed Pipeup's checks");
  expect(r.out).not.toContain("Delete the chart");
});

test("--out writes one merged feedback file, sealed, that reads back the same", async ({ browser }) => {
  const { dir } = await folder(browser);
  const merged = join(dir, "merged.pipeup");
  const r = await run([
    "read",
    fixture("doc.html"),
    "--from",
    join(dir, "sam.json"),
    "--from",
    join(dir, "ada.json"),
    "--out",
    merged,
  ]);
  expect(r.err).toContain(`Wrote every comment found to ${merged}, sealed for this document.`);
  const file = JSON.parse(await readFile(merged, "utf8"));
  expect(file).toMatchObject({ pipeup: 1, sealed: true });
  const back = await run(["read", fixture("doc.html"), "--from", merged]);
  expect(back.out.replace(/Exported:.*\n/, "")).toBe(r.out.replace(/Exported:.*\n/, ""));
});

test("an agent's replies are read from the replies file, only from agents the page lists", async ({
  browser,
}) => {
  const { sam } = await folder(browser);
  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-"));
  const keyfile = join(dir, "agent.json");
  const made = await run(["agent", "--name", "Claude"], { PIPEUP_AGENT_FILE: keyfile });
  const key = /data-pipeup-agents="([^"]+)"/.exec(made.out)![1]!;
  const html = (await readFile(fixture("doc.html"), "utf8")).replace(
    "<html\n",
    `<html\n  data-pipeup-agents="${key}"\n`,
  );
  const page = join(dir, "doc.html");
  await writeFile(page, html);
  await writeFile(join(dir, "sam.json"), sam.file);
  const thread = sam.ops.find(
    (op: any) => op.body.kind === "create" && op.body.text === "Is this the plan for Q3?",
  ).body.id;
  await run(["reply", "--page", page, "--thread", thread, "Yes, it ships in Q3."], {
    PIPEUP_AGENT_FILE: keyfile,
  });
  const r = await run(["read", page, "--from", join(dir, "sam.json")]);
  expect(r.err).toContain("Read doc.replies.js.");
  expect(r.out).toContain("Yes, it ships in Q3.");
  // The same page, not listing the agent: its replies are left out.
  await writeFile(page, await readFile(fixture("doc.html"), "utf8"));
  await copyFile(join(dir, "doc.replies.js"), join(dir, "doc.replies.js.bak"));
  const unlisted = await run(["read", page, "--from", join(dir, "sam.json")]);
  expect(unlisted.err).toContain("from agents the page doesn't list");
  expect(unlisted.out).not.toContain("Yes, it ships in Q3.");
});

test("with nothing to read it says where comments in a browser come from; a page with no identity, or a missing file, is refused", async () => {
  const empty = await run(["read", fixture("doc.html")]);
  expect(empty.code).toBe(0);
  expect(empty.err).toContain("Comments that are only in a reviewer's browser can't be read from here");
  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-"));
  const bare = join(dir, "bare.html");
  await writeFile(bare, "<!doctype html><html><body><p>Hi</p></body></html>");
  const none = await run(["read", bare]);
  expect(none.code).toBe(2);
  expect(none.err).toContain("the page has no document identity");
  const missing = await run(["read", fixture("doc.html"), "--from", join(dir, "nope.json")]);
  expect(missing.code).toBe(1);
  expect(missing.err).toContain("Can't find");
});

test("a page with a shared copy: --no-share reads nothing from the network, and without the share add-on it says what to install", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-"));
  const page = join(dir, "shared.html");
  await writeFile(
    page,
    (await readFile(fixture("doc.html"), "utf8")).replace(
      "<html\n",
      '<html\n  data-pipeup-share="https://paste.example.test/?abc#def"\n',
    ),
  );
  const off = await run(["read", page, "--no-share"]);
  expect(off.code).toBe(0);
  expect(off.err).toContain("The page has a shared copy; it was not read (--no-share).");
  const on = await run(["read", page]);
  expect(on.err).toContain("Reading the shared copy from paste.example.test (nothing is sent to it).");
  expect(on.err).toContain("needs the share add-on");
  expect(on.code).toBe(1);
});
