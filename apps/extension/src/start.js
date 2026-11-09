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

  let pu;
  try {
    pu = await Pipeup.mount({ store, prefs });
  } catch (e) {
    state.starting = false;
    throw e;
  }
  /** The toolbar button's number: the page's open comments. */
  const count = () => {
    try {
      const n = pu.comments().threads.length;
      void chrome.runtime.sendMessage({ type: "count", n }).catch(() => {});
    } catch {
      // Pipeup was taken off the page meanwhile.
    }
  };
  const stop = pu.document.onChange(count);
  count();
  Object.assign(state, {
    on: true,
    starting: false,
    count: () => pu.comments().threads.length,
    off() {
      stop();
      pu.unmount();
      state.on = false;
      void chrome.runtime.sendMessage({ type: "count", n: 0 }).catch(() => {});
    },
  });
})();
