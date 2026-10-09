import { settings, type Settings } from "@pipeup/kit";
import type { Comment, Identity, ItemHandle, MenuItem, PipeupAddon, Thread } from "pipeup";
import { core, NAME, replyOp, type Core } from "./author";
import { authorEngine, promptApi, type Availability, type Engine, type Session } from "./engine";
import { decide, DECIDE_SCHEMA, gist, verify, write, type Material } from "./prompts";
import {
  clean,
  foundIn,
  gistOf,
  hashOf,
  parts,
  rank,
  replyPart,
  restates,
  scenarioOf,
  sections,
  SECTION,
  type Passage,
} from "./text";

/** The most replies in one thread, and the wait between two comments' replies. */
const MAX_REPLIES = 3;
const PACE_MS = 1500;
/** The sections looked at closely for one comment, and the sentences a reply may rest on. */
const LOOKS = 8;
const HITS = 3;
/** The model is freed after this long unused. */
const IDLE_MS = 5 * 60_000;
const READING = "AI assistant is reading this…";
const RELATED = "This may be related:";
const SEEN = "Reviewed by AI · nothing to add";
const BLOCKS = "p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,figcaption,dt,dd";
/** A ring and a dot: the mark of an AI reply, small. */
const ICON = ["M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z", "M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19z"];
const CSS = `.assist-p{margin:0 0 10px}.assist-note{color:var(--pu-faint)}
.assist-facts{margin:0 0 12px;padding:0;list-style:none;font-size:12.5px}
.assist-facts li{display:grid;grid-template-columns:76px 1fr;gap:8px;padding:5px 0;border-top:1px solid var(--pu-line)}
.assist-facts li span:first-child{color:var(--pu-faint)}
.assist-bar{height:3px;border-radius:2px;background:var(--pu-line);overflow:hidden;margin:8px 0 6px}
.assist-bar i{display:block;height:100%;width:0;background:var(--pu-accent);border-radius:2px;transition:width .3s var(--pu-ease)}
.assist-btns{display:flex;gap:8px;flex-wrap:wrap}
.assist-btns button{font:inherit;color:inherit;background:none;cursor:pointer;padding:6px 12px;border:1px solid var(--pu-line);border-radius:8px;transition:background-color .2s var(--pu-ease),opacity .2s var(--pu-ease)}
.assist-btns button:hover,.assist-btns button:focus-visible{background:var(--pu-hover);outline:none}
.assist-btns button:disabled{opacity:.5;cursor:default}.assist-btns .assist-go{color:var(--pu-accent)}`;

/** Where a reference pill goes: the notes' heading, the slide, or the passage on this page. */
const pointer = (p: Passage): string =>
  p.url ?? (p.slide ? `slide:${p.slide}` : `quote:${encodeURIComponent(p.text.slice(0, 40))}`);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isAi = (c: Comment): boolean => c.name === NAME || c.name.startsWith("AI assistant ");

/** The comments people wrote in a thread, in order; the assistant's own are not counted. */
const people = (t: Thread): Comment[] => [t.root, ...t.root.replies].filter((c) => !c.deleted && !isAi(c));
/** What a thread held when it was looked at: how many comments by people, and how many were edited. */
const stampOf = (t: Thread): string => `${people(t).length}:${people(t).filter((c) => c.edited).length}`;
const last = (t: Thread): Comment => t.root.replies.at(-1) ?? t.root;
const aiCount = (t: Thread): number => t.root.replies.filter(isAi).length;
const when = (t: Thread): number => Math.max(t.root.at, ...t.root.replies.map((r) => r.at));

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Pages the author named for the assistant to read and link to: Markdown files on this site. */
const notesNamed = (): string[] =>
  (document.documentElement.getAttribute("data-pipeup-assist-notes") ?? "").split(/[\s,]+/).filter(Boolean);

export function createAddon(): PipeupAddon {
  return {
    id: "assist",
    api: 1,
    version: "0.5.1",
    needs: ["menu", "notify", "note", "panel", "styles", "status", "sign"],
    network: {
      when: "after-consent",
      to: ["the browser maker's model download", "notes files on this site"],
      says: "Only after you turn it on: your browser may download a small AI model once. Comments and the page are read on this device and never sent anywhere; if the page's author named notes files, they are read from this site.",
    },
    setup(host) {
      const engine: Engine = authorEngine() ?? promptApi;
      const c = core() as Core;
      if (!c.signOp || !c.computeOpId || !c.createIdentity)
        return host.off("this page has no Pipeup core to sign replies with");
      const offStyles = host.addStyles(CSS);

      let store: Settings | undefined;
      let on = false;
      let avail: Availability = "none";
      let checked: Record<string, string> = {};
      let who: Identity | undefined;
      let session: Session | undefined;
      let idle = 0;
      let busy = false;
      let stopped = new AbortController();
      let replied = 0;
      let looked = 0;
      /** What the first reading made of each section, by its fingerprint ("" when it could not be read). */
      let index: Record<string, string> = {};
      let pool: Passage[] = [];
      let panel: { close(): void } | undefined;
      let row: ItemHandle | null = null;
      const notes: Passage[] = [];
      let reading: string | null = null;
      /** Marks the threads it has looked at and had nothing to add to (and the one it is reading now). */
      const syncMarks = () => {
        for (const t of host.document.threads()) {
          const seen = on && !t.resolved && checked[t.id] === stampOf(t) && aiCount(t) === 0;
          host.setThreadMark(t.id, reading === t.id ? READING : seen ? SEEN : null);
        }
      };
      /** Redraws the menu row, if it is showing. */
      const updateRow = () => (row as ItemHandle | null)?.update();

      const lowMemory = (): boolean => {
        const gb = (navigator as { deviceMemory?: number }).deviceMemory;
        return gb !== undefined && gb < 4;
      };
      let left = 0;
      let all = 0;
      const status = (total = all, todo = left) => {
        all = total;
        left = todo;
        if (!on) return host.setStatus(null);
        const parts = [`Assistant · on this device`];
        if (todo) parts.push(`reading the page… ${total - todo} of ${total}`);
        if (looked) parts.push(`checked ${looked} comment${looked === 1 ? "" : "s"}, replied to ${replied}`);
        host.setStatus({ text: parts.join(" · ") });
      };

      /** Every part of the page, a deck's slides and the notes, in sections that each fit a small model; nothing cut. */
      const gather = (): Passage[] => {
        const out: Passage[] = [];
        const add = (label: string, text: string, e?: Element, slide?: string, url?: string) => {
          for (const part of parts(text))
            out.push({ label, text: part, el: e, slide, url, hash: hashOf(`${label}\n${part}`) });
        };
        // A deck's slides are read whole, one section each, so a short bullet ("Hold churn under 3%.") counts.
        const slides = new Map<string, { texts: string[]; el: Element }>();
        let label = "This page";
        let texts: string[] = [];
        let first: Element | undefined;
        const flush = () => {
          if (texts.length) add(label, texts.join(" "), first);
          texts = [];
          first = undefined;
        };
        for (const e of host.root.querySelectorAll(BLOCKS)) {
          if (e.closest("[data-pipeup-ignore]")) continue;
          const text = (e.textContent ?? "").replace(/\s+/g, " ").trim();
          if (!text) continue;
          const slide = host.where(e)?.slide;
          if (slide) {
            const s = slides.get(slide) ?? { texts: [], el: e.closest("[data-pipeup-slide]") ?? e };
            s.texts.push(text);
            slides.set(slide, s);
            continue;
          }
          // A heading starts a new section, unless the one before it holds hardly anything yet.
          if (/^H[1-6]$/.test(e.tagName)) {
            if (texts.join(" ").length >= 60) flush();
            label = text.slice(0, 60);
          }
          if (texts.join(" ").length + text.length > SECTION) flush();
          first ??= e;
          texts.push(text);
        }
        flush();
        for (const [slide, s] of slides) add(`Slide ${slide}`, s.texts.join(" · "), s.el, slide);
        for (const n of notes) add(n.label, n.text, undefined, undefined, n.url);
        return out;
      };

      /** The sections not read yet, and how many there are in all. */
      const unread = (): { todo: Passage[]; total: number } => {
        pool = gather();
        for (const p of pool) p.extra = index[p.hash!];
        return { todo: pool.filter((p) => index[p.hash!] === undefined), total: pool.length };
      };

      const loadNotes = async () => {
        notes.length = 0;
        for (const name of notesNamed()) {
          const url = new URL(name, location.href);
          if (url.origin !== location.origin) continue;
          try {
            const res = await fetch(url, { credentials: "omit" });
            if (res.ok) notes.push(...sections(await res.text(), name, url.href));
          } catch {
            /* a notes file that can't be read is just not used */
          }
        }
      };

      /** The words of the block a comment is about. */
      const blockOf = (t: Thread): { text: string; full: string; el: Element | null; slide?: string } => {
        let e: Element | null = null;
        try {
          const r = c.resolveAnchor?.(t.anchor, host.root, { fuzzy: false });
          e = r?.element ?? r?.range?.startContainer.parentElement ?? null;
        } catch {
          /* the anchor can't be found: the snapshot stands in */
        }
        const block = e?.closest(BLOCKS) ?? e;
        const text = (t.anchor.quote?.exact ?? block?.textContent ?? t.anchor.snapshot)
          .replace(/\s+/g, " ")
          .trim();
        const full = (block?.textContent ?? text).replace(/\s+/g, " ").trim();
        return {
          text: text.slice(0, 400),
          full,
          el: block ?? null,
          slide: e ? host.where(e)?.slide : undefined,
        };
      };

      const getSession = async (): Promise<Session> => {
        window.clearTimeout(idle);
        session ??= await engine.create({ signal: stopped.signal });
        idle = window.setTimeout(() => {
          session?.destroy();
          session = undefined;
        }, IDLE_MS);
        return session;
      };

      const identity = async (): Promise<Identity> => {
        if (who) return who;
        who = await store?.get<Identity>("identity").catch(() => undefined);
        if (!who) {
          who = await c.createIdentity();
          await store?.set("identity", who).catch(() => undefined);
        }
        return who;
      };

      const saveChecked = () => store?.set(`checked:${host.document.id}`, checked).catch(() => undefined);

      /** Adds the assistant's reply to a thread. */
      const post = async (t: Thread, text: string) => {
        const op = await replyOp(c as Core, await identity(), host.document.id, t, text, host.document.ops());
        if (await host.merge([op])) replied++;
      };

      /** Looks at one thread: decides whether a reply would help, and if so writes it into the thread. */
      const handle = async (t: Thread): Promise<void> => {
        const stamp = stampOf(t);
        reading = t.id;
        host.setThreadMark(t.id, READING);
        // Marked first, so a failure is never a loop: it is looked at again only when something is added.
        checked[t.id] = stamp;
        looked++;
        await saveChecked();
        status();
        const comments = people(t);
        const latest = comments.at(-1) ?? t.root;
        const block = blockOf(t);
        const m: Material = {
          comment: latest.text,
          passage: block.text,
          thread: [t.root, ...t.root.replies]
            .map((x) => `${isAi(x) ? "Assistant" : x.name || "Someone"}: ${x.text}`)
            .join("\n")
            .slice(0, 1200),
        };
        const s = await getSession();
        const kind = scenarioOf(await s.prompt(decide(m), { schema: DECIDE_SCHEMA, signal: stopped.signal }));
        if (kind === "none") return;
        if (kind === "related") {
          const used: Passage[] = [];
          // The likely sections, from everything read; then each read in full for the sentence that bears on it.
          pool = gather();
          for (const p of pool) p.extra = index[p.hash!];
          const likely = rank(
            pool.filter((p) => !(p.slide && p.slide === block.slide)),
            `${m.comment} ${block.text}`,
            LOOKS,
          );
          for (const p of likely) {
            const sentence = foundIn(p.text, await s.prompt(verify(m, p.text), { signal: stopped.signal }));
            if (sentence && !restates(sentence, block.full)) used.push({ ...p, text: sentence });
            if (used.length >= HITS) break;
          }
          if (!used.length) return;
          // Only pointers, no written answer: each pill shows the sentence it points to when hovered.
          return post(
            t,
            `${RELATED}\n\n${used.map((p, i) => `[${i + 1}]: ${pointer(p)} ${p.label.slice(0, 30)} | ${p.text.slice(0, 300)}`).join("\n")}`,
          );
        }
        let raw = "";
        try {
          for await (const piece of s.stream(write(kind, m), { signal: stopped.signal })) {
            raw += piece;
            const shown = replyPart(raw);
            // Not shown until there is something to read, and never the model's "none".
            if (shown && !/^none\b/i.test(shown)) host.setThreadNote(t.id, shown.slice(0, 320));
          }
          const supplied = `${m.comment} ${m.passage} ${m.thread}`;
          const text = clean(raw, m.comment, supplied);
          // A reply that only says again what the commented words say tells the reviewer nothing.
          if (!text || restates(text, block.full)) return;
          await post(t, text);
        } finally {
          host.setThreadNote(t.id, null);
        }
      };

      /** Threads that have grown since they were looked at, newest first. */
      const waiting = (): Thread[] =>
        host.document
          .threads()
          .filter(
            (t) => !t.resolved && checked[t.id] !== stampOf(t) && aiCount(t) < MAX_REPLIES && !isAi(last(t)),
          )
          .sort((a, b) => when(b) - when(a));

      const held = async (): Promise<boolean> => {
        if (document.hidden) return true;
        try {
          const b = await (
            navigator as { getBattery?: () => Promise<{ level: number; charging: boolean }> }
          ).getBattery?.();
          if (b && !b.charging && b.level < 0.2) return true;
        } catch {
          /* no battery to ask about */
        }
        return false;
      };

      /** Reads the next unread section into the index. False when everything has been read (or it cannot). */
      const readOne = async (): Promise<boolean> => {
        const { todo, total } = unread();
        const p = todo[0];
        if (!p) {
          reading = null;
          status(total, 0);
          return false;
        }
        try {
          const s = await getSession();
          index[p.hash!] = gistOf(await s.prompt(gist(p.label, p.text), { signal: stopped.signal }));
        } catch (e) {
          if (stopped.signal.aborted) return false;
          // A section that can't be read is not tried again; it can still be found by its own words.
          index[p.hash!] = "";
          globalThis.reportError?.(e);
        }
        const live = new Set(pool.map((x) => x.hash!));
        index = Object.fromEntries(Object.entries(index).filter(([h]) => live.has(h)));
        await store?.set(`index:${host.document.id}`, index).catch(() => undefined);
        status(total, todo.length - 1);
        updateRow();
        await sleep(200);
        return true;
      };

      const pump = async () => {
        if (busy || !on) return;
        busy = true;
        try {
          while (on && !(await held())) {
            const t = waiting()[0];
            if (!t) {
              if (!(await readOne())) break;
              continue;
            }
            try {
              await handle(t);
              reading = null;
              syncMarks();
            } catch (e) {
              reading = null;
              syncMarks();
              if (stopped.signal.aborted) break;
              host.setThreadNote(t.id, null);
              globalThis.reportError?.(e);
            }
            status();
            await sleep(PACE_MS);
          }
        } finally {
          busy = false;
        }
      };

      const offChange = host.document.onChange(() => {
        syncMarks();
        void pump();
      });
      const onVisible = () => void pump();
      document.addEventListener("visibilitychange", onVisible);

      const turnOn = async () => {
        on = true;
        stopped = new AbortController();
        await store?.set("on", true);
        await loadNotes();
        status();
        syncMarks();
        updateRow();
        void pump();
      };
      const turnOff = async () => {
        on = false;
        stopped.abort();
        window.clearTimeout(idle);
        session?.destroy();
        session = undefined;
        await store?.set("on", false);
        status();
        syncMarks();
        updateRow();
      };

      /** The consent panel: what it does, which model, what it costs, and that nothing leaves the device. */
      const ask = (): void => {
        panel?.close();
        const box = el("div");
        box.append(
          el(
            "p",
            "assist-p",
            "A small AI model on this device can read each comment and, when it helps, add a short reply that points to related parts of this page.",
          ),
          el(
            "p",
            "assist-p assist-note",
            "Your comments and this page stay on this device. Nothing is sent anywhere. Its replies appear in the thread, marked as the assistant's, and anyone sharing this page will see them.",
          ),
        );
        const facts = el("ul", "assist-facts");
        const fact = (k: string, v: string) => {
          const li = el("li");
          li.append(el("span", "", k), el("span", "", v));
          facts.append(li);
        };
        fact("Model", `${engine.info.name}${engine.info.maker ? `, from ${engine.info.maker}` : ""}`);
        fact(
          "Download",
          avail === "ready" ? "None, it is already here" : (engine.info.download ?? "Once, then it is kept"),
        );
        fact("Memory", engine.info.memory ?? "About 1 GB while it writes, then freed");
        const named = notesNamed();
        fact("Reads", named.length ? `This page, and ${named.join(", ")} on this site` : "This page");
        box.append(facts);
        if (store && !store.lasting)
          box.append(el("p", "assist-p assist-note", "This browser won't remember this choice."));
        const bar = el("div", "assist-bar");
        const fill = el("i");
        bar.append(fill);
        bar.hidden = true;
        const say = el("p", "assist-p assist-note");
        say.hidden = true;
        const go = el("button", "assist-go", avail === "ready" ? "Turn on" : "Download and turn on");
        const no = el("button", "", "Not now");
        go.type = no.type = "button";
        const btns = el("div", "assist-btns");
        btns.append(go, no);
        box.append(bar, say, btns);
        go.onclick = async () => {
          go.disabled = true;
          if (avail !== "ready") {
            bar.hidden = say.hidden = false;
            say.textContent = "Downloading the model, once. You can keep reading and commenting.";
          }
          try {
            session ??= await engine.create({
              signal: stopped.signal,
              onProgress: (f) => (fill.style.width = `${Math.round(f * 100)}%`),
            });
            avail = "ready";
            await store?.set("consent", engine.info.name);
            panel?.close();
            await turnOn();
          } catch {
            bar.hidden = true;
            say.hidden = false;
            say.textContent = "That didn't work, so nothing was turned on. You can try again.";
            go.disabled = false;
          }
        };
        no.onclick = () => panel?.close();
        panel = host.openPanel(box, { label: "Assistant replies", onClose: () => (panel = undefined) });
      };

      const item: MenuItem = {
        id: "assist",
        icon: ICON,
        label: () => "Assistant replies",
        hint: () =>
          avail === "none"
            ? "This browser has no built-in model, and the page didn't add one."
            : "A model on this device adds short replies to comments.",
        checked: () => on,
        count: () =>
          avail === "none" ? "Not available" : on && left ? `Reading ${all - left} of ${all}` : "",
        select: () => {
          if (avail === "none")
            return host.notify(
              "Assistant replies aren't available here: this browser has no model on this device.",
            );
          if (on) return void turnOff();
          void store
            ?.get<string>("consent")
            .then((c0) => (c0 === engine.info.name && avail === "ready" ? turnOn() : ask()));
        },
      };
      // The row shows only while comments do (comment mode, All comments, or a comment being written): the
      // assistant belongs to reviewing, so it stays out of the menu otherwise. It keeps working either way.
      const offUi = host.onUi((ui) => {
        if (ui.shown && !row) row = host.addMenuItem(item);
        else if (!ui.shown && row) {
          row.remove();
          row = null;
        }
      });

      // Settings, availability and what was already looked at come in the background; the row is there meanwhile.
      void (async () => {
        store = await settings("assist", { memory: host.ephemeral });
        avail = lowMemory() ? "none" : await engine.availability();
        checked =
          (await store.get<Record<string, string>>(`checked:${host.document.id}`).catch(() => undefined)) ??
          {};
        index =
          (await store.get<Record<string, string>>(`index:${host.document.id}`).catch(() => undefined)) ?? {};
        updateRow();
        if (avail === "ready" && (await store.get<boolean>("on").catch(() => false))) await turnOn();
      })();

      return () => {
        on = false;
        stopped.abort();
        window.clearTimeout(idle);
        session?.destroy();
        offChange();
        offUi();
        document.removeEventListener("visibilitychange", onVisible);
        panel?.close();
        offStyles();
      };
    },
  };
}
