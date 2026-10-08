import { ladder, RetryAfter, toB64u, randomBytes, type Ladder } from "@pipeup/kit";
import {
  createIdentity,
  MemoryStore,
  newDocumentAttribute,
  parseDocumentAttribute,
  PipeupDocument,
} from "pipeup/core";
import type { SignedOp } from "pipeup";
import { parseShare } from "./address";
import { Mailbox } from "./mailbox";
import { createPaste, deletePaste, PrivateBin, readPaste } from "./privatebin";
import { keepWords, parseArgs, readAttribute, setAttribute, UsageError, dateWords } from "./cli-lib";
import { sleep } from "./backend";

/** Everything the command line touches outside itself, so tests can stand in for it. */
export interface Io {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  /** Normal output. */
  out(text: string): void;
  /** Problems and advice. */
  err(text: string): void;
  /** Waits (ms); tests make it instant. */
  wait?(ms: number): Promise<void>;
}

export const HELP = `Share a Pipeup page's comments through an encrypted service.

Usage:
  share create <page.html> --server <url> [--mailbox] [--from <feedback.json>] [--new-doc]
  share stop   <page.html> --key <stop key>
  share update <page.html>

create   Makes a shared copy and writes its address into the page (data-pipeup-share), changing nothing else.
         --server   a PrivateBin instance (https://paste.example.org/), or with --mailbox your own mailbox server
         --mailbox  use the HTTP mailbox contract; set PIPEUP_MAILBOX_CREATE_TOKEN in the environment if the
                    server wants one (it is never read from the command line)
         --from     post the comments of a feedback file into the shared copy
         --new-doc  give the page a document identity (data-pipeup-doc) if it has none
stop     Deletes the shared copy. --key is the stop key that "create" printed.
update   Points the page at the newest copy, when PrivateBin has moved on to a newer one.

Exit codes: 0 done, 1 the service or the file failed, 2 the command wasn't understood or needs something first.
`;

const wait = (io: Io, ms: number) => (io.wait ? io.wait(ms) : sleep(ms));

/** Retries what a service asks to wait for. */
async function patiently<T>(io: Io, run: () => Promise<T>): Promise<T> {
  for (let tries = 0; ; tries++) {
    try {
      return await run();
    } catch (e) {
      if (!(e instanceof RetryAfter) || tries > 8) throw e;
      await wait(io, e.seconds * 1000 + 500);
    }
  }
}

function server(value: string | true | undefined, mailbox: boolean): string {
  if (typeof value !== "string") throw new UsageError("--server needs the address of the service");
  const a = parseShare(
    mailbox
      ? `${value.replace(/\/+$/, "")}/m/${"x".repeat(22)}#pm1.${"x".repeat(43)}`
      : `${value}?${"x".repeat(16)}#${"x".repeat(43)}`,
    true,
  );
  if (a.kind === "off")
    throw new UsageError("--server must be an https: address (http://localhost is allowed for development)");
  const u = new URL(value);
  return mailbox ? value.replace(/\/+$/, "") : u.origin + u.pathname;
}

async function feedbackOps(file: string, docAttr: string, io: Io): Promise<SignedOp[]> {
  const { id, key } = await parseDocumentAttribute(docAttr);
  const doc = await PipeupDocument.open({
    doc: id,
    key,
    store: new MemoryStore(),
    identity: await createIdentity(),
    name: "",
  });
  try {
    await doc.importFile(await io.read(file));
  } catch (e) {
    throw new Error(
      `I couldn't read ${file} as this page's feedback: ${(e as Error).message.replace(/^pipeup: /, "")}`,
    );
  }
  return [...doc.ops()];
}

async function create(file: string, flags: Map<string, string | true>, io: Io): Promise<void> {
  const mailbox = flags.has("mailbox");
  const base = server(flags.get("server"), mailbox);
  let html = await io.read(file);
  let docAttr = readAttribute(html, "data-pipeup-doc");
  if (!docAttr) {
    if (!flags.has("new-doc")) {
      io.err(
        `${file} has no data-pipeup-doc, so it has no document identity, and sharing needs one.\n` +
          "Run the same command with --new-doc and I will write a fresh one into the page.\n",
      );
      throw new UsageError("the page needs a document identity");
    }
    docAttr = newDocumentAttribute();
    html = setAttribute(html, "data-pipeup-doc", docAttr);
    io.out("Gave the page a new document identity (data-pipeup-doc).");
  }
  const { id } = await parseDocumentAttribute(docAttr).catch(() => {
    throw new UsageError("data-pipeup-doc in the page isn't a valid document identity");
  });
  const from = typeof flags.get("from") === "string" ? (flags.get("from") as string) : null;
  const ops = from ? await feedbackOps(from, docAttr, io) : [];
  const room = randomBytes(32);
  const key = toB64u(room);
  const l: Ladder = ladder(id, room);
  const had = readAttribute(html, "data-pipeup-share");
  let address: string;
  let stopKey: string;
  let backend: PrivateBin | Mailbox;
  const host = new URL(base).host;

  if (mailbox) {
    const create = io.env.PIPEUP_MAILBOX_CREATE_TOKEN;
    const res = await io.fetch(`${base}/m`, {
      method: "POST",
      headers: create ? { Authorization: `Bearer ${create}` } : {},
      body: JSON.stringify({ v: 1 }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 401 || res.status === 403)
      throw new Error(
        `${host} wouldn't make a mailbox. It wants a create token: set PIPEUP_MAILBOX_CREATE_TOKEN and run again.`,
      );
    if (res.status !== 201 || typeof j.mailbox !== "string" || typeof j.stop !== "string")
      throw new Error(`${host} wouldn't make a mailbox (it answered ${res.status}).`);
    const token = typeof j.token === "string" ? j.token : null;
    address = `${base}/m/${j.mailbox}#pm1.${key}${token ? `.${token}` : ""}`;
    stopKey = j.stop;
    backend = new Mailbox({ mailbox: `${base}/m/${j.mailbox}`, ...(token ? { token } : {}) }, l, io.fetch);
    const until = typeof j.expires === "string" ? Date.parse(j.expires) : NaN;
    const keep = j.keep === "last-write" ? ", and longer each time a comment is added" : "";
    io.out(
      Number.isNaN(until)
        ? `${host} keeps this shared copy until it is deleted.`
        : `${host} keeps this shared copy until ${dateWords(until)}${keep}.`,
    );
    const lim = j.limits as { mailbox?: number } | undefined;
    if (lim?.mailbox) io.out(`It holds up to ${Math.round(lim.mailbox / 1_048_576)} MB of comments.`);
  } else {
    const made = await patiently(io, () => createPaste(io.fetch, base, l, "never")).catch((e) => {
      throw new Error(`${host} wouldn't make a shared copy: ${(e as Error).message}`);
    });
    address = `${base}?${made.id}#${key}`;
    stopKey = made.deleteToken;
    backend = new PrivateBin({ base, paste: made.id }, l, io.fetch);
    const back = await readPaste(io.fetch, base, made.id).catch(() => null);
    if (!back)
      throw new Error(
        `${host} made the shared copy but I couldn't read it back, so I haven't touched the page.`,
      );
    io.out(keepWords(host, back.ttl));
  }

  if (ops.length) {
    await patiently(io, () => backend.post(ops));
    io.out(`Put ${ops.length} comment${ops.length === 1 ? "" : "s"} from ${from} into the shared copy.`);
  }
  await io.write(file, setAttribute(html, "data-pipeup-share", address));
  io.out(`Wrote data-pipeup-share into ${file}; nothing else in the page changed.`);
  if (had)
    io.out("It replaced the earlier sharing address: people with the old file keep reading the old copy.");
  io.out("");
  io.out(`Stop key: ${stopKey}`);
  io.out("Keep this private; never put it in the page. You need it to stop sharing:");
  io.out(`  share stop ${file} --key <stop key>`);
}

async function addressOf(file: string, io: Io) {
  const html = await io.read(file);
  const a = parseShare(readAttribute(html, "data-pipeup-share"), true);
  if (a.kind === "off") throw new UsageError(`${file}: ${a.reason}`);
  const docAttr = readAttribute(html, "data-pipeup-doc");
  const doc = docAttr ? (await parseDocumentAttribute(docAttr).catch(() => null))?.id : null;
  if (!doc) throw new UsageError(`${file} has no valid data-pipeup-doc`);
  return { html, a, l: ladder(doc, a.key) };
}

async function stop(file: string, flags: Map<string, string | true>, io: Io): Promise<void> {
  const key = flags.get("key");
  if (typeof key !== "string") throw new UsageError("stop needs --key with the stop key that create printed");
  const { a, l } = await addressOf(file, io);
  if (a.kind === "mailbox") {
    const res = await io.fetch(a.mailbox, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 403) throw new Error("That isn't this mailbox's stop key, so nothing was deleted.");
    if (res.status === 404) throw new Error("The shared copy is already gone.");
    if (res.status !== 204 && res.status !== 200)
      throw new Error(`The server answered ${res.status}, so I can't say it was deleted.`);
    io.out("Deleted the shared copy. Everyone keeps the comments they already have.");
  } else {
    // Look for later generations first: once the first copy is gone its `next` can't be read.
    const b = new PrivateBin(a, l, io.fetch);
    const later: { id: string; ttl: number | null }[] = [];
    await b.read().catch(() => {});
    for (const id of b.trail.slice(1))
      later.push({ id, ttl: (await readPaste(io.fetch, a.base, id).catch(() => null))?.ttl ?? null });
    const res = await deletePaste(io.fetch, a.base, a.paste, key);
    const j = (await res.json().catch(() => ({}))) as { status?: number };
    if (j.status !== 0)
      throw new Error(
        "That isn't this shared copy's stop key (or it is already gone), so nothing was deleted.",
      );
    io.out(
      "Deleted the shared copy the page's address points to. Everyone keeps the comments they already have.",
    );
    if (later.length) {
      io.err(
        `${later.length} newer cop${later.length === 1 ? "y was" : "ies were"} made when the first one grew. This key can't delete ${later.length === 1 ? "it" : "them"}; ${later.length === 1 ? "it stays" : "they stay"} until the service removes ${later.length === 1 ? "it" : "them"}:`,
      );
      for (const g of later)
        io.err(
          `  ${g.id}: ${g.ttl === null ? "no expiry set" : `until about ${dateWords(Date.now() + g.ttl)}`}`,
        );
    }
  }
  io.out(
    "The page still carries its old address; remove data-pipeup-share if it should say nothing about sharing.",
  );
}

async function update(file: string, io: Io): Promise<void> {
  const { html, a, l } = await addressOf(file, io);
  if (a.kind === "mailbox") return io.out("A mailbox has no newer copies, so there is nothing to update.");
  const b = new PrivateBin(a, l, io.fetch);
  await b.read().catch((e) => {
    throw new Error(
      `I couldn't read the shared copy: ${(e as Error).message === "gone" ? "it is gone" : (e as Error).message}`,
    );
  });
  if (b.head === a.paste) return io.out("The page already points at the newest copy.");
  const fragment = new URL(readAttribute(html, "data-pipeup-share")!).hash;
  await io.write(file, setAttribute(html, "data-pipeup-share", `${a.base}?${b.head}${fragment}`));
  io.out(`Pointed ${file} at the newest copy, so new reviewers don't have to walk through the older ones.`);
}

/** Runs a command; the number is the exit code. */
export async function run(argv: readonly string[], io: Io): Promise<number> {
  try {
    const { command, file, flags } = parseArgs(argv);
    if (flags.has("help") || !command || command === "help") {
      io.out(HELP);
      return flags.has("help") || command === "help" ? 0 : 2;
    }
    if (!["create", "stop", "update"].includes(command))
      throw new UsageError(`I don't know the command "${command}"`);
    if (!file) throw new UsageError(`${command} needs the page, such as: share ${command} page.html`);
    if (command === "create") await create(file, flags, io);
    else if (command === "stop") await stop(file, flags, io);
    else await update(file, io);
    return 0;
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`${e.message.replace(/\.$/, "")}. Try: share --help`);
      return 2;
    }
    io.err((e as Error).message);
    return 1;
  }
}
