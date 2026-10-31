// pipeup read: a page's comments without opening it (spec §15f): from feedback files, the page's shared copy and its
// replies file. Every comment goes through the same checks as in the page; the Markdown is Copy comments › As Markdown's.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { asksMarkdown, asksWithAnswers } from "./asks.mjs";

const core = () => import("../dist/pipeup.core.js");
const MAX_MERGE = 5000;
const MAX_FILE = 5_000_000;

export class ReadError extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

const attrOf = (html, name) => {
  const tag = /<html\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(html)?.[0] ?? "";
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3]).replace(/&quot;/g, '"').replace(/&amp;/g, "&") : null;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Where a thread is, from what the comment itself saved: no page is opened, so nothing is measured. */
function where(anchor) {
  const parts = [];
  if (anchor.view?.slide) parts.push(`Slide ${anchor.view.slide}`);
  if (anchor.id) parts.push(`"${anchor.id}"`);
  return {
    where: parts.length ? parts.join(" › ") : `"${anchor.snapshot}"`,
    element: null,
    id: anchor.id ?? null,
    quote: anchor.quote?.exact ?? null,
    pin: anchor.point
      ? `${Math.round(anchor.point.x * 100)}% across, ${Math.round(anchor.point.y * 100)}% down the element`
      : null,
  };
}

/** The feedback files in a folder (and the folders inside it with `deep`). */
async function filesIn(dir, deep) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (deep) out.push(...(await filesIn(path, deep)));
    } else if (/\.(json|pipeup)$/i.test(entry.name)) out.push(path);
  }
  return out.sort();
}

/**
 * The share add-on's headless reader, if it is installed: beside this package, or in the project the command runs in
 * (as with `npx --yes pipeup@0 read` in a folder where `@pipeup/share` is installed). It is never a dependency of `pipeup`.
 */
async function shareReader() {
  try {
    return await import("@pipeup/share/headless");
  } catch {
    for (let dir = process.cwd(); ; dir = dirname(dir)) {
      const pkg = join(dir, "node_modules", "@pipeup", "share", "package.json");
      try {
        const entry = JSON.parse(await readFile(pkg, "utf8")).exports?.["./headless"]?.import;
        if (entry) return await import(pathToFileURL(join(dirname(pkg), entry)).href);
      } catch {
        // not here
      }
      if (dirname(dir) === dir) return null;
    }
  }
}

/** What a feedback file's refusal means, in a few words. */
function why(message) {
  if (/different document/.test(message)) return "another document's";
  if (/sealed|could not be opened/.test(message)) return "can't be opened with this page's key";
  if (/too large/.test(message)) return "too large";
  return "not a feedback file";
}

/** The ops in a replies file (`(globalThis.pipeupReplies ||= []).push({...})`), read as data, never run. */
function repliesOps(text, docId) {
  const ops = [];
  for (const m of text.matchAll(/\.push\((\{[\s\S]*?\})\);?\s*(?=\(|$)/g)) {
    try {
      const file = JSON.parse(m[1]);
      if (file?.format === "pipeup-replies" && file.doc === docId && Array.isArray(file.ops))
        ops.push(...file.ops);
    } catch {
      // not a replies entry
    }
  }
  return ops;
}

/**
 * Reads the comments. o: { page, from: string[], deep, all, json, share, out, local, log }. Resolves to the text to
 * print; what it read and left out goes to `log` (standard error), so the comments can be piped on their own.
 */
export async function read(o) {
  const log = o.log ?? ((line) => console.error(line));
  let html;
  try {
    html = await readFile(o.page, "utf8");
  } catch (e) {
    throw new ReadError(`can't read ${o.page}: ${e.message}`, 1);
  }
  const attr = attrOf(html, "data-pipeup-doc");
  if (!attr)
    throw new ReadError(
      "the page has no document identity (data-pipeup-doc), so no comments can be matched to it; run `pipeup init` first",
    );
  const {
    PipeupDocument,
    MemoryStore,
    createIdentity,
    parseDocumentAttribute,
    readFeedbackFile,
    agentComments,
    animalName,
  } = await core();
  let id;
  let key;
  try {
    ({ id, key } = await parseDocumentAttribute(attr));
  } catch (e) {
    throw new ReadError(e.message.replace(/^pipeup: /, ""));
  }
  const doc = await PipeupDocument.open({
    doc: id,
    key,
    store: new MemoryStore(),
    identity: await createIdentity(),
    name: "",
  });
  let found = 0;
  let duplicates = 0;
  let refused = 0;
  /** Merges ops from one source, counting what was new, already there and refused. */
  const take = async (ops, source) => {
    const before = new Set(doc.ops().map((op) => op.body.id));
    let added = 0;
    for (let i = 0; i < ops.length; i += MAX_MERGE)
      added += await doc.merge(ops.slice(i, i + MAX_MERGE), source);
    const seen = ops.filter((op) => typeof op?.body?.id === "string" && before.has(op.body.id)).length;
    found += ops.length;
    duplicates += seen;
    refused += Math.max(0, ops.length - added - seen);
    return added;
  };

  // Feedback files, and folders of them.
  let failed = false;
  const files = [];
  for (const from of o.from ?? []) {
    let info;
    try {
      info = await stat(from);
    } catch {
      log(`Can't find ${from}.`);
      failed = true;
      continue;
    }
    if (info.isDirectory()) {
      const inside = await filesIn(from, o.deep);
      if (!inside.length)
        log(`No feedback files in ${from}${o.deep ? "" : " (add --deep to look in the folders inside it)"}.`);
      files.push(...inside.map((path) => ({ path, folder: true })));
    } else files.push({ path: from, folder: false });
  }
  let read = 0;
  const skipped = [];
  for (const f of files) {
    try {
      if ((await stat(f.path)).size > MAX_FILE) throw new Error("too large");
      const ops = await readFeedbackFile(await readFile(f.path, "utf8"), id, key);
      await take(ops, "file");
      read += 1;
    } catch (e) {
      skipped.push(`${f.folder ? basename(f.path) : f.path} (${why(e.message)})`);
      if (!f.folder) failed = true;
    }
  }
  if (files.length) {
    log(`Read ${plural(read, "feedback file")}.`);
    if (skipped.length) log(`Skipped ${plural(skipped.length, "file")}: ${skipped.join(", ")}.`);
  }

  // The replies file beside the page: replies from the agents the page lists.
  const repliesPath = resolve(o.page).replace(/\.[^./\\]*$/, "") + ".replies.js";
  let replies = null;
  try {
    replies = await readFile(repliesPath, "utf8");
  } catch {
    // none
  }
  if (replies !== null) {
    const listed = (attrOf(html, "data-pipeup-agents") ?? "").split(/[\s,]+/).filter(Boolean);
    const ops = repliesOps(replies, id);
    const theirs = ops.filter((op) => listed.includes(op?.body?.author));
    if (ops.length > theirs.length)
      log(
        `Left out ${plural(ops.length - theirs.length, "reply", "replies")} in ${basename(repliesPath)} from agents the page doesn't list.`,
      );
    await take(theirs, "replies");
    log(`Read ${basename(repliesPath)}.`);
  }

  // The shared copy.
  const share = attrOf(html, "data-pipeup-share");
  if (share && o.share !== false) {
    let host = "the sharing service";
    try {
      host = new URL(share.replace(/^[a-z]+:(?=https?:)/i, "").split("#")[0]).host || host;
    } catch {
      // the add-on reads the address; this is only for the sentence
    }
    log(`Reading the shared copy from ${host} (nothing is sent to it).`);
    const headless = await shareReader();
    if (!headless) {
      log(
        "Reading a shared copy needs the share add-on: npm i -D @pipeup/share, then run this again (or --no-share).",
      );
      failed = true;
    }
    if (headless) {
      const ac = new AbortController();
      try {
        const link = await headless.connectShare(doc, {
          share,
          signal: ac.signal,
          sendable: () => false,
          local: o.local,
        });
        await link.flush(60_000);
        // What arrives is merged in short batches after the read: wait until nothing more lands for half a second.
        for (let n = -1, quiet = 0, t0 = Date.now(); quiet < 5 && Date.now() - t0 < 10_000;) {
          await new Promise((r) => setTimeout(r, 100));
          const now = doc.ops().length;
          quiet = now === n ? quiet + 1 : 0;
          n = now;
        }
        link.stop();
        log("Read the shared copy.");
      } catch (e) {
        log(`Couldn't read the shared copy: ${e.message}`);
        failed = true;
      } finally {
        ac.abort();
      }
    }
  } else if (share) log("The page has a shared copy; it was not read (--no-share).");

  if (duplicates)
    log(
      `${plural(duplicates, "comment change")} came from more than one place and ${duplicates === 1 ? "is" : "are"} shown once.`,
    );
  if (refused)
    log(
      `Left out ${plural(refused, "change")} that failed Pipeup's checks: not signed by the person named, altered after signing, or for another document.`,
    );

  const threads = doc.threads();
  if (!threads.length && !found)
    log(
      "No comments found. Comments that are only in a reviewer's browser can't be read from here: they reach you by Copy comments › As Markdown, a feedback file, or sharing.",
    );
  // Page order: where the page marks the block, else where its quoted words (or what the reviewer saw) appear.
  const order = (t) => {
    const marked = t.anchor.id ? html.indexOf(`data-pipeup-id="${t.anchor.id}"`) : -1;
    if (marked >= 0) return marked;
    for (const words of [t.anchor.quote?.exact, t.anchor.snapshot?.slice(0, 40)]) {
      const at = words ? html.indexOf(words.trim()) : -1;
      if (at >= 0) return at;
    }
    return Number.MAX_SAFE_INTEGER;
  };
  const items = [...threads]
    .sort((a, b) => order(a) - order(b) || a.root.at - b.root.at)
    .map((thread) => ({ thread, location: where(thread.anchor) }));
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || basename(o.page);
  const out = agentComments(items, {
    title,
    url: pathToFileURL(resolve(o.page)).href,
    exportedAt: new Date(),
    all: o.all,
  });

  // The asks the page puts in its content (§11b), each with every reviewer's latest answer, so an agent can work through them.
  const asks = asksWithAnswers(html, threads);
  if (asks.length) {
    out.asks = asks;
    out.markdown = `${out.markdown.trimEnd()}\n${asksMarkdown(asks, animalName)}`;
  }
  if (o.out) {
    try {
      await writeFile(o.out, await doc.exportFile());
      log(`Wrote every comment found to ${o.out}${key ? ", sealed for this document" : ""}.`);
    } catch (e) {
      throw new ReadError(`can't write ${o.out}: ${e.message}`, 1);
    }
  }
  const text = o.json ? JSON.stringify(out, null, 2) : out.markdown;
  return { text, failed };
}
