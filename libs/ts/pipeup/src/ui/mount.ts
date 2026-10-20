import { parseDocumentAttribute } from "../crypto/seal";
import { PipeupDocument } from "../document";
import { IndexedDbStore } from "../storage/indexeddb";
import { loadOrCreateProfile, MemoryStore, type OpStore, type Profile } from "../storage/store";
import { fingerprint } from "../util/encoding";
import { addons, attachAddons, drainQueue, firstCore } from "./addons";
import { startApp } from "./app";
import { setSlideHook, type SlideHook } from "./here";
import { BUILT, VERSION } from "../core";
import { agentComments, type AgentComments } from "../export/agent";
import type { Appearance } from "./legible";
import { setGiven, setting } from "./settings";
// Last, so the bundles carry the stylesheet after the code: it compresses better there.
import { STYLES } from "./styles";

export interface MountOptions {
  /** The area people can comment on. Default: document.body. */
  root?: Element;
  /** The reviewer's name. Without one they show as their animal until they add a name. */
  name?: string;
  /** Where comments are kept. Default: this browser's IndexedDB. */
  store?: OpStore;
  /** A deck's own slide functions (1-based); they replace Pipeup's following of the deck. */
  slides?: SlideHook;
  /** The document identity, as `data-pipeup-doc` would give it (for hosts that write their own `<html>`). */
  doc?: string;
  /** "column" or "bubbles", as `data-pipeup-layout`. */
  layout?: string;
  /** "light" or "dark", as `data-pipeup-theme`. */
  theme?: string;
  /** "comment-mode": selecting words offers a comment only in comment mode, as `data-pipeup-select`. */
  select?: string;
}

/** What the page's code hears: comment mode and the reviewer's name ("" until they give one). */
export interface PipeupState {
  commentMode: boolean;
  name: string;
}

/** Why Pipeup didn't start: `code` for the page's code, the message for people. */
export type MountErrorCode = "another-copy" | "failed";
export interface MountError extends Error {
  code: MountErrorCode;
}

const failure = (code: MountErrorCode, message: string, cause?: unknown): MountError =>
  Object.assign(new Error(`pipeup: ${message}`, { cause }), { code });

export interface PipeupInstance {
  readonly document: PipeupDocument;
  /** The page's comments, for an agent: open threads, or every thread with `all`. */
  comments(options?: { all?: boolean }): AgentComments;
  /** How Pipeup looks and why (for `pipeup check` and agents): its look, who chose it, and what the page's styles do to it. */
  appearance(): Appearance;
  flush(): Promise<void>;
  unmount(): void;
  /** Comment mode is on. */
  readonly commentMode: boolean;
  /** Turns comment mode on or off; resolves once it has changed. */
  setCommentMode(on: boolean): Promise<void>;
  /** The reviewer's name, or "" while they show as their animal. */
  readonly name: string;
  /** Sets the reviewer's name, kept as if they had typed it. */
  setName(name: string): Promise<void>;
  /** Calls `fn` whenever comment mode or the name changes, however it changed; returns a function that stops it. */
  on(event: "change", fn: (state: PipeupState) => void): () => void;
}

let current: Promise<PipeupInstance> | null = null;
const STORE_OPEN_TIMEOUT_MS = 4000;

/** Adds Pipeup to the page. Calling it again returns the same instance. */
export function mount(options: MountOptions = {}): Promise<PipeupInstance> {
  // A second copy of Pipeup on the page hands over to the first, which owns the add-ons.
  if (firstCore) return firstCore.mount(options) as Promise<PipeupInstance>;
  if (!drainQueue())
    return Promise.reject(
      failure("another-copy", "another copy of Pipeup owns the add-on queue. Remove one script."),
    );
  if (current) return current;
  const p: Promise<PipeupInstance> = start(options, () => p).catch((e: unknown) => {
    if (current === p) current = null;
    setGiven(null);
    throw (e as MountError)?.code
      ? e
      : failure("failed", `Pipeup couldn't start: ${String((e as Error)?.message ?? e)}`, e);
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
  setGiven({
    "data-pipeup-doc": o.doc,
    "data-pipeup-layout": o.layout,
    "data-pipeup-theme": o.theme,
    "data-pipeup-select": o.select,
  });
  const attr = setting("data-pipeup-doc");
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
  // Ask the browser not to clear what Pipeup keeps (best effort): a cleared browser would start the reviewer over.
  void navigator.storage?.persist?.().catch(() => {});
  const doc = await PipeupDocument.open({
    doc: id,
    key,
    store: kept,
    identity: profile.identity,
    name: profile.name,
  });
  // The hook is needed while the app starts; if starting fails it must not outlive the failure.
  setSlideHook(o.slides ?? null);
  // The page's code hears comment mode and the name changing, once per change, after Pipeup has drawn it.
  const heard = new Set<(state: PipeupState) => void>();
  let said = "";
  const tell = () =>
    queueMicrotask(() => {
      if (!app || unmounted) return;
      const state: PipeupState = { commentMode: app.ctx.state.commenting, name: doc.name };
      const key = JSON.stringify(state);
      if (key === said) return;
      said = key;
      for (const fn of [...heard])
        try {
          fn({ ...state });
        } catch (e) {
          globalThis.reportError?.(e);
        }
    });
  const saveName = async (name: string) => {
    doc.name = name;
    profile = { ...profile, name };
    tell();
    await kept.saveProfile(profile);
  };
  let app: ReturnType<typeof startApp> | undefined;
  let unmounted = false;
  try {
    app = startApp({
      doc,
      styles: STYLES,
      root: o.root ?? document.body,
      onName: saveName,
      onRender: tell,
    });
  } catch (e) {
    setSlideHook(null);
    throw e;
  }
  const started = app;
  if (ephemeral)
    started.ctx.toast(
      "This browser can't keep comments for this page — copy the comments (Copy comments › As Markdown) to keep them",
    );
  const onHide = () => void doc.flush().catch((e: unknown) => globalThis.reportError?.(e));
  // Add-ons set up now, after the "can't keep comments" notice, in registration order.
  const detach = attachAddons({
    surface: started.ctx.addons,
    doc,
    root: o.root ?? document.body,
    ephemeral,
    version: VERSION,
    onIdentity: async (identity) => {
      profile = { ...profile, identity };
      await kept.saveProfile(profile);
    },
  });
  // Agent support is an add-on: a page that lists an agent without it is told once, in the console, and loses nothing else.
  const agentsWarning = /\S/.test(setting("data-pipeup-agents") ?? "")
    ? window.setTimeout(() => {
        if (!addons().some((a) => a.id === "agents"))
          console.warn(
            "pipeup: this page lists an agent (data-pipeup-agents), but the agents add-on isn't on the page, so replies won't show. Add @pipeup/agents (see the Add-ons page).",
          );
      }, 1000)
    : 0;
  // A Pipeup over a year old says so once, in the console (nothing is sent anywhere to find out); the author can silence it.
  if (setting("data-pipeup-updates") !== "off" && Date.now() - Date.parse(BUILT) > 365 * 864e5)
    console.info(
      `pipeup: this is Pipeup ${VERSION}, from ${BUILT}; newer versions exist. See https://github.com/pipeup-ai/pipeup/blob/main/CHANGELOG.md`,
    );
  window.addEventListener("pagehide", onHide);
  return {
    document: doc,
    comments: ({ all = false } = {}) =>
      agentComments(started.ctx.menu.all(), {
        title: document.title,
        url: location.href,
        exportedAt: new Date(),
        all,
      }),
    appearance: () => ({ ...started.appearance() }),
    flush: () => doc.flush(),
    get commentMode() {
      return started.ctx.state.commenting;
    },
    setCommentMode: async (on: boolean) => {
      if (!unmounted) started.ctx.setCommenting(Boolean(on));
    },
    get name() {
      return doc.name;
    },
    setName: async (typed: string) => {
      // As the document keeps it: one line, single spaces. An empty name keeps the one there is.
      const name = String(typed).replace(/\s+/g, " ").trim();
      if (!name || name === doc.name || unmounted) return;
      await saveName(name);
      started.ctx.render();
    },
    on: (event, fn) => {
      if (event !== "change" || typeof fn !== "function") return () => {};
      heard.add(fn);
      return () => heard.delete(fn);
    },
    unmount: () => {
      if (unmounted) return;
      unmounted = true;
      heard.clear();
      setGiven(null);
      window.removeEventListener("pagehide", onHide);
      window.clearTimeout(agentsWarning);
      detach();
      started.destroy();
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

/** Pages that set data-pipeup-doc (on <html> or a loading line) mount themselves, unless data-pipeup-auto="off". */
export function autoMount(): void {
  if (setting("data-pipeup-doc") === null || setting("data-pipeup-auto") === "off") return;
  const go = () => void mount().catch((e: unknown) => console.error(e));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
