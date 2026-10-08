import type { Listener, PipeupDocument } from "../document";
import { animalName } from "../model/animals";
import type { SignedOp, Thread } from "../model/types";
import { avatar } from "./animals";
import { setComposerSource, type ComposerTool } from "./composer";
import type { Ctx } from "./context";
import { h } from "./dom";
import type { ViewState } from "./here";
import { draw } from "./icons";

/** Bumped only for breaking changes to the add-on object, the host, AddonDocument or the data slots. */
export const ADDON_API = 1;

export type Teardown = () => void;
export type Off = () => void;

export type Capability =
  | "sync"
  | "menu"
  | "notify"
  | "note"
  | "composer"
  | "panel"
  | "styles"
  | "status"
  | "overlay"
  | "here"
  | "sign";

const CAPABILITIES: readonly Capability[] = [
  "sync",
  "menu",
  "notify",
  "note",
  "composer",
  "panel",
  "styles",
  "status",
  "overlay",
  "here",
  "sign",
];

export interface NetworkUse {
  when: "never" | "after-consent" | "page-configured";
  /** Hosts; "page" is an address the page names. */
  to: readonly string[];
  /** One plain sentence: what leaves the device, and who sees what. */
  says: string;
}

export interface AddonInfo {
  id: string;
  version: string;
  network: NetworkUse;
  /** waiting: registered, Pipeup not mounted yet (or unmounted). */
  state: "waiting" | "on" | "off" | "failed";
  /** Why it is off or failed, in words. */
  reason?: string;
}

export interface PipeupAddon {
  /** /^[a-z][a-z0-9-]{1,23}$/; also the source of everything it merges. */
  readonly id: string;
  /** The add-on API it was written for; must equal ADDON_API while 0.x. */
  readonly api: number;
  readonly version: string;
  /** Slots it can't work without. A missing one keeps it off, with a reason. */
  readonly needs: readonly Capability[];
  /** What it sends where: for people, docs and `pipeup check`. */
  readonly network: NetworkUse;
  /** Once per mount. May return a teardown for what the add-on itself opened. */
  setup(host: AddonHost): void | Teardown | Promise<void | Teardown>;
}

export type { Listener };

/** What add-ons see of the document: read only. Ops from elsewhere go in through `host.merge`. */
export interface AddonDocument {
  readonly id: string;
  /** This reviewer's public key: share sends only ops with author === me. */
  readonly me: string;
  threads(): readonly Thread[];
  ops(): readonly SignedOp[];
  onChange(fn: Listener): Off;
}

export interface MenuItem {
  id: string;
  /** 24-unit SVG path data, drawn by Pipeup; never markup. */
  icon: readonly string[];
  /** Short: the menu is 290 px wide and truncates. */
  label(): string;
  /** Tooltip and aria-description. */
  hint(): string;
  /** Present: a switch row that keeps the menu open. */
  checked?(): boolean;
  /** Short end text, such as "3". */
  count?(): string;
  select(): void | Promise<void>;
}
export interface ItemHandle {
  update(): void;
  remove(): void;
}

export interface PanelOptions {
  label: string;
  onClose?(): void;
}
export interface PanelHandle {
  close(): void;
}

export interface Status {
  /** Plain words: "Live with 2 others". */
  text: string;
  people?: readonly { key: string; name: string; view?: ViewState }[];
}

export interface UiSnapshot {
  /** Comments are showing. */
  shown: boolean;
  commentMode: boolean;
  /** All comments is open. */
  allOpen: boolean;
  dark: boolean;
  view: ViewState | undefined;
  /** null: not writing; "": the new-comment box; else that thread's reply line. */
  writing: string | null;
}

export type { ComposerHandle, ComposerTool, Dictation } from "./composer";

export interface AddonHost {
  readonly api: number;
  /** The core's version, for diagnostics only. */
  readonly version: string;
  readonly document: AddonDocument;
  /** The area people comment on. */
  readonly root: Element;
  /** This browser can't keep comments (they are held in memory). */
  readonly ephemeral: boolean;
  /** Aborted at teardown: pass it to fetch, timers and sockets. */
  readonly signal: AbortSignal;
  has(c: Capability): boolean;
  /** Says the add-on can't work here (no speech engine, nothing configured): it stays off, with this reason. */
  off(reason: string): void;
  /** Verifies and merges ops from elsewhere, as a feedback file's are; the source is this add-on's id. */
  merge(ops: readonly unknown[]): Promise<number>;
  addMenuItem(item: MenuItem): ItemHandle;
  notify(text: string): void;
  announce(text: string): void;
  setComposerNote(text: string | null): void;
  addComposerTool(tool: ComposerTool): Off;
  openPanel(content: Node, options: PanelOptions): PanelHandle;
  addStyles(css: string): Off;
  setStatus(status: Status | null): void;
  overlay(): HTMLElement;
  onFrame(fn: () => void): Off;
  /** What a comment on `at` would save. */
  where(at?: Node): ViewState | undefined;
  /** The rule threads follow: this view is where the reviewer is. */
  isHere(view?: ViewState): boolean;
  /** Goes to `view`; true once there. */
  go(view: ViewState): Promise<boolean>;
  /** Called at once, then on every change. */
  onUi(fn: (ui: UiSnapshot) => void): Off;
  avatar(key: string, name: string): HTMLElement;
  sign(name: string, data: string): Promise<string>;
}

const ID = /^[a-z][a-z0-9-]{1,23}$/;
const RESERVED = new Set(["local", "file", "page", "user", "pipeup", "presence", "sync"]);
const ANNOUNCE_MS = 10_000;

interface Item {
  id: string;
  item: MenuItem;
}

/**
 * Everything add-ons put on the page, held by the app (not by the views) so it survives layout rebuilds. Each
 * thing belongs to one add-on and is removed with it.
 */
export class Surface {
  /** Bumped when the set of menu rows changes. */
  rev = 0;
  readonly menuRows: Item[] = [];
  private readonly notes = new Map<string, string>();
  private readonly statuses = new Map<string, Status>();
  private readonly tools: { id: string; tool: ComposerTool }[] = [];
  private readonly frames = new Set<{ id: string; fn: () => void }>();
  private readonly uis = new Set<{ id: string; fn: (ui: UiSnapshot) => void }>();
  private readonly subs = new Set<(structure: boolean) => void>();
  private readonly sheets = new Map<string, Set<HTMLElement | CSSStyleSheet>>();
  private readonly overlays = new Map<string, HTMLElement>();
  private readonly pending = new Map<string, string>();
  private readonly panels = new Set<{ id: string; close(): void }>();
  private remote = { n: 0, who: new Set<string>() };
  private last = 0;
  private timer = 0;
  private uiKey = "";

  constructor(
    readonly ctx: Ctx,
    private readonly shadow: ShadowRoot,
    private readonly after: Node,
  ) {
    setComposerSource({
      tools: () => this.tools.map((t) => t.tool),
      note: () => [...this.notes.values()].at(-1) ?? null,
      subscribe: (fn) => {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
      },
    });
  }

  subscribe(fn: (structure: boolean) => void): Off {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private changed(structure: boolean): void {
    if (structure) this.rev++;
    for (const fn of [...this.subs]) fn(structure);
  }

  /** The add-ons' statuses, one line. */
  statusText(): string {
    return [...this.statuses.values()].map((s) => s.text).join(" · ");
  }

  rowFor(id: string, item: MenuItem): ItemHandle {
    const entry = { id, item };
    this.menuRows.push(entry);
    this.changed(true);
    return {
      update: () => this.changed(false),
      remove: () => {
        const at = this.menuRows.indexOf(entry);
        if (at < 0) return;
        this.menuRows.splice(at, 1);
        this.changed(true);
      },
    };
  }

  setNote(id: string, text: string | null): void {
    if (text) this.notes.set(id, text);
    else this.notes.delete(id);
    this.changed(false);
  }

  putStatus(id: string, status: Status | null): void {
    if (status) this.statuses.set(id, status);
    else this.statuses.delete(id);
    this.changed(false);
  }

  addTool(id: string, tool: ComposerTool): Off {
    const entry = { id, tool };
    this.tools.push(entry);
    this.changed(false);
    return () => {
      const at = this.tools.indexOf(entry);
      if (at >= 0) this.tools.splice(at, 1);
      this.changed(false);
    };
  }

  /** Comments are closed: only the control shows, so a notice waits for the reviewer to open Pipeup. */
  private closed(): boolean {
    return this.ctx.state.hidden && !this.ctx.state.menu;
  }

  notice(id: string, text: string): void {
    if (this.closed()) this.pending.set(id, text);
    else this.ctx.toast(text);
  }

  /** Shows the latest notice kept while comments were closed. Called when the menu or comments open. */
  flush(): void {
    if (this.closed() || this.pending.size === 0) return;
    const text = [...this.pending.values()].at(-1)!;
    this.pending.clear();
    this.ctx.toast(text);
  }

  /** A reviewer is writing: a Pipeup line has words or focus. */
  private isWriting(): boolean {
    const a = this.shadow.activeElement;
    if (a instanceof HTMLTextAreaElement) return true;
    return [...this.ctx.layer.querySelectorAll("textarea")].some((t) => t.value.trim() !== "");
  }

  /**
   * An add-on's own words (state changes such as "Listening") are heard at once, while comments are showing:
   * they answer something the reviewer just did, so they don't wait for them to stop writing.
   */
  addSay(text: string): void {
    if (!this.ctx.state.hidden) this.ctx.say(text);
  }

  /** Other people's new comments are announced as one coalesced sentence. */
  heard(added: readonly SignedOp[], source: string): void {
    if (source === "local" || source === "") return;
    for (const { body } of added) {
      if (body.author === this.ctx.doc.me || (body.kind !== "create" && body.kind !== "reply")) continue;
      this.remote.n++;
      this.remote.who.add(body.name || animalName(body.author));
    }
    this.pump();
  }

  private pump(): void {
    if (this.timer || this.remote.n === 0) return;
    const wait = Math.max(0, this.last + ANNOUNCE_MS - Date.now());
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      // Nothing is announced while comments are closed or while the reviewer writes: it waits.
      if (this.ctx.state.hidden || this.isWriting()) {
        this.timer = window.setTimeout(() => {
          this.timer = 0;
          this.pump();
        }, 1000);
        return;
      }
      const { n, who } = this.remote;
      this.remote = { n: 0, who: new Set() };
      this.last = Date.now();
      this.ctx.say(
        `${n} new comment${n === 1 ? "" : "s"} from ${who.size === 1 ? [...who][0] : `${who.size} people`}`,
      );
    }, wait);
  }

  ovFor(id: string): HTMLElement {
    let el = this.overlays.get(id);
    if (!el) {
      el = h("div", { class: "ov", "aria-hidden": "true", "data-addon": id });
      this.ctx.layer.insertBefore(el, this.after.nextSibling);
      this.overlays.set(id, el);
    }
    return el;
  }

  addSheet(id: string, css: string): Off {
    const Sheet = this.ctx.host.ownerDocument.defaultView?.CSSStyleSheet;
    let node: HTMLElement | CSSStyleSheet;
    if (Sheet && "replaceSync" in Sheet.prototype && "adoptedStyleSheets" in this.shadow) {
      const sheet = new Sheet();
      sheet.replaceSync(css);
      this.shadow.adoptedStyleSheets = [...this.shadow.adoptedStyleSheets, sheet];
      node = sheet;
    } else {
      node = h("style", {}, css);
      this.shadow.append(node);
    }
    const set = this.sheets.get(id) ?? new Set();
    set.add(node);
    this.sheets.set(id, set);
    return () => {
      if (!set.delete(node)) return;
      if (node instanceof HTMLElement) node.remove();
      else this.shadow.adoptedStyleSheets = this.shadow.adoptedStyleSheets.filter((s) => s !== node);
    };
  }

  onTick(id: string, fn: () => void): Off {
    const entry = { id, fn };
    this.frames.add(entry);
    return () => this.frames.delete(entry);
  }

  onSnap(id: string, fn: (ui: UiSnapshot) => void): Off {
    const entry = { id, fn };
    this.uis.add(entry);
    this.safe(() => fn(this.uiState()));
    return () => this.uis.delete(entry);
  }

  uiState(): UiSnapshot {
    const { state } = this.ctx;
    const a = this.shadow.activeElement;
    let writing: string | null = null;
    if (a instanceof HTMLTextAreaElement) {
      const row = a.closest<HTMLElement>("[data-thread]");
      writing = row ? row.dataset.thread! : "";
    }
    return {
      shown: !state.hidden,
      commentMode: state.commenting,
      allOpen: state.listing,
      dark: this.ctx.layer.classList.contains("dark"),
      view: this.ctx.here.view(),
      writing,
    };
  }

  /** Runs once per animation frame, after the views; a callback that throws is removed. */
  frame(): void {
    for (const entry of [...this.frames]) {
      try {
        entry.fn();
      } catch (e) {
        this.frames.delete(entry);
        globalThis.reportError?.(e);
      }
    }
    if (this.uis.size === 0) return;
    const ui = this.uiState();
    const key = JSON.stringify(ui);
    if (key === this.uiKey) return;
    this.uiKey = key;
    for (const entry of [...this.uis]) this.safe(() => entry.fn(ui), entry);
  }

  private safe(fn: () => void, entry?: { id: string }): void {
    try {
      fn();
    } catch (e) {
      if (entry) this.uis.delete(entry as never);
      globalThis.reportError?.(e);
    }
  }

  /** A side panel: the rest of Pipeup's UI is inert while it is open; Escape closes it before anything else. */
  panel(id: string, content: Node, o: PanelOptions): PanelHandle {
    const layer = this.ctx.layer;
    const was = this.shadow.activeElement as HTMLElement | null;
    const close = h(
      "button",
      { class: "ib", type: "button", "aria-label": "Close" },
      draw(["M6 6l12 12M18 6L6 18"], 15),
    );
    const panel = h(
      "div",
      { class: "xp", role: "dialog", "aria-label": o.label, "data-addon": id },
      h("div", { class: "hd" }, h("span", {}, o.label), close),
      h("div", { class: "xb" }, content),
    );
    const others = [...layer.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.inert);
    for (const c of others) c.inert = true;
    layer.append(panel);
    void panel.offsetWidth;
    panel.classList.add("show");
    let done = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      end();
    };
    const end = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey, true);
      this.panels.delete(entry);
      for (const c of others) c.inert = false;
      panel.classList.remove("show");
      panel.inert = true;
      window.setTimeout(() => panel.remove(), 300);
      was?.focus?.({ preventScroll: true });
      try {
        o.onClose?.();
      } catch (e) {
        globalThis.reportError?.(e);
      }
    };
    const entry = { id, close: end };
    this.panels.add(entry);
    close.addEventListener("click", end);
    window.addEventListener("keydown", onKey, true);
    (panel.querySelector<HTMLElement>("button, input, textarea, select, a[href]") ?? panel).focus?.({
      preventScroll: true,
    });
    return { close: end };
  }

  /** Removes everything one add-on added. */
  clear(id: string): void {
    for (const p of [...this.panels]) if (p.id === id) p.close();
    for (let i = this.menuRows.length; i--;) if (this.menuRows[i]!.id === id) this.menuRows.splice(i, 1);
    for (let i = this.tools.length; i--;) if (this.tools[i]!.id === id) this.tools.splice(i, 1);
    for (const e of [...this.frames]) if (e.id === id) this.frames.delete(e);
    for (const e of [...this.uis]) if (e.id === id) this.uis.delete(e);
    for (const node of this.sheets.get(id) ?? []) {
      if (node instanceof HTMLElement) node.remove();
      else this.shadow.adoptedStyleSheets = this.shadow.adoptedStyleSheets.filter((s) => s !== node);
    }
    this.sheets.delete(id);
    this.overlays.get(id)?.remove();
    this.overlays.delete(id);
    this.notes.delete(id);
    this.statuses.delete(id);
    this.pending.delete(id);
    this.changed(true);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    setComposerSource(null);
    this.subs.clear();
  }
}

// ---- The registry: kept outside any one mount, so add-ons registered before Pipeup mounts wait for it. ----

interface Entry {
  addon: PipeupAddon;
  info: AddonInfo;
  /** Set while this add-on is on in the current mount. */
  stop?: () => void;
}

interface Live {
  surface: Surface;
  doc: PipeupDocument;
  root: Element;
  ephemeral: boolean;
  version: string;
  active: boolean;
}

const entries = new Map<string, Entry>();
let live: Live | null = null;

/**
 * A Pipeup already on the page when this copy loaded (the classic build assigns its global only when it ends, so
 * this is read at load): the first copy owns the registry, the queue and the mount; this one hands over to it.
 */
export const firstCore: {
  VERSION: string;
  use(a: PipeupAddon): void;
  addons(): readonly AddonInfo[];
  mount(o?: unknown): Promise<unknown>;
} | null = (() => {
  const p = (globalThis as { Pipeup?: { VERSION?: string } }).Pipeup;
  return p?.VERSION ? (p as never) : null;
})();

export function addons(): readonly AddonInfo[] {
  return firstCore ? firstCore.addons() : [...entries.values()].map((e) => ({ ...e.info }));
}

/** Registers an add-on: it sets up now if Pipeup is mounted, else when it mounts. */
export function use(addon: PipeupAddon): void {
  if (firstCore) return firstCore.use(addon);
  const warn = (text: string) => console.warn(`pipeup: ${text}`);
  const a = addon as Partial<PipeupAddon> | null;
  if (!a || typeof a !== "object" || typeof a.id !== "string" || !ID.test(a.id) || RESERVED.has(a.id))
    return warn("an add-on needs an id of 2 to 24 lowercase letters, digits and dashes, not a reserved one");
  if (entries.has(a.id)) return warn(`the add-on "${a.id}" is already registered; the second is ignored`);
  if (typeof a.setup !== "function" || !a.network || typeof a.network.says !== "string")
    return warn(`the add-on "${a.id}" needs a setup function and a network statement`);
  const info: AddonInfo = {
    id: a.id,
    version: String(a.version ?? ""),
    network: a.network,
    state: "waiting",
  };
  const missing = (a.needs ?? []).find((c) => !CAPABILITIES.includes(c));
  if (a.api !== ADDON_API) {
    info.state = "off";
    info.reason = `needs add-on API ${String(a.api)}; this Pipeup has ${ADDON_API}`;
  } else if (missing) {
    info.state = "off";
    info.reason = `this Pipeup has no ${missing} slot`;
  }
  const entry: Entry = { addon: addon as PipeupAddon, info };
  entries.set(a.id, entry);
  if (live?.active && info.state === "waiting") void startOne(entry, live);
}

/**
 * Takes the add-ons scripts queued before Pipeup loaded, and makes later pushes register at once. Idempotent;
 * returns false when another core owns the queue.
 */
export function drainQueue(): boolean {
  if (firstCore) return true;
  const g = globalThis as { pipeupAddons?: unknown };
  const q = g.pipeupAddons;
  if (Array.isArray(q)) for (const a of q) use(a as PipeupAddon);
  else if (q && typeof q === "object" && (q as { push?: unknown }).push !== use) return false;
  g.pipeupAddons = { push: use };
  return true;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function startOne(entry: Entry, l: Live): Promise<void> {
  const { addon, info } = entry;
  const ac = new AbortController();
  const offs = new Set<Off>();
  const { surface, doc } = l;
  const alive = () => !ac.signal.aborted;
  /** After teardown, a host method does nothing. */
  const g =
    <A extends unknown[], R>(fn: (...args: A) => R, none: R) =>
    (...args: A): R =>
      alive() ? fn(...args) : none;
  const view: AddonDocument = {
    id: doc.id,
    me: doc.me,
    threads: () => doc.threads(),
    ops: () => doc.ops(),
    onChange: (fn) => {
      const off = doc.onChange(fn);
      offs.add(off);
      return () => {
        off();
        offs.delete(off);
      };
    },
  };
  const id = addon.id;
  const host: AddonHost = {
    api: ADDON_API,
    version: l.version,
    document: view,
    root: l.root,
    ephemeral: l.ephemeral,
    signal: ac.signal,
    has: (c) => CAPABILITIES.includes(c),
    off: (reason) => {
      offReason = String(reason);
    },
    merge: (ops) => (alive() ? doc.merge(ops, id) : Promise.resolve(0)),
    addMenuItem: (item) => {
      if (!alive()) return { update() {}, remove() {} };
      return surface.rowFor(id, item);
    },
    notify: g((text: string) => surface.notice(id, text), undefined),
    announce: g((text: string) => surface.addSay(text), undefined),
    setComposerNote: g((text: string | null) => surface.setNote(id, text), undefined),
    addComposerTool: g(
      (tool: ComposerTool) => surface.addTool(id, tool),
      () => {},
    ),
    openPanel: (content, o) => (alive() ? surface.panel(id, content, o) : { close() {} }),
    addStyles: g(
      (css: string) => surface.addSheet(id, css),
      () => {},
    ),
    setStatus: g((s: Status | null) => surface.putStatus(id, s), undefined),
    overlay: () => surface.ovFor(id),
    onFrame: g(
      (fn: () => void) => surface.onTick(id, fn),
      () => {},
    ),
    where: (at) => surface.ctx.here.view(at),
    isHere: (v) => surface.ctx.here.holds(v),
    go: (v) => surface.ctx.here.navigate(v),
    onUi: g(
      (fn: (ui: UiSnapshot) => void) => surface.onSnap(id, fn),
      () => {},
    ),
    avatar: (key, name) => {
      const el = avatar(key, name);
      el.classList.add("in");
      return el;
    },
    sign: (name, data) => doc.sign(`${id}/${name}`, data),
  };
  let teardown: void | Teardown;
  let offReason: string | undefined;
  const stop = () => {
    if (!alive()) return;
    ac.abort();
    for (const off of [...offs]) off();
    try {
      teardown?.();
    } catch (e) {
      globalThis.reportError?.(e);
    }
    surface.clear(id);
    if (info.state === "on") info.state = "waiting";
  };
  entry.stop = stop;
  try {
    teardown = await addon.setup(host);
    if (!alive()) {
      // Unmounted while setting up: release what it opened.
      teardown?.();
      return;
    }
    if (offReason !== undefined) {
      stop();
      info.state = "off";
      info.reason = offReason;
      return;
    }
    info.state = "on";
    delete info.reason;
  } catch (e) {
    info.state = "failed";
    info.reason = describe(e);
    stop();
    info.state = "failed";
    globalThis.reportError?.(e);
  }
}

/** Sets up every waiting add-on for this mount, in registration order. Returns the function that tears them down. */
export function attachAddons(o: Omit<Live, "active">): () => void {
  const l: Live = { ...o, active: true };
  live = l;
  for (const e of entries.values()) if (e.info.state === "waiting") void startOne(e, l);
  return () => {
    l.active = false;
    if (live === l) live = null;
    for (const e of [...entries.values()].reverse()) {
      e.stop?.();
      delete e.stop;
    }
    o.surface.destroy();
  };
}
