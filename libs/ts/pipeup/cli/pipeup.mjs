#!/usr/bin/env node
// pipeup agent / pipeup reply: how an AI agent answers comments on a Pipeup page.
// The agent's key stays in ~/.pipeup/agent.json (owner-only) and never goes in the page or its folder.
import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { check, table } from "./check.mjs";
import { apply, htmlAttr, init, InitError, survey } from "./init.mjs";
import { read, ReadError } from "./read.mjs";
import { comments, watch } from "./link.mjs";
import * as skills from "./skills.mjs";

// The page library, loaded only by the commands that sign or read a page: `skills` and `comments` need nothing built.
const core = () => import("../dist/pipeup.core.js");

const KEYFILE = process.env.PIPEUP_AGENT_FILE || join(homedir(), ".pipeup", "agent.json");
const AI = "AI assistant";

const USAGE = `pipeup init <page.html> [--yes] [--dry-run] [--update] [--offline] [--addon <id>]… [--agent] [--marks]
  Adds Pipeup to the page: the script pinned to this version and its integrity hash, and a document identity if the
  page has none (never a new one for a page that has one). It says what it will change and asks first; every other
  byte stays as it was. --update moves a page to this version, --offline puts Pipeup inside the page, --addon adds an
  add-on (saying what it sends; one that needs something asks, or takes it as --inbox <url> or --github-repo owner/repo),
  --agent lists this computer's agent and adds the agents add-on. Then it offers stable names for the page's blocks,
  charts and slides, one at a time (--marks goes straight there; --yes skips it). Exit codes: 0 done, 1 a file
  failed, 2 the command needs something first.

pipeup read <page.html> [--from <file or folder>]… [--deep] [--all] [--json] [--no-share] [--out <file>]
  Prints the page's comments without opening it, as Markdown (like Copy comments › As Markdown) or, with --json, as data: from
  feedback files and folders of them (--deep looks in folders inside), the page's shared copy (with @pipeup/share
  installed; --no-share reads nothing from the network) and its replies file. Every comment is checked as the page
  checks it; what was read, skipped or left out is said on standard error. --out writes one merged feedback file.
  Exit codes: 0 done, 1 a source couldn't be read, 2 the command needs something first.

pipeup skills install|remove|list [--project] [--agent claude|codex|all] [--yes] [--replace] [--dry-run]
  Puts Pipeup's agent skills where Claude Code (.claude/skills) and Codex (.agents/skills) look: for you, in every
  project, or with --project for this folder only. It says what it will write, asks first (--yes to go ahead without
  asking), and never replaces a skill you changed unless you say --replace.

pipeup check <page.html> [--json]
  Loads the page with and without Pipeup at 375, 768 and 1440 px (with Playwright, which you install) and says what
  Pipeup changes or covers, and what the page could do better: pass, WARN or FAIL for each. Exits 1 on any FAIL.

pipeup agent [--name <name>] [--page <page.html>] [--yes]
  Makes this computer's agent key (once) and prints the public key to list on the page:
  <html data-pipeup-agents="<key>">. With --page it lists the agent on that page itself: it shows the one change and
  asks first (--yes to go ahead without asking; where it can't ask, it changes nothing and exits 2).

pipeup watch <page.html> [--agent <name>] [--port <number>]
  Shows the page from this computer, with a live link to the agent: the page offers "Share with my agent"
  (off until the person switches it on), and the agent is listed for this page while the link runs. It adds the
  agents add-on to the page it shows (the file is not changed), unless the page's Pipeup already has agent support
  (0.6.x), and refuses a page whose Pipeup is older than 0.6.

pipeup comments <page.html> [--all] [--json]
  Prints the comments the page has shared (open threads, or all with --all), as Markdown or, with --json, as data.

pipeup reply --page <file.html> --thread <id> "<words>" [--addressed "<short note>"]
  Writes a signed reply (and, with --addressed, an addressed note) where the page reads replies: <file>.replies.js
  next to the page, or the file the page names. The page is the HTML file that runs Pipeup, never a file it shows.
  It never resolves, reopens, edits or deletes anything: the author closes threads.

pipeup reply --print (--doc <document id> | --page <file.html>) --thread <id> "<words>" [--addressed "<short note>"]
  Prints the same signed reply as a replies block for the person to paste into the page (Paste my agent's replies),
  for an agent that can't write next to the page. Copy for my agent gives the document id. Nothing is written.

Agents run these as \`npx --yes pipeup@0 …\`: any release from 0.6 answers agent, reply and comments the same way.`;

/** How agents are told to run this command line: never stopping to ask, and any release npm will give. */
const RUN = "npx --yes pipeup@0";
/** A path as the person typed it, or relative to where they are. */
const shown = (file) => relative(process.cwd(), resolve(file)) || file;
const DOC = /<html\b[^>]*\sdata-pipeup-doc\s*=\s*["']([^"']+)["']/i;

/**
 * The options each agent command knows: one this release doesn't know is said, and the rest carry on (a newer
 * agent's command still works with an older release).
 */
const KNOWN = {
  agent: ["name", "page", "yes"],
  reply: ["page", "thread", "addressed", "print", "doc"],
  comments: ["all", "json"],
  watch: ["agent", "port"],
};
function unknown(command, args) {
  for (const k of Object.keys(args))
    if (k !== "_" && KNOWN[command] && !KNOWN[command].includes(k))
      console.warn(`pipeup: this release doesn't know --${k}; carrying on without it`);
}

/** The HTML file nearest to `file` (its folder, then the folders above) that runs Pipeup, or null. */
async function nearbyPage(file) {
  const self = resolve(file);
  let dir = dirname(self);
  for (let i = 0; i < 4; i++) {
    const names = await readdir(dir).catch(() => []);
    for (const n of names.filter((n) => /\.html?$/i.test(n)).sort()) {
      const p = join(dir, n);
      if (p !== self && DOC.test(await readFile(p, "utf8").catch(() => ""))) return p;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** `file` doesn't run Pipeup (a note a viewer shows, say): nothing is written, and the page nearby is named. */
async function notPipeup(file, what) {
  const near = await nearbyPage(file);
  console.error(`pipeup: ${shown(file)} doesn't run Pipeup, so ${what}.`);
  console.error(
    near
      ? `The page that shows it is probably ${shown(near)}:\n  --page ${shown(near)}`
      : "Pass the HTML page the comments were left on: --page <page.html>",
  );
  process.exit(1);
}

function fail(message) {
  console.error(`pipeup: ${message}`);
  process.exit(1);
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[a.slice(2)] = true;
      else ((out[a.slice(2)] = next), i++);
    } else out._.push(a);
  }
  return out;
}

const b64u = (bytes) => Buffer.from(bytes).toString("base64url");

async function loadAgent(name) {
  let saved = null;
  try {
    saved = JSON.parse(await readFile(KEYFILE, "utf8"));
  } catch {
    // none yet
  }
  if (!saved) {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    saved = {
      name: typeof name === "string" ? name : "Agent",
      publicKey: b64u(raw),
      privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
    };
    await mkdir(dirname(KEYFILE), { recursive: true, mode: 0o700 });
    await writeFile(KEYFILE, JSON.stringify(saved), { mode: 0o600 });
    await chmod(KEYFILE, 0o600);
  } else if (typeof name === "string" && name !== saved.name) {
    saved.name = name;
    await writeFile(KEYFILE, JSON.stringify(saved), { mode: 0o600 });
  }
  const privateKey = await crypto.subtle.importKey("jwk", saved.privateKey, { name: "Ed25519" }, false, [
    "sign",
  ]);
  return { identity: { publicKey: saved.publicKey, privateKey }, name: saved.name };
}

/** A name that shows it is an agent: "AI assistant · Claude". */
const signedName = (name) => (name && name !== AI ? `${AI} · ${name}`.slice(0, 80) : AI);

/** Reads a page: its text, or a plain failure when it can't be read. */
const readPage = (file) => readFile(file, "utf8").catch((e) => fail(`can't read ${file}: ${e.message}`));

async function pageDoc(file) {
  const html = await readPage(file);
  const m = DOC.exec(html);
  if (!m) await notPipeup(file, "nothing was written");
  const { id } = await (await core()).parseDocumentAttribute(m[1]);
  const listed = /<html\b[^>]*\sdata-pipeup-agents\s*=\s*["']([^"']*)["']/i.exec(html)?.[1] ?? "";
  // Where the page reads replies: the file it names (a path beside it), else <page>.replies.js.
  const given = /<html\b[^>]*\sdata-pipeup-replies\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  const local = given && !/^[a-z][\w+.-]*:|^\/\//i.test(given);
  if (given && !local)
    console.warn(
      `pipeup: the page reads replies from ${given}, which isn't a file here; writing next to the page`,
    );
  const replies = local
    ? resolve(dirname(file), given.split(/[?#]/)[0])
    : resolve(file.replace(/\.[^./\\]*$/, "") + ".replies.js");
  return { id, listed: listed.split(/[\s,]+/).filter(Boolean), replies };
}

const headerOf = (file) =>
  `// Replies to the comments on ${basename(file)}. Written by \`pipeup reply\`; safe to keep with the page.\n`;

async function readReplies(path, doc) {
  try {
    const text = await readFile(path, "utf8");
    const m = /push\((\{.*\})\);\s*$/m.exec(text);
    const file = m && JSON.parse(m[1]);
    return file && file.doc === doc && Array.isArray(file.ops) ? file.ops : [];
  } catch {
    return [];
  }
}

/** One entry of a replies block, signed: the person pastes it into the page, which checks it against the listed keys. */
function printBlock(name, thread, words, note, ops) {
  const field = (key, text) =>
    text
      .split("\n")
      .map((line, i) => (i ? `  ${line}` : `${key}: ${line}`))
      .join("\n");
  return [
    "```pipeup-replies",
    `agent: ${name}`,
    `thread: ${thread}`,
    field("reply", words),
    ...(note ? [field("addressed", note)] : []),
    `signed: ${b64u(new TextEncoder().encode(JSON.stringify(ops)))}`,
    "```",
  ].join("\n");
}

async function reply(args) {
  const page = args.page;
  const thread = args.thread;
  const words = args._[0]?.trim();
  const print = args.print === true;
  const given = typeof args.doc === "string" && print ? args.doc.trim() : "";
  if ((typeof page !== "string" && !given) || typeof thread !== "string" || !words)
    fail(`missing words, ${print ? "--doc" : "--page"} or --thread\n\n${USAGE}`);
  if (given && given.length > 64) fail("that isn't a document id");
  const note = typeof args.addressed === "string" ? args.addressed.trim() : "";
  const {
    id: doc,
    listed,
    replies: out,
  } = given ? { id: given, listed: null, replies: "" } : await pageDoc(page);
  const { identity, name } = await loadAgent();
  if (print) {
    let clock = Math.floor(Date.now() / 1000);
    let at = Date.now();
    const { computeOpId, signOp } = await core();
    const make = async (fields) => {
      const body = {
        v: 1,
        ...fields,
        id: "",
        doc,
        author: identity.publicKey,
        name: signedName(name),
        clock: clock++,
        at: at++,
      };
      body.id = await computeOpId(body);
      return signOp(body, identity);
    };
    const ops = [await make({ kind: "reply", thread, target: thread, text: words })];
    if (note) ops.push(await make({ kind: "addressed", thread, text: note }));
    if (listed && !listed.includes(identity.publicKey))
      console.error(
        `pipeup: this page doesn't list your key, so these replies will show as pasted by the person.\n  To be listed: <html data-pipeup-agents="${identity.publicKey}">`,
      );
    console.log(printBlock(name, thread, words, note, ops));
    return;
  }
  const linked = await readFile(page.replace(/\.[^./\\]*$/, "") + ".comments.json", "utf8").then(
    () => true,
    () => false,
  );
  const ops = await readReplies(out, doc);
  // Seconds since 1970: later than any counter a browser has kept, so these follow the thread they answer.
  let clock = Math.max(Math.floor(Date.now() / 1000), ...ops.map((o) => o.body.clock + 1));
  let at = Date.now();
  const make = async (fields) => {
    const body = {
      v: 1,
      ...fields,
      id: "",
      doc,
      author: identity.publicKey,
      name: signedName(name),
      clock: clock++,
      at: at++,
    };
    const { computeOpId, signOp } = await core();
    body.id = await computeOpId(body);
    return signOp(body, identity);
  };
  const added = [await make({ kind: "reply", thread, target: thread, text: words })];
  if (note) added.push(await make({ kind: "addressed", thread, text: note }));
  const file = { format: "pipeup-replies", v: 1, doc, ops: [...ops, ...added] };
  await writeFile(out, `${headerOf(page)}(globalThis.pipeupReplies ||= []).push(${JSON.stringify(file)});\n`);
  console.log(`Wrote ${added.length} ${added.length === 1 ? "entry" : "entries"} to ${shown(out)}.`);
  // Written either way, so nothing is lost: the page shows them once it lists the agent.
  if (!listed.includes(identity.publicKey) && !linked)
    console.warn(
      `The page will ignore them until it lists ${name || "your agent"}. Ask the page's author. After their yes, run:\n  ${RUN} agent --page ${shown(page)} --yes`,
    );
  else console.log("The page reads this file: the reply shows in its thread within a few seconds.");
}

/**
 * Lists the agent on a page: the one change (its key in data-pipeup-agents on <html>) is shown and asked about first;
 * --yes goes ahead. Where it can't ask (an agent's shell, with nobody to answer), nothing changes and it exits 2.
 */
async function listOn(page, identity, name, yes) {
  const html = await readPage(page);
  if (!DOC.test(html)) await notPipeup(page, "nothing was changed");
  const found = survey(html);
  const edit = htmlAttr(found, "data-pipeup-agents", identity.publicKey, { append: true });
  if (!edit) return console.log(`${name} is already listed on ${shown(page)}; nothing was changed.`);
  const next = apply(html, [{ ...edit, order: 0 }]);
  console.log(
    `\nThis ${edit.del ? `adds ${name}'s key to the page's agents` : "adds one attribute"} on ${shown(page)}, and changes nothing else:\n  ${survey(next).html.tag}\n`,
  );
  if (!yes) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(
        "This shell can't ask, so nothing was changed.\nAsk the page's author. After their yes, run it again with --yes.",
      );
      process.exitCode = 2;
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Add it? (y/N) ");
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) return console.log("Nothing was changed.");
  }
  await writeFile(page, next);
  console.log(`Listed ${name} on ${shown(page)}. Reload the page, and it shows ${name}'s replies.`);
}

const [command, ...rest] = process.argv.slice(2);
const args = flags(rest);
unknown(command, args);
if (command === "agent") {
  const { identity, name } = await loadAgent(args.name);
  console.log(`${name} (${KEYFILE})`);
  if (typeof args.page === "string") await listOn(args.page, identity, name, args.yes === true);
  else
    console.log(
      `\nList this key on the page:\n  <html data-pipeup-agents="${identity.publicKey}">\nOr list it in one step: ${RUN} agent --page <page.html>`,
    );
} else if (command === "reply") await reply(args);
else if (command === "skills") {
  const sub = args._[0];
  const opts = {
    agent: typeof args.agent === "string" ? args.agent : "all",
    project: args.project === true,
    yes: args.yes === true,
    replace: args.replace === true,
    dryRun: args["dry-run"] === true,
  };
  try {
    if (sub === "install" || sub === "update") await skills.install(opts);
    else if (sub === "remove") await skills.remove(opts);
    else if (sub === "list") await skills.list(opts);
    else fail(`skills: say install, remove or list\n\n${USAGE}`);
  } catch (e) {
    fail(e.message);
  }
} else if (command === "init") {
  const page = args._[0];
  if (!page) fail(`missing the page\n\n${USAGE}`);
  // --addon may be given more than once: read every one from the raw arguments.
  const addons = [];
  for (let i = 0; i < rest.length; i++)
    if (rest[i] === "--addon" && rest[i + 1] && !rest[i + 1].startsWith("--")) addons.push(rest[++i]);
  const values = {};
  for (const flag of ["inbox", "github-repo"]) if (typeof args[flag] === "string") values[flag] = args[flag];
  const yes = args.yes === true;
  const marks = args.marks === true;
  try {
    await init({
      page,
      yes,
      dryRun: args["dry-run"] === true,
      update: args.update === true,
      offline: args.offline === true,
      marks,
      agent: args.agent === true,
      addons,
      values,
      input: !yes || marks ? process.stdin : undefined,
    });
  } catch (e) {
    console.error(`pipeup: ${e.message}`);
    process.exit(e instanceof InitError ? e.code : 1);
  }
} else if (command === "read") {
  const page = args._[0];
  if (!page) fail(`missing the page\n\n${USAGE}`);
  const from = [];
  for (let i = 0; i < rest.length; i++)
    if (rest[i] === "--from" && rest[i + 1] && !rest[i + 1].startsWith("--")) from.push(rest[++i]);
  try {
    const { text, failed } = await read({
      page,
      from,
      deep: args.deep === true,
      all: args.all === true,
      json: args.json === true,
      share: args["no-share"] !== true,
      out: typeof args.out === "string" ? args.out : undefined,
      local: process.env.PIPEUP_SHARE_LOCAL === "1",
    });
    console.log(text);
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error(`pipeup: ${e.message}`);
    process.exit(e instanceof ReadError ? e.code : 1);
  }
} else if (command === "check") {
  const page = args._[0];
  if (!page) fail(`missing the page\n\n${USAGE}`);
  try {
    const { results, ok } = await check({ page });
    console.log(args.json === true ? JSON.stringify({ ok, results }, null, 2) : table(results));
    process.exit(ok ? 0 : 1);
  } catch (e) {
    fail(e.message);
  }
} else if (command === "comments") {
  const page = args._[0];
  if (!page) fail(`missing the page\n\n${USAGE}`);
  try {
    console.log(await comments({ page, all: args.all === true, json: args.json === true }));
  } catch (e) {
    fail(e.message);
  }
} else if (command === "watch") {
  const page = args._[0];
  if (!page) fail(`missing the page\n\n${USAGE}`);
  await pageDoc(page);
  const { identity, name } = await loadAgent(typeof args.agent === "string" ? args.agent : undefined);
  let link;
  try {
    link = await watch({
      page,
      agent: name,
      key: identity.publicKey,
      port: typeof args.port === "string" ? Number(args.port) : 0,
    });
  } catch (e) {
    fail(e.message);
  }
  console.log(`Open this page: ${link.url}\n`);
  console.log(
    `While this runs, ${name} is listed for the page and the page offers "Share with my agent" (off until you switch it on).`,
  );
  if (link.addon)
    console.log(
      link.support === "unknown"
        ? "It couldn't tell which Pipeup the page uses, so it adds the agents add-on to the page it shows (the add-on stays off on a Pipeup that already has agent support). The page's file is not changed."
        : "It adds the agents add-on to the page it shows. The page's file is not changed.",
    );
  else if (link.support === "builtin")
    console.log("This page's Pipeup (0.6) has agent support built in, so nothing is added to it.");
  console.log(
    `Read:  ${RUN} comments ${page}\nReply: ${RUN} reply --page ${page} --thread <id> "words" --addressed "note"\nStop:  Ctrl-C (comments stay in ${basename(link.sidecar)})`,
  );
  const stop = () => link.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else {
  console.log(USAGE);
  process.exit(command ? 1 : 0);
}
