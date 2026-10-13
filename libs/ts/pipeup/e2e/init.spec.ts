import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const dist = (f: string) => new URL(`../dist/${f}`, import.meta.url).pathname;
const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
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

const sri = async (f: string) =>
  `sha384-${createHash("sha384")
    .update(await readFile(f))
    .digest("base64")}`;
/** The page with every line init may add or change taken out: what is left must be the original, byte for byte. */
const untouched = (html: string) =>
  html
    .split("\n")
    .filter((l) => !/<script src="https:\/\/cdn\.jsdelivr\.net/.test(l))
    .join("\n")
    .replace(/ data-pipeup-[a-z-]+="[^"]*"/g, "");

test.describe.configure({ mode: "parallel" });

test("--dry-run says what it would change and changes nothing", async () => {
  const file = await page();
  const r = await run([file, "--dry-run"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain(
    `Add Pipeup ${VERSION} from the CDN, pinned to that version and its integrity hash.`,
  );
  expect(r.out).toContain("Give the page a document identity");
  expect(await readFile(file, "utf8")).toBe(PAGE);
});

test("--yes adds Pipeup pinned with its hash and a document identity, and leaves every other byte; again, it changes nothing", async () => {
  const file = await page();
  const r = await run([file, "--yes"]);
  expect(r.code).toBe(0);
  const html = await readFile(file, "utf8");
  expect(html).toContain(
    `    <script src="https://cdn.jsdelivr.net/npm/pipeup@${VERSION}/dist/pipeup.min.js" integrity="${await sri(dist("pipeup.min.js"))}" crossorigin="anonymous"></script>\n  </body>`,
  );
  expect(html).toMatch(/<html lang="en" data-pipeup-doc="[\w-]+:[\w-]+">/);
  expect(untouched(html)).toBe(untouched(PAGE));
  expect(r.out).toContain("--marks");
  const again = await run([file, "--yes"]);
  expect(again.out).toContain(`The page already uses Pipeup ${VERSION}.`);
  expect(again.out).toContain("The page keeps its document identity.");
  expect(again.out).toContain("Nothing to change.");
  expect(await readFile(file, "utf8")).toBe(html);
});

test("without --yes it asks, and an answer other than yes changes nothing", async () => {
  const file = await page();
  const r = await run([file], "no\n");
  expect(r.out).toContain("Go ahead? [y/N]");
  expect(r.out).toContain("Nothing changed.");
  expect(await readFile(file, "utf8")).toBe(PAGE);
});

test("--update moves an older page to this version; a newer page, or no --update, is left as it is", async () => {
  const old = PAGE.replace(
    "  </body>",
    '    <script src="https://cdn.jsdelivr.net/npm/pipeup@0.6.0/dist/pipeup.min.js" integrity="sha384-old" crossorigin="anonymous"></script>\n  </body>',
  ).replace('<html lang="en">', '<html lang="en" data-pipeup-doc="abc:def">');
  const file = await page(old);
  const told = await run([file, "--yes"]);
  expect(told.out).toContain(`The page uses Pipeup 0.6.0. Run this with --update to move it to ${VERSION}.`);
  expect(await readFile(file, "utf8")).toBe(old);
  const moved = await run([file, "--yes", "--update"]);
  expect(moved.out).toContain(`Move the page from Pipeup 0.6.0 to ${VERSION}.`);
  const html = await readFile(file, "utf8");
  expect(html).toContain(
    `pipeup@${VERSION}/dist/pipeup.min.js" integrity="${await sri(dist("pipeup.min.js"))}"`,
  );
  expect(html).toContain('data-pipeup-doc="abc:def"');
  expect(html.match(/<script/g)).toHaveLength(1);

  const newer = await page(old.replace("pipeup@0.6.0", "pipeup@99.0.0"));
  const r = await run([newer, "--yes", "--update"]);
  expect(r.out).toContain(`newer than this command's ${VERSION}; it is left as it is.`);
});

test("marks: each part is offered with what it was taken to be; accept, rename, skip and stop all work", async () => {
  const file = await page();
  // Go ahead; accept the first heading; rename the second; skip the image; stop.
  const r = await run([file], "y\n\nOnboarding Plan\ns\nq\n");
  expect(r.out).toContain('a heading "Q3 plan for Sam\'s team" → q3-plan-for-sams-team');
  expect(r.out).toContain('a heading "New onboarding flow" → new-onboarding-flow');
  expect(r.out).toContain("an image (revenue-by-month.png) → Revenue by month");
  expect(r.out).not.toContain("Menu"); // inside <nav>
  expect(r.out).not.toContain("Already named");
  expect(r.out).toContain("Marked 2 parts.");
  const html = await readFile(file, "utf8");
  expect(html).toContain('<h1 data-pipeup-id="q3-plan-for-sams-team">');
  expect(html).toContain('<h2 data-pipeup-id="onboarding-plan">New onboarding flow</h2>');
  expect(html).not.toContain("data-pipeup-label");
  expect(html).not.toContain("<table data-pipeup");
  // --marks on a page already set up goes straight to the marks; the ones taken aren't offered again.
  const more = await run([file, "--marks"], "\n\n");
  expect(more.out).not.toContain("q3-plan-for-sams-team");
  expect(await readFile(file, "utf8")).toContain('data-pipeup-label="Revenue by month" />');
});

test("slides are numbered in order", async () => {
  const deck = `<!doctype html>\n<html>\n<body>\n<section class="slide"><h1>One</h1></section>\n<section class="slide"><h1>Two</h1></section>\n</body>\n</html>\n`;
  const file = await page(deck);
  await run([file, "--yes"]);
  const r = await run([file, "--marks"], "\n\n\n\n");
  expect(r.out).toContain("slide 1 → slide 1");
  expect(r.out).toContain("slide 2 → slide 2");
  const html = await readFile(file, "utf8");
  expect(html).toContain('<section class="slide" data-pipeup-slide="1">');
  expect(html).toContain('<section class="slide" data-pipeup-slide="2">');
});

test("--offline puts Pipeup inside the page, and the page then runs Pipeup with no network", async ({
  page: tab,
}) => {
  const file = await page();
  const r = await run([file, "--yes", "--offline"]);
  expect(r.out).toContain("inside the page");
  const html = await readFile(file, "utf8");
  expect(html).not.toContain("cdn.jsdelivr.net");
  await tab.route(/^https?:/, (route) => route.abort());
  await tab.goto(pathToFileURL(file).href);
  await expect(tab.locator("pipeup-root")).toHaveCount(1);
  expect(await tab.evaluate(() => (window as any).Pipeup.VERSION)).toBe(VERSION);
  const withAddon = await run([await page(), "--yes", "--offline", "--addon", "emoji"]);
  expect(withAddon.code).toBe(2);
  expect(withAddon.err).toContain("add-ons can't be put inside the page yet");
});

test("a page with no <html> is refused (exit 2), and a file that can't be read is exit 1", async () => {
  const bare = await page("<p>Just words</p>\n");
  const r = await run([bare, "--yes"]);
  expect(r.code).toBe(2);
  expect(r.err).toContain("the page has no <html> element");
  const missing = await run([join(tmpdir(), "no-such-page-pipeup.html"), "--yes"]);
  expect(missing.code).toBe(1);
});
