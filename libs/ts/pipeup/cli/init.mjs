// pipeup init: adds Pipeup to a page in one step (spec §15e, design docs/design/cli-init.md).
// The page is edited as text: every change is an insertion or an attribute value replaced at a known place, so every
// other byte stays as it was. Nothing is fetched: Pipeup's hash comes from the package's own file, the add-ons' from
// dist/addons.json, which the add-ons build writes.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const PKG = new URL("..", import.meta.url);
const CDN = "https://cdn.jsdelivr.net/npm";
const KEYFILE = () => process.env.PIPEUP_AGENT_FILE || join(homedir(), ".pipeup", "agent.json");
// A start tag, with quoted attribute values that may hold ">".
const TAG = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;
const HTML_TAG = new RegExp(`<html\\b${TAG}>`, "i");
const SCRIPT = new RegExp(`<script\\b(${TAG})>([\\s\\S]*?)</script\\s*>`, "gi");
const SIGNATURE = /var Pipeup=\(\(\)=>/;

export class InitError extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

const version = async () => JSON.parse(await readFile(new URL("package.json", PKG), "utf8")).version;
const sri = (bytes) => `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
const escapeAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const unescapeAttr = (v) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** 1.2.3-beta.4 compared with another: negative when a is older. */
function compare(a, b) {
  const parse = (v) => {
    const [core, pre] = v.split("-", 2);
    return { n: core.split(".").map(Number), pre: pre ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return (x.n[i] ?? 0) - (y.n[i] ?? 0);
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre.localeCompare(y.pre, "en", { numeric: true });
}

/** An attribute's value in a start tag, or null. */
function attrOf(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? unescapeAttr(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** Where an attribute's value sits in a start tag (start and end of the value, inside any quotes), or null. */
function attrSpan(tag, name) {
  const m = new RegExp(`(\\s${name}\\s*=\\s*)("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (!m) return null;
  const quoted = m[2][0] === '"' || m[2][0] === "'";
  const start = m.index + m[1].length + (quoted ? 1 : 0);
  return { start, end: start + m[2].length - (quoted ? 2 : 0) };
}

/** Where to add an attribute to a start tag: just after its last attribute, before any space and its ">" or "/>". */
const attrEnd = (tag) => tag.length - (/\s*\/?>$/.exec(tag)?.[0].length ?? 1);

/** What the page already has: its <html> tag, Pipeup's script, add-ons. */
function survey(html) {
  const h = HTML_TAG.exec(html);
  if (!h) throw new InitError("the page has no <html> element; add one around the page and run this again");
  const found = { html: { at: h.index, tag: h[0] }, core: null, addons: new Map(), lastScriptEnd: -1 };
  for (const m of html.matchAll(SCRIPT)) {
    const src = attrOf(`<script${m[1]}>`, "src");
    if (src) {
      const addon = /@pipeup\/([a-z][a-z0-9-]*)(?:@[^/]+)?\/dist\//.exec(src);
      const core =
        /(?:^|\/)pipeup(?:@([^/]+))?\/dist\/pipeup\.min\.js/.exec(src) ??
        /(?:^|\/)pipeup\.min\.js$/.exec(src);
      if (core && !found.core)
        found.core = {
          at: m.index,
          tag: `<script${m[1]}>`,
          end: m.index + m[0].length,
          version: core[1] ?? null,
          inline: false,
        };
      else if (addon) found.addons.set(addon[1], m.index + m[0].length);
    } else if (!found.core && SIGNATURE.test(m[2])) {
      const v = /\bVERSION:?\s*(?:=\s*)?"(\d+\.\d+\.\d+(?:-[\w.]+)?)"/.exec(m[2]);
      found.core = {
        at: m.index,
        tag: `<script${m[1]}>`,
        end: m.index + m[0].length,
        version: v?.[1] ?? null,
        inline: true,
      };
    }
  }
  return found;
}

/** Where a new script line goes: before </body>, else </html>, else the end; with the indent of the line above. */
function scriptSpot(html) {
  const close = /<\/body\s*>/i.exec(html) ?? /<\/html\s*>/i.exec(html);
  const at = close ? close.index : html.length;
  const lineStart = html.lastIndexOf("\n", at - 1) + 1;
  const before = html.slice(lineStart, at);
  if (/^\s*$/.test(before)) {
    // </body> starts its line: the new line goes above it, indented like the content above.
    const prev = html.slice(0, lineStart).trimEnd();
    const prevLine = prev.slice(prev.lastIndexOf("\n") + 1);
    const indent = /^\s*/.exec(prevLine)?.[0] ?? "";
    return { at: lineStart, wrap: (line) => `${indent}${line}\n` };
  }
  return { at, wrap: (line) => `\n${line}\n` };
}

async function addonTable() {
  try {
    return JSON.parse(await readFile(new URL("dist/addons.json", PKG), "utf8"));
  } catch {
    return null;
  }
}

/** Reads answers a line at a time, from a terminal or a pipe; null once the input ends. */
function answers(input) {
  const rl = createInterface({ input, terminal: false });
  const lines = [];
  const waiting = [];
  let ended = false;
  rl.on("line", (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
  rl.on("close", () => {
    ended = true;
    for (const w of waiting.splice(0)) w(null);
  });
  return {
    next: () =>
      lines.length
        ? Promise.resolve(lines.shift())
        : ended
          ? Promise.resolve(null)
          : new Promise((r) => waiting.push(r)),
    close: () => rl.close(),
  };
}

/** Lowercase words joined by dashes: at most five words, as a block's stable name. */
export function kebab(text) {
  return text
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("-")
    .slice(0, 48)
    .replace(/-+$/, "");
}

const BLOCKS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "article",
  "figure",
  "table",
  "pre",
  "blockquote",
]);
const MEDIA = new Set(["img", "svg", "canvas"]);
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const RAW = new Set(["script", "style", "template", "textarea", "title"]);
const HIDDEN = new Set(["nav", "header", "footer"]);
const textOf = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The parts of a page worth a stable name, with a proposed name and what each was taken to be. */
export function candidates(html) {
  const out = [];
  const used = new Set([...html.matchAll(/\sdata-pipeup-id\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
  const open = [];
  let slides = [...html.matchAll(/\sdata-pipeup-slide\s*=\s*["'](\d+)["']/gi)].reduce(
    (n, m) => Math.max(n, Number(m[1])),
    0,
  );
  const re = new RegExp(`<!--[\\s\\S]*?-->|<(/?)([a-zA-Z][\\w-]*)(${TAG})>`, "g");
  for (let m; (m = re.exec(html));) {
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    if (m[1]) {
      const i = open.map((o) => o.name).lastIndexOf(name);
      if (i >= 0) open.length = i;
      continue;
    }
    const tag = m[0];
    const selfClosing = tag.endsWith("/>") || VOID.has(name);
    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end;
      continue;
    }
    const hidden =
      HIDDEN.has(name) ||
      /\sdata-pipeup-ignore\b/i.test(tag) ||
      /\saria-hidden\s*=\s*["']true["']/i.test(tag);
    const within = open.some((o) => o.hidden);
    if (!selfClosing && name !== "svg") open.push({ name, hidden });
    else if (name === "svg" && !selfClosing) {
      // An svg's insides are drawing, not blocks: skip to its end.
      const end = html.toLowerCase().indexOf("</svg", re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end;
    }
    if (within || hidden || /\sdata-pipeup-(id|label|slide)\s*=/i.test(tag)) continue;
    const at = m.index;
    const cls = attrOf(tag, "class") ?? "";
    const named = attrOf(tag, "aria-label") ?? attrOf(tag, "alt") ?? attrOf(tag, "title");
    if (/(^|\s)slide(\s|$)/i.test(cls)) {
      slides += 1;
      out.push({ at, tag, attr: "data-pipeup-slide", value: String(slides), took: `slide ${slides}` });
      continue;
    }
    if (MEDIA.has(name)) {
      const src = attrOf(tag, "src") ?? "";
      const file = src.split(/[?#]/)[0].split("/").pop() ?? "";
      const label = (
        named ??
        attrOf(tag, "id") ??
        file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")
      ).trim();
      const kind =
        name === "img" ? "an image" : name === "svg" ? "a drawing (svg)" : "a canvas (often a chart)";
      out.push({
        at,
        tag,
        attr: "data-pipeup-label",
        value: label || (name === "img" ? "image" : "chart"),
        took: `${kind}${file ? ` (${file})` : ""}`,
      });
      continue;
    }
    if (!BLOCKS.has(name)) continue;
    // Its words: for a section or article its first heading, else its own text.
    const rest = html.slice(re.lastIndex, re.lastIndex + 4000);
    const close = rest.toLowerCase().indexOf(`</${name}`);
    const inner = close < 0 ? rest : rest.slice(0, close);
    const heading = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/i.exec(inner);
    // A section with a heading is named through its heading: offering both would name one part twice.
    if ((name === "section" || name === "article") && heading) continue;
    const words = textOf(name === "section" || name === "article" ? (heading?.[1] ?? inner) : inner);
    let base = kebab(attrOf(tag, "id") ?? named ?? words) || name;
    let proposal = base;
    for (let n = 2; used.has(proposal); n++) proposal = `${base}-${n}`;
    used.add(proposal);
    const kinds = {
      section: "a section",
      article: "an article",
      figure: "a figure",
      table: "a table",
      pre: "a code block",
      blockquote: "a quotation",
    };
    const kind = kinds[name] ?? "a heading";
    const quote = words ? ` "${words.slice(0, 60)}${words.length > 60 ? "…" : ""}"` : "";
    out.push({ at, tag, attr: "data-pipeup-id", value: proposal, took: `${kind}${quote}` });
  }
  return out;
}

/** Applies edits (each { at, del, text }) from the end of the file back, so earlier offsets stay right. */
function apply(html, edits) {
  let out = html;
  for (const e of [...edits].sort((a, b) => b.at - a.at || b.order - a.order))
    out = out.slice(0, e.at) + e.text + out.slice(e.at + (e.del ?? 0));
  return out;
}

/** Sets (or appends to) an attribute on the <html> start tag: returns the edit, or null when nothing changes. */
function htmlAttr(found, name, value, { append = false } = {}) {
  const { at, tag } = found.html;
  const span = attrSpan(tag, name);
  if (!span) return { at: at + attrEnd(tag), text: ` ${name}="${escapeAttr(value)}"` };
  if (!append) return null;
  const current = unescapeAttr(tag.slice(span.start, span.end));
  const items = current.split(/[\s,]+/).filter(Boolean);
  const add = value.split(/[\s,]+/).filter((v) => v && !items.includes(v));
  if (!add.length) return null;
  const next = [...items, ...add].join(current.includes(",") ? "," : " ");
  return { at: at + span.start, del: span.end - span.start, text: escapeAttr(next) };
}

/**
 * Plans and makes the changes. o: { page, yes, dryRun, update, offline, marks, addons: string[], agent, values,
 * input, log }. Resolves to { changed, marked }.
 */
export async function init(o) {
  const log = o.log ?? console.log;
  const V = await version();
  let html;
  try {
    html = await readFile(o.page, "utf8");
  } catch (e) {
    throw new InitError(`can't read ${o.page}: ${e.message}`, 1);
  }
  const found = survey(html);
  const edits = [];
  const says = [];
  const notes = [];
  let order = 0;
  const edit = (e, say) => {
    if (!e) return;
    edits.push({ ...e, order: order++ });
    if (say) says.push(say);
  };
  const io = o.input ? answers(o.input) : null;
  const ask = async (question) => {
    if (!io) return null;
    process.stdout.write(question);
    const line = await io.next();
    // A piped answer isn't echoed: end the prompt's line so the next starts on its own.
    if (line === null || !o.input.isTTY) process.stdout.write("\n");
    return line;
  };
  try {
    const wanted = [...new Set(o.addons ?? [])];
    if (o.agent && !wanted.includes("agents")) wanted.push("agents");
    if (o.offline && wanted.length)
      throw new InitError(
        "add-ons can't be put inside the page yet (their code isn't in this package); leave out --offline to add them by address",
      );
    const table = wanted.length ? await addonTable() : null;
    if (wanted.length && !table)
      throw new InitError(
        "this install of pipeup doesn't carry the add-ons' hashes (dist/addons.json); install it from npm and run this again",
        1,
      );

    // Pipeup itself.
    const spot = scriptSpot(html);
    const coreFile = await readFile(new URL("dist/pipeup.min.js", PKG));
    let addonAt = found.core ? found.core.end : spot.at;
    const addonWrap = found.core
      ? (line) => {
          const lineStart = html.lastIndexOf("\n", found.core.at - 1) + 1;
          const indent = /^\s*/.exec(html.slice(lineStart, found.core.at))?.[0] ?? "";
          return `\n${indent}${line}`;
        }
      : spot.wrap;
    if (!found.core) {
      if (o.offline)
        edit(
          { at: spot.at, text: spot.wrap(`<script>${coreFile.toString("utf8").trim()}</script>`) },
          `Put Pipeup ${V} inside the page (${(coreFile.length / 1024).toFixed(0)} KB), so it works with no network.`,
        );
      else
        edit(
          {
            at: spot.at,
            text: spot.wrap(
              `<script src="${CDN}/pipeup@${V}/dist/pipeup.min.js" integrity="${sri(coreFile)}" crossorigin="anonymous"></script>`,
            ),
          },
          `Add Pipeup ${V} from the CDN, pinned to that version and its integrity hash.`,
        );
    } else if (found.core.version === null) {
      notes.push(
        found.core.inline
          ? "The page carries Pipeup inside it; its version couldn't be read, so it is left as it is."
          : "The page loads Pipeup from a file beside it, without a version in its address, so it is left as it is.",
      );
    } else {
      const c = compare(found.core.version, V);
      if (c === 0) notes.push(`The page already uses Pipeup ${V}.`);
      else if (c > 0)
        notes.push(
          `The page uses Pipeup ${found.core.version}, newer than this command's ${V}; it is left as it is.`,
        );
      else if (!o.update)
        notes.push(`The page uses Pipeup ${found.core.version}. Run this with --update to move it to ${V}.`);
      else if (found.core.inline)
        notes.push(
          `The page carries Pipeup ${found.core.version} inside it; replace it by hand, or remove it and run this again.`,
        );
      else {
        const tag = found.core.tag;
        const src = attrSpan(tag, "src");
        const value = tag.slice(src.start, src.end).replace(found.core.version, V);
        edit(
          { at: found.core.at + src.start, del: src.end - src.start, text: value },
          `Move the page from Pipeup ${found.core.version} to ${V}. See https://github.com/pipeup-ai/pipeup/blob/main/CHANGELOG.md for what changed.`,
        );
        const integrity = attrSpan(tag, "integrity");
        if (integrity)
          edit({
            at: found.core.at + integrity.start,
            del: integrity.end - integrity.start,
            text: sri(coreFile),
          });
        else
          edit({
            at: found.core.at + attrEnd(tag),
            text: ` integrity="${sri(coreFile)}" crossorigin="anonymous"`,
          });
      }
    }

    // The document identity: added once, never changed.
    if (attrOf(found.html.tag, "data-pipeup-doc") === null) {
      const { newDocumentAttribute } = await import(new URL("dist/pipeup.core.js", PKG).href);
      edit(
        htmlAttr(found, "data-pipeup-doc", newDocumentAttribute()),
        "Give the page a document identity (data-pipeup-doc), so its comments are recognised wherever the file goes.",
      );
    } else notes.push("The page keeps its document identity.");

    // The agent, then the add-ons.
    if (o.agent) {
      let key = null;
      try {
        key = JSON.parse(await readFile(KEYFILE(), "utf8")).publicKey;
      } catch {
        // no agent yet
      }
      if (!key)
        throw new InitError("this computer has no agent yet; run `pipeup agent` first, then this again");
      edit(
        htmlAttr(found, "data-pipeup-agents", key, { append: true }),
        `List this computer's agent on the page (data-pipeup-agents).`,
      );
    }
    const attrs = new Set();
    for (const id of wanted) {
      const a = table[id];
      if (!a)
        throw new InitError(
          `there is no add-on called "${id}"; the add-ons are: ${Object.keys(table).join(", ")}`,
        );
      if (found.addons.has(id)) {
        notes.push(`The page already has the ${id} add-on.`);
        continue;
      }
      if (a.asks && !attrs.has(a.asks.attr) && attrOf(found.html.tag, a.asks.attr) === null) {
        let value = o.values?.[a.asks.flag];
        if (typeof value !== "string" && !o.yes)
          value = (await ask(`The ${id} add-on needs ${a.asks.what}: `))?.trim();
        if (typeof value !== "string" || !value)
          throw new InitError(`the ${id} add-on needs ${a.asks.what}; pass it with --${a.asks.flag} <value>`);
        if (!new RegExp(a.asks.pattern).test(value)) throw new InitError(`"${value}" isn't ${a.asks.what}`);
        attrs.add(a.asks.attr);
        edit(htmlAttr(found, a.asks.attr, value), `Set ${a.asks.attr}="${value}" for the ${id} add-on.`);
      }
      edit(
        {
          at: addonAt,
          text: addonWrap(
            `<script src="${CDN}/@pipeup/${id}@${V}/dist/${id}.min.js" integrity="${a.integrity}" crossorigin="anonymous"></script>`,
          ),
        },
        `Add the ${id} add-on, pinned like Pipeup. What it sends: ${a.says}`,
      );
    }
    const adding = wanted.filter((id) => table?.[id] && !found.addons.has(id));
    if (adding.length) {
      // A page without the list runs every add-on it loads: starting one lists those it already has too.
      const list =
        attrOf(found.html.tag, "data-pipeup-addons") === null ? [...found.addons.keys(), ...adding] : adding;
      edit(
        htmlAttr(found, "data-pipeup-addons", list.join(","), { append: true }),
        `Allow ${adding.join(", ")} in the page's list of add-ons (data-pipeup-addons).`,
      );
    }

    // Say it, ask, write.
    for (const n of notes) log(n);
    let changed = false;
    if (says.length) {
      log(`${o.dryRun ? "This would change" : "This changes"} ${o.page}:`);
      for (const s of says) log(`  - ${s}`);
      if (o.dryRun) return { changed: false, marked: 0 };
      let go = o.yes;
      if (!go) {
        const reply = await ask("Go ahead? [y/N] ");
        go = /^y(es)?$/i.test(reply?.trim() ?? "");
      }
      if (!go) {
        log("Nothing changed. Run it again with --yes to go ahead without being asked.");
        return { changed: false, marked: 0 };
      }
      html = apply(html, edits);
      try {
        await writeFile(o.page, html);
      } catch (e) {
        throw new InitError(`can't write ${o.page}: ${e.message}`, 1);
      }
      changed = true;
      log(`Changed ${o.page}.`);
    } else if (o.dryRun) {
      log("Nothing to change.");
      return { changed: false, marked: 0 };
    } else if (!o.marks) log("Nothing to change.");

    // Marks: offered unless --yes; --marks goes straight here.
    let marked = 0;
    if ((o.marks || !o.yes) && io) {
      const parts = candidates(html);
      if (!parts.length) log("Every part of the page that needs a stable name has one.");
      else {
        log(
          `\nStable names keep comments attached when the page changes. ${parts.length} part${parts.length === 1 ? "" : "s"} could have one.\nFor each: Enter accepts the name, type another name to use it, s skips, q stops.`,
        );
        const chosen = [];
        for (const p of parts) {
          const reply = await ask(
            `  ${p.took} → ${p.attr === "data-pipeup-slide" ? `slide ${p.value}` : p.value}: `,
          );
          if (reply === null || /^q$/i.test(reply.trim())) break;
          const r = reply.trim();
          if (/^s$/i.test(r)) continue;
          let value = r || p.value;
          if (p.attr === "data-pipeup-id") value = kebab(value) || p.value;
          if (p.attr === "data-pipeup-slide" && !/^\d+$/.test(value)) value = p.value;
          chosen.push({
            at: p.at + attrEnd(p.tag),
            text: ` ${p.attr}="${escapeAttr(value)}"`,
            order: order++,
          });
        }
        if (chosen.length) {
          html = apply(html, chosen);
          try {
            await writeFile(o.page, html);
          } catch (e) {
            throw new InitError(`can't write ${o.page}: ${e.message}`, 1);
          }
          marked = chosen.length;
          log(
            `Marked ${marked} part${marked === 1 ? "" : "s"}. Run \`pipeup check ${o.page}\` to see what else the page could do better.`,
          );
        } else log("No parts marked.");
      }
    } else if (o.marks && !io)
      log("Marking needs answers: run it in a terminal, or pipe one answer per line.");
    else if (changed && o.yes)
      log(
        `Stable names keep comments attached when the page changes: run \`pipeup init ${o.page} --marks\` to add them.`,
      );
    return { changed, marked };
  } finally {
    io?.close();
  }
}
