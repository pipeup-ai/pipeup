import { parseDocumentAttribute } from "../crypto/seal";
import { PipeupDocument } from "../document";
import { IndexedDbStore } from "../storage/indexeddb";
import { loadOrCreateProfile, MemoryStore, type OpStore, type Profile } from "../storage/store";
import { fingerprint } from "../util/encoding";
import { startApp } from "./app";

export interface MountOptions {
  /** The area people can comment on. Default: document.body. */
  root?: Element;
  /** The reviewer's name. Without one they show as their animal until they add a name. */
  name?: string;
  /** Where comments are kept. Default: this browser's IndexedDB. */
  store?: OpStore;
}

export interface PipeupInstance {
  readonly document: PipeupDocument;
  flush(): Promise<void>;
  unmount(): void;
}

let current: Promise<PipeupInstance> | null = null;
const STORE_OPEN_TIMEOUT_MS = 4000;

/** Adds Pipeup to the page. Calling it again returns the same instance. */
export function mount(options: MountOptions = {}): Promise<PipeupInstance> {
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
  const app = startApp({
    doc,
    root: o.root ?? document.body,
    onName: async (name) => {
      doc.name = name;
      profile = { ...profile, name };
      await kept.saveProfile(profile);
    },
  });
  if (ephemeral)
    app.ctx.toast(
      "This browser can't keep comments for this page — copy the comments (Copy as Markdown) to keep them",
    );
  const onHide = () => void doc.flush().catch((e: unknown) => globalThis.reportError?.(e));
  let unmounted = false;
  window.addEventListener("pagehide", onHide);
  return {
    document: doc,
    flush: () => doc.flush(),
    unmount: () => {
      if (unmounted) return;
      unmounted = true;
      window.removeEventListener("pagehide", onHide);
      app.destroy();
      if (current === self()) current = null;
    },
  };
}

/** Pages that carry data-pipeup-doc mount themselves, unless data-pipeup-auto="off". */
export function autoMount(): void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-pipeup-doc") || html.getAttribute("data-pipeup-auto") === "off") return;
  const go = () => void mount().catch((e: unknown) => console.error(e));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
