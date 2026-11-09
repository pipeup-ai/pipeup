// Adds Pipeup to this tab, in the extension's own world: the page's scripts can't see it or change it. Comments, the
// reviewer's identity and their choices are kept by the extension, so nothing goes into the site's own storage.
// Run by the toolbar's "Comment on this page", and on every load of a site that is "Always on".
(async () => {
  const state = (globalThis.__pipeupExt ??= { on: false, builtIn: false });
  if (state.on || state.starting) return;
  // A page with Pipeup built in keeps its own: two copies would mean two controls and two sets of comments.
  if (document.querySelector("pipeup-root") || document.querySelector('script[src*="pipeup"]')) {
    state.builtIn = true;
    return;
  }
  state.starting = true;
  const storage = chrome.storage.local;
  const Pipeup = await import(chrome.runtime.getURL("pipeup/pipeup.esm.js"));

  // Ed25519 private keys from a 32-byte seed, as the identity add-on makes them: the seed is what is kept.
  const PKCS8 = Uint8Array.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ]);
  const b64u = (bytes) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const unb64u = (s) =>
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function identityOf(seed) {
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array([...PKCS8, ...seed]),
      { name: "Ed25519" },
      true,
      ["sign"],
    );
    const { x } = await crypto.subtle.exportKey("jwk", privateKey);
    return { publicKey: x, privateKey };
  }
  async function seedOf(privateKey) {
    if (!privateKey.extractable) return null;
    return new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey)).slice(-32);
  }

  /** Pipeup's comments and the reviewer's profile, in the extension's storage: one identity on every site. */
  const docKey = (doc) => `doc:${doc}`;
  let writing = Promise.resolve();
  /** One write at a time in this tab, each merging into what is stored now, so another tab's ops aren't lost. */
  const queued = (fn) => (writing = writing.then(fn, fn));
  const store = {
    async load(doc) {
      const got = await storage.get(docKey(doc));
      return got[docKey(doc)] ?? [];
    },
    append(doc, ops) {
      return queued(async () => {
        const key = docKey(doc);
        const kept = (await storage.get(key))[key] ?? [];
        const ids = new Set(kept.map((o) => o.body.id));
        const all = [...kept, ...ops.filter((o) => !ids.has(o.body.id))];
        const page = {
          url: location.origin + location.pathname,
          title: document.title,
          at: Date.now(),
        };
        await storage.set({ [key]: all, [`page:${doc}`]: page });
      });
    },
    async loadProfile() {
      const { profile } = await storage.get("profile");
      return profile
        ? {
            identity: await identityOf(unb64u(profile.seed)),
            name: profile.name ?? "",
          }
        : null;
    },
    async saveProfile(p) {
      const seed = await seedOf(p.identity.privateKey);
      const { profile } = await storage.get("profile");
      await storage.set({
        profile: { seed: seed ? b64u(seed) : profile?.seed, name: p.name },
      });
    },
    // Pipeup's own new identity can't be kept outside IndexedDB, so the extension makes one from a seed instead.
    saveProfileIfAbsent(candidate) {
      return queued(async () => {
        const kept = await store.loadProfile();
        if (kept) return kept;
        const seed = crypto.getRandomValues(new Uint8Array(32));
        await storage.set({
          profile: { seed: b64u(seed), name: candidate.name },
        });
        return { identity: await identityOf(seed), name: candidate.name };
      });
    },
  };

  // The reviewer's choices for this site (look, Hide comments), read before Pipeup starts and written as they change.
  const prefsKey = `prefs:${location.origin}`;
  const choices = (await storage.get(prefsKey))[prefsKey] ?? {};
  const keep = () => void storage.set({ [prefsKey]: choices });
  const prefs = {
    getItem: (k) => (k in choices ? choices[k] : null),
    setItem: (k, v) => {
      choices[k] = String(v);
      keep();
    },
    removeItem: (k) => {
      delete choices[k];
      keep();
    },
  };

  // How Pipeup shows on the page. Pinned: threads in the browser's side panel (Pipeup opens none on the page). Not
  // pinned: threads open as popovers beside what they're about. Either way new comments are written on the page, with
  // the cursor in the box, and Pipeup's corner button stays off the page unless the reviewer wants it back.
  const modeOf = (settings) => (settings?.showButton ? "button" : settings?.pinned ? "pinned" : "popovers");
  const OPTIONS = {
    button: {},
    pinned: { ui: "host", control: "off" },
    popovers: { control: "off", layout: "bubbles" },
  };
  /** The extension was reloaded or updated: this copy can't reach it any more (its own `chrome.runtime` is gone). */
  const orphaned = () => !chrome.runtime?.id;
  const send = (message) => {
    if (orphaned()) return retire();
    try {
      void chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      retire();
    }
  };
  // An orphaned copy takes itself off the page, so the updated extension starts clean when it is pressed again.
  let retired = false;
  function retire() {
    if (retired) return;
    retired = true;
    window.clearInterval(watch);
    for (const stop of stops) stop();
    stops = [];
    try {
      pu?.unmount();
    } catch {
      // Already gone.
    }
    pu = null;
    state.on = false;
  }
  const watch = window.setInterval(() => orphaned() && retire(), 2000);

  let pu = null;
  let stops = [];
  async function mountAs(mode) {
    pu = await Pipeup.mount({ store, prefs, ...OPTIONS[mode] });
    state.mode = mode;
    state.hosted = mode === "pinned";
    stops = [
      pu.document.onChange(tell),
      pu.on("change", tell),
      pu.on("open", (id) => send({ type: "open", id })),
    ];
    tell();
  }
  function unmountNow() {
    for (const stop of stops) stop();
    stops = [];
    pu?.unmount();
    pu = null;
  }

  /** What the side panel draws: every thread, who you are, and where each one is on the page. */
  const snapshot = () => {
    const where = new Map(pu.comments({ all: true }).threads.map((t) => [t.id, t]));
    return {
      me: pu.document.me,
      name: pu.name,
      title: document.title,
      threads: pu.document
        .threads()
        .filter((t) => !t.root.deleted)
        .map((t) => ({ ...t, where: where.get(t.id)?.where ?? "", state: where.get(t.id)?.state ?? "" })),
    };
  };
  /** The toolbar button (open comments, comment mode) and the side panel (the threads), whenever anything changes. */
  function tell() {
    try {
      send({ type: "state", n: pu.comments().threads.length, commenting: pu.commentMode });
      send({ type: "threads", ...snapshot() });
    } catch {
      // Pipeup was taken off the page meanwhile.
    }
  }

  // What the side panel asks for, or asks to be done.
  const asks = {
    snapshot: () => snapshot(),
    reply: (m) => pu.document.reply(m.id, m.text),
    edit: (m) => pu.document.edit(m.id, m.text),
    remove: (m) => pu.document.remove(m.id),
    resolve: (m) => pu.document.resolve(m.id),
    reopen: (m) => pu.document.reopen(m.id),
    react: (m) => (m.on ? pu.document.react(m.id, m.emoji) : pu.document.unreact(m.id, m.emoji)),
    go: (m) => pu.openThread(m.id),
  };
  const onAsk = (message, _sender, reply) => {
    const ask = message?.to === "page" && Object.hasOwn(asks, message.type) ? asks[message.type] : null;
    if (!ask || !state.on || !pu) return false;
    Promise.resolve()
      .then(() => ask(message))
      .then(
        (result) => reply({ ok: true, result: result ?? null }),
        (e) => reply({ ok: false, error: String(e?.message ?? e) }),
      );
    return true;
  };

  // Pinning, unpinning or bringing the button back changes how Pipeup shows: it starts again the new way, in the same
  // comment mode, with nothing lost (comments are saved as they are written).
  const onSettings = async (changes, area) => {
    if (area !== "local" || !changes.settings || !state.on) return;
    const mode = modeOf(changes.settings.newValue);
    if (mode === state.mode) return;
    const commenting = pu?.commentMode;
    await pu?.flush().catch(() => {});
    unmountNow();
    await mountAs(mode);
    if (commenting) await pu.setCommentMode(true);
  };

  try {
    await mountAs(modeOf((await storage.get("settings")).settings));
  } catch (e) {
    state.starting = false;
    throw e;
  }
  chrome.runtime.onMessage.addListener(onAsk);
  chrome.storage.onChanged.addListener(onSettings);

  // `pu` is read live: it changes when Pipeup starts again the new way.
  Object.defineProperty(state, "pu", { get: () => pu, configurable: true });
  Object.assign(state, {
    on: true,
    starting: false,
    count: () => pu?.comments().threads.length ?? 0,
    off() {
      window.clearInterval(watch);
      retired = true;
      chrome.runtime.onMessage.removeListener(onAsk);
      chrome.storage.onChanged.removeListener(onSettings);
      unmountNow();
      state.on = false;
      send({ type: "state", n: 0, commenting: false });
      send({ type: "threads", me: "", name: "", title: document.title, threads: [], off: true });
    },
  });
})();
