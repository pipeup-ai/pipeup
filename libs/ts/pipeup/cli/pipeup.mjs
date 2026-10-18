#!/usr/bin/env node
// pipeup agent / pipeup reply: how an AI agent answers comments on a Pipeup page.
// The agent's key stays in ~/.pipeup/agent.json (owner-only) and never goes in the page or its folder.
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { check, table } from "./check.mjs";
import { init, InitError } from "./init.mjs";
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

pipeup agent [--name <name>]
  Makes this computer's agent key (once) and prints the public key to list on the page:
  <html data-pipeup-agents="<key>">

pipeup watch <page.html> [--agent <name>] [--port <number>]
  Shows the page from this computer, with a live link to the agent: the page offers "Share with my agent"
  (off until the person switches it on), and the agent is listed for this page while the link runs. It adds the
  agents add-on to the page it shows (the file is not changed), unless the page's Pipeup already has agent support
  (0.6.x), and refuses a page whose Pipeup is older than 0.6.

pipeup comments <page.html> [--all] [--json]
  Prints the comments the page has shared (open threads, or all with --all), as Markdown or, with --json, as data.

pipeup reply --page <file.html> --thread <id> "<words>" [--addressed "<short note>"]
  Writes a signed reply (and, with --addressed, an addressed note) to <file>.replies.js next to the page.
  It never resolves, reopens, edits or deletes anything: the author closes threads.

pipeup reply --print (--doc <document id> | --page <file.html>) --thread <id> "<words>" [--addressed "<short note>"]
  Prints the same signed reply as a replies block for the person to paste into the page (Paste my agent's replies),
  for an agent that can't write next to the page. Copy for my agent gives the document id. Nothing is written.`;

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

async function pageDoc(file) {
  const html = await readFile(file, "utf8");
  const m = /<html\b[^>]*\sdata-pipeup-doc\s*=\s*["']([^"']+)["']/i.exec(html);
  if (!m) fail(`${file} has no data-pipeup-doc attribute; add Pipeup to the page first`);
  const { id } = await (await core()).parseDocumentAttribute(m[1]);
  const listed = /<html\b[^>]*\sdata-pipeup-agents\s*=\s*["']([^"']*)["']/i.exec(html)?.[1] ?? "";
  return { id, listed: listed.split(/[\s,]+/).filter(Boolean) };
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
  const { id: doc, listed } = given ? { id: given, listed: null } : await pageDoc(page);
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
  if (!listed.includes(identity.publicKey) && !linked)
    console.warn(
      `pipeup: this page doesn't list your key yet, so it will ignore these replies.\n  Add: <html data-pipeup-agents="${identity.publicKey}">`,
    );
  const out = resolve(page.replace(/\.[^./\\]*$/, "") + ".replies.js");
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
  console.log(`Wrote ${added.length} ${added.length === 1 ? "entry" : "entries"} to ${out}`);
}

const [command, ...rest] = process.argv.slice(2);
const args = flags(rest);
if (command === "agent") {
  const { identity, name } = await loadAgent(args.name);
  console.log(
    `${name} (${KEYFILE})\n\nList this key on the page:\n  <html data-pipeup-agents="${identity.publicKey}">`,
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
    `Read:  npx pipeup comments ${page}\nReply: npx pipeup reply --page ${page} --thread <id> "words" --addressed "note"\nStop:  Ctrl-C (comments stay in ${basename(link.sidecar)})`,
  );
  const stop = () => link.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else {
  console.log(USAGE);
  process.exit(command ? 1 : 0);
}
