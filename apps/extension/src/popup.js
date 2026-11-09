// The toolbar panel: Pipeup's menu. It reads the tab's state each time it opens: on, off, built in, or a page
// extensions can't reach. With Pipeup on, every row of Pipeup's own menu is here, drawn by the extension.
const $ = (id) => document.getElementById(id);
// The tab it acts on: the active tab, or one named in the address (how the tests open it in a tab of its own).
const named = Number(new URLSearchParams(location.search).get("tab"));
const [active] = named ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
const tab = named ? await chrome.tabs.get(named) : active;
const url = new URL(tab?.url || "about:blank");
const web = url.protocol === "http:" || url.protocol === "https:";
const origin = url.origin;
const scriptId = `always ${origin}`;
const LOOKS = ["auto", "light", "dark"];
const LOOK_WORDS = { auto: "Automatic", light: "Light", dark: "Dark" };

$("where").textContent = web ? url.host + url.pathname.replace(/\/$/, "") : url.protocol.replace(":", "");
$("always-label").textContent = `Always on for ${url.host}`;

/** Asks the tab's Pipeup, in the extension's world, what it is showing. */
async function probe() {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const s = globalThis.__pipeupExt;
        const builtIn =
          !s?.on &&
          !!(document.querySelector("pipeup-root") || document.querySelector('script[src*="pipeup"]'));
        const pu = s?.on ? s.pu : null;
        return {
          on: !!pu,
          builtIn,
          hosted: !!s?.hosted,
          mode: s?.mode ?? "",
          count: pu ? s.count() : 0,
          commenting: !!pu?.commentMode,
          name: pu?.name ?? "",
          look: pu?.look ?? "auto",
          hidden: !!pu?.hidden,
        };
      },
    });
    return result;
  } catch {
    return null;
  }
}

/** Asks the tab's Pipeup to do one thing, once it has started there. */
async function ask(what, value) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (action, v) => {
      const s = globalThis.__pipeupExt;
      for (let i = 0; i < 100 && !s?.pu; i++) await new Promise((r) => setTimeout(r, 50));
      const pu = s?.pu;
      if (!pu) return null;
      if (action === "mode") await pu.setCommentMode(v);
      else if (action === "name") await pu.setName(v);
      else if (action === "look") await pu.setLook(v);
      else if (action === "hide") await pu.setHidden(v);
      else if (action === "all") await pu.openAllComments();
      else if (action === "copy") return pu.commentsAs(v);
      return null;
    },
    args: [what, value ?? null],
  });
  return result;
}

async function always() {
  if (!web) return false;
  const found = await chrome.scripting.getRegisteredContentScripts({ ids: [scriptId] });
  return found.length > 0;
}

/** Kept for every site: comments pinned beside the page in the side panel, or popovers on it. */
const settings = async () => (await chrome.storage.local.get("settings")).settings ?? {};

let state = null;
async function show() {
  state = web ? await probe() : null;
  $("blocked").hidden = !!state;
  $("built-in").hidden = !state?.builtIn;
  $("off").hidden = !state || state.on || state.builtIn;
  $("on").hidden = !state?.on;
  $("stop").hidden = !state?.on;
  $("always-row").hidden = !state || state.builtIn;
  if (state?.on) {
    $("count").textContent = String(state.count);
    $("count").hidden = state.count === 0;
    $("commenting").checked = state.commenting;
    $("hide").checked = state.hidden;
    $("theme-now").textContent = LOOK_WORDS[state.look] ?? "Automatic";
    $("who-name").textContent = state.name || "Add your name";
    $("who-hint").textContent = state.name ? "Edit name" : "Add name";
    $("pinned").checked = !!(await settings()).pinned;
  }
  $("always").checked = await always();
}

/** The panel's job is done: it closes so the reviewer is straight on the page (opened in a tab, it stays and updates). */
async function done() {
  if (!named) window.close();
  else await show();
}

/** Opens the browser's side panel for this tab, where the comments are. Only allowed in answer to a press here. */
function openComments() {
  return chrome.sidePanel?.open({ tabId: tab.id }).catch(() => {});
}

async function start() {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["start.js"] });
}

// Comment on this page adds Pipeup and starts comment mode: that's why the reviewer pressed it. Pinned, the comments
// open beside the page too.
$("start").addEventListener("click", async () => {
  const side = (await settings()).pinned ? openComments() : null;
  await start();
  await ask("mode", true);
  await side;
  await done();
});

$("commenting").addEventListener("change", async (e) => {
  const side = e.target.checked && state?.hosted ? openComments() : null;
  await ask("mode", e.target.checked);
  await side;
  await done();
});

// Comments: every comment, in the side panel, pinned or not.
$("all").addEventListener("click", async () => {
  if (state?.mode === "button") await ask("all");
  else await openComments();
  await done();
});

$("pinned").addEventListener("change", async (e) => {
  const pinned = e.target.checked;
  // Opened in answer to this press, as the browser requires; the tab's Pipeup changes to match.
  const side = pinned ? openComments() : null;
  await chrome.storage.local.set({ settings: { ...(await settings()), pinned } });
  await side;
  await done();
});

$("hide").addEventListener("change", async (e) => {
  await ask("hide", e.target.checked);
});

$("theme").addEventListener("click", async () => {
  const next = LOOKS[(LOOKS.indexOf(state?.look ?? "auto") + 1) % LOOKS.length];
  await ask("look", next);
  await show();
});

// Who you are: the row becomes a name field in place; Enter or leaving it saves, Esc keeps the name there is.
$("who").addEventListener("click", () => {
  $("who").hidden = true;
  $("name-form").hidden = false;
  $("name").value = state?.name ?? "";
  $("name").focus();
});
const endName = async (save) => {
  if ($("name-form").hidden) return;
  const name = $("name").value.replace(/\s+/g, " ").trim();
  $("name-form").hidden = true;
  $("who").hidden = false;
  if (save && name && name !== state?.name) await ask("name", name);
  await show();
};
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void endName(true);
});
$("name").addEventListener("blur", () => void endName(true));
$("name").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    void endName(false);
  }
});

// Copy comments: one row that opens to its two choices.
$("copy").addEventListener("click", () => {
  const open = $("copy-as").hidden;
  $("copy-as").hidden = !open;
  $("copy").setAttribute("aria-expanded", String(open));
});
const copy = async (as) => {
  const text = await ask("copy", as);
  if (typeof text !== "string") return;
  try {
    await navigator.clipboard.writeText(text);
    const n = state?.count ?? 0;
    $("copied").textContent = `Copied ${n} thread${n === 1 ? "" : "s"}`;
  } catch {
    $("copied").textContent = "Couldn't copy";
  }
  $("copy-as").hidden = true;
  $("copy").setAttribute("aria-expanded", "false");
};
$("copy-md").addEventListener("click", () => void copy("ai"));
$("copy-text").addEventListener("click", () => void copy("text"));

$("stop").addEventListener("click", async () => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => globalThis.__pipeupExt?.off?.(),
  });
  await show();
});

$("always").addEventListener("change", async (e) => {
  const on = e.target.checked;
  const origins = [`${origin}/*`];
  if (on) {
    // The browser asks the reviewer, for this site only.
    const granted = await chrome.permissions.request({ origins });
    if (!granted) {
      e.target.checked = false;
      return;
    }
    await chrome.scripting.registerContentScripts([
      {
        id: scriptId,
        matches: origins,
        js: ["start.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
    await start();
  } else {
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
    await chrome.permissions.remove({ origins }).catch(() => {});
  }
  await show();
});

await show();
