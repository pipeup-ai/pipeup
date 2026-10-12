import { parseDocumentAttribute } from "../crypto/seal";
import { PipeupDocument } from "../document";
import { IndexedDbStore } from "../storage/indexeddb";
import { loadOrCreateProfile, MemoryStore, type OpStore, type Profile } from "../storage/store";
import { fingerprint } from "../util/encoding";
import { attachAddons, drainQueue, firstCore } from "./addons";
import { startApp } from "./app";
import { setSlideHook, type SlideHook } from "./here";
import { VERSION } from "../core";
import { copyAll } from "../export/format";
import { isAiName, nameOf } from "../model/animals";

export interface MountOptions {
  /** The area people can comment on. Default: document.body. */
  root?: Element;
  /** The reviewer's name. Without one they show as their animal until they add a name. */
  name?: string;
  /** Where comments are kept. Default: this browser's IndexedDB. */
  store?: OpStore;
  /** A deck's own slide functions (1-based); they replace Pipeup's following of the deck. */
  slides?: SlideHook;
}

/** One thread as an agent reads it. */
export interface AgentThread {
  /** The id to answer a thread by. */
  id: string;
  state: "open" | "addressed" | "resolved";
  where: string;
  /** The page's `data-pipeup-id` for the block, when it has one. */
  element?: string;
  quote?: string;
  pin?: string;
  addressed?: { note: string; by: string };
  comments: { id: string; by: string; agent: boolean; at: string; text: string }[];
}

export interface AgentComments {
  /** The same Markdown as Copy as Markdown. */
  markdown: string;
  threads: AgentThread[];
}

export interface PipeupInstance {
  readonly document: PipeupDocument;
  /** The page's comments, for an agent: open threads, or every thread with `all`. */
  comments(options?: { all?: boolean }): AgentComments;
  flush(): Promise<void>;
  unmount(): void;
}

let current: Promise<PipeupInstance> | null = null;
const STORE_OPEN_TIMEOUT_MS = 4000;

/** Adds Pipeup to the page. Calling it again returns the same instance. */
export function mount(options: MountOptions = {}): Promise<PipeupInstance> {
  // A second copy of Pipeup on the page hands over to the first, which owns the add-ons.
  if (firstCore) return firstCore.mount(options) as Promise<PipeupInstance>;
  if (!drainQueue())
    return Promise.reject(
      new Error("pipeup: another copy of Pipeup owns the add-on queue. Remove one script."),
    );
  if (current) return current;
  const p: Promise<PipeupInstance> = start(options, () => p).catch((e: unknown) => {
    if (current === p) current = null;
    throw e;
  });
  current = p;
  return p;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });
}

async function start(o: MountOptions, self: () => Promise<PipeupInstance>): Promise<PipeupInstance> {
  const attr = document.documentElement.getAttribute("data-pipeup-doc");
  const { id, key } = attr
    ? await parseDocumentAttribute(attr)
    : { id: `page-${fingerprint(location.origin + location.pathname)}`, key: null };
  let kept: OpStore;
  let ephemeral = false;
  let profile: Profile;
  if (o.store) {
    kept = o.store;
    profile = await loadOrCreateProfile(kept);
  } else {
    try {
      const openPromise = IndexedDbStore.open();
      kept = await withTimeout(openPromise, STORE_OPEN_TIMEOUT_MS).catch((e) => {
        // If the open finishes after giving up, nothing will use it: close it.
        openPromise.then(
          (s) => s.close(),
          () => {},
        );
        throw e;
      });
      profile = await loadOrCreateProfile(kept);
    } catch {
      kept = new MemoryStore();
      ephemeral = true;
      profile = await loadOrCreateProfile(kept);
    }
  }
  const given = o.name?.trim();
  if (given && given !== profile.name) {
    profile = { ...profile, name: given };
    await kept.saveProfile(profile);
  }
  const doc = await PipeupDocument.open({
    doc: id,
    key,
    store: kept,
    identity: profile.identity,
    name: profile.name,
  });
  // The hook is needed while the app starts; if starting fails it must not outlive the failure.
  setSlideHook(o.slides ?? null);
  let app: ReturnType<typeof startApp>;
  try {
    app = startApp({
      doc,
      root: o.root ?? document.body,
      onName: async (name) => {
        doc.name = name;
        profile = { ...profile, name };
        await kept.saveProfile(profile);
      },
    });
  } catch (e) {
    setSlideHook(null);
    throw e;
  }
  if (ephemeral)
    app.ctx.toast(
      "This browser can't keep comments for this page — copy the comments (Copy as Markdown) to keep them",
    );
  const onHide = () => void doc.flush().catch((e: unknown) => globalThis.reportError?.(e));
  // Add-ons set up now, after the "can't keep comments" notice, in registration order.
  const detach = attachAddons({
    surface: app.ctx.addons,
    doc,
    root: o.root ?? document.body,
    ephemeral,
    version: VERSION,
  });
  let unmounted = false;
  window.addEventListener("pagehide", onHide);
  return {
    document: doc,
    comments: ({ all = false } = {}) => {
      const items = app.ctx.menu.all();
      const markdown = copyAll(items, "ai", {
        title: document.title,
        url: location.href,
        exportedAt: new Date(),
        all,
      });
      const threads = items
        .filter((i) => all || !i.thread.resolved)
        .map(({ thread: t, location: l }): AgentThread => {
          const out: AgentThread = {
            id: t.id,
            state: t.resolved ? "resolved" : t.addressed ? "addressed" : "open",
            where: l.where,
            comments: [t.root, ...t.root.replies].map((c) => ({
              id: c.id,
              by: nameOf(c),
              agent: isAiName(c.name),
              at: new Date(c.at).toISOString(),
              text: c.deleted ? "" : c.text,
            })),
          };
          if (l.id) out.element = l.id;
          if (l.quote) out.quote = l.quote;
          if (l.pin) out.pin = l.pin;
          if (t.addressed && !t.resolved) out.addressed = { note: t.addressed.text, by: nameOf(t.addressed) };
          return out;
        });
      return { markdown, threads };
    },
    flush: () => doc.flush(),
    unmount: () => {
      if (unmounted) return;
      unmounted = true;
      window.removeEventListener("pagehide", onHide);
      detach();
      app.destroy();
      setSlideHook(null);
      if (current === self()) current = null;
    },
  };
}

/** The page's comments for an agent that is looking at the page: waits for Pipeup to start, then reads them. */
export async function comments(options?: { all?: boolean }): Promise<AgentComments> {
  if (!current) throw new Error("pipeup: Pipeup hasn't started on this page");
  return (await current).comments(options);
}

/** Pages that carry data-pipeup-doc mount themselves, unless data-pipeup-auto="off". */
export function autoMount(): void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-pipeup-doc") || html.getAttribute("data-pipeup-auto") === "off") return;
  const go = () => void mount().catch((e: unknown) => console.error(e));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
