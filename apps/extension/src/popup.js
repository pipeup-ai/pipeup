// The toolbar panel. It reads the tab's state each time it opens: on, off, built in, or a page extensions can't reach.
const $ = (id) => document.getElementById(id);
// The tab it acts on: the active tab, or one named in the address (how the tests open it in a tab of its own).
const named = Number(new URLSearchParams(location.search).get("tab"));
const [active] = named ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
const tab = named ? await chrome.tabs.get(named) : active;
const url = new URL(tab?.url || "about:blank");
const web = url.protocol === "http:" || url.protocol === "https:";
const origin = url.origin;
const scriptId = `always ${origin}`;

$("where").textContent = web ? url.host + url.pathname.replace(/\/$/, "") : url.protocol.replace(":", "");
$("always-label").textContent = `Always on for ${url.host}`;

/** Asks the tab, in the extension's own world, whether Pipeup is on, built in, or not reachable at all. */
async function probe() {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const s = globalThis.__pipeupExt;
        const builtIn =
          !s?.on &&
          !!(document.querySelector("pipeup-root") || document.querySelector('script[src*="pipeup"]'));
        return { on: !!s?.on, builtIn, count: s?.on ? s.count() : 0, commenting: !!s?.pu?.commentMode };
      },
    });
    return result;
  } catch {
    return null;
  }
}

async function always() {
  if (!web) return false;
  const found = await chrome.scripting.getRegisteredContentScripts({
    ids: [scriptId],
  });
  return found.length > 0;
}

async function show() {
  const state = web ? await probe() : null;
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
  }
  $("always").checked = await always();
}

/** Asks the tab's Pipeup, in the extension's world, once it has started there: comment mode, All comments, the menu. */
async function ask(action, on = true) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (what, value) => {
      const s = globalThis.__pipeupExt;
      for (let i = 0; i < 100 && !s?.pu; i++) await new Promise((r) => setTimeout(r, 50));
      const pu = s?.pu;
      if (!pu) return;
      if (what === "mode") await pu.setCommentMode(value);
      else if (what === "all") await pu.openAllComments();
      else if (what === "menu") await pu.openMenu();
    },
    args: [action, on],
  });
}

/** The panel's job is done: it closes so the reviewer is straight on the page (opened in a tab, it stays and updates). */
async function done() {
  if (!named) window.close();
  else await show();
}

async function start() {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["start.js"] });
}

// Comment on this page adds Pipeup and starts comment mode: that's why the reviewer pressed it.
$("start").addEventListener("click", async () => {
  await start();
  await ask("mode", true);
  await done();
});

$("commenting").addEventListener("change", async (e) => {
  await ask("mode", e.target.checked);
  await done();
});

$("all").addEventListener("click", async () => {
  await ask("all");
  await done();
});

$("menu").addEventListener("click", async () => {
  await ask("menu");
  await done();
});

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
