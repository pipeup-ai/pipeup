#!/usr/bin/env node
// pipeup agent / pipeup reply: how an AI agent answers comments on a Pipeup page.
// The agent's key stays in ~/.pipeup/agent.json (owner-only) and never goes in the page or its folder.
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { computeOpId, parseDocumentAttribute, signOp } from "../dist/pipeup.core.js";
import { comments, watch } from "./link.mjs";

const KEYFILE = process.env.PIPEUP_AGENT_FILE || join(homedir(), ".pipeup", "agent.json");
const AI = "AI assistant";

const USAGE = `pipeup agent [--name <name>]
  Makes this computer's agent key (once) and prints the public key to list on the page:
  <html data-pipeup-agents="<key>">

pipeup watch <page.html> [--agent <name>] [--port <number>]
  Shows the page from this computer, with a live link to the agent: the page offers "Share with my agent"
  (off until the person switches it on), and the agent is listed for this page while the link runs.

pipeup comments <page.html> [--all] [--json]
  Prints the comments the page has shared (open threads, or all with --all), as Markdown or, with --json, as data.

pipeup reply --page <file.html> --thread <id> "<words>" [--addressed "<short note>"]
  Writes a signed reply (and, with --addressed, an addressed note) to <file>.replies.js next to the page.
  It never resolves, reopens, edits or deletes anything: the author closes threads.`;

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
  const { id } = await parseDocumentAttribute(m[1]);
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

async function reply(args) {
  const page = args.page;
  const thread = args.thread;
  const words = args._[0]?.trim();
  if (typeof page !== "string" || typeof thread !== "string" || !words)
    fail(`missing words, --page or --thread\n\n${USAGE}`);
  const note = typeof args.addressed === "string" ? args.addressed.trim() : "";
  const { id: doc, listed } = await pageDoc(page);
  const { identity, name } = await loadAgent();
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
else if (command === "comments") {
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
  const link = await watch({
    page,
    agent: name,
    key: identity.publicKey,
    port: typeof args.port === "string" ? Number(args.port) : 0,
  });
  console.log(`Open this page: ${link.url}\n`);
  console.log(
    `While this runs, ${name} is listed for the page and the page offers "Share with my agent" (off until you switch it on).`,
  );
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
