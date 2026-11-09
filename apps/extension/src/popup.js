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
        return { on: !!s?.on, builtIn, count: s?.on ? s.count() : 0 };
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
  $("always-row").hidden = !state || state.builtIn;
  if (state?.on)
    $("count").textContent =
      state.count === 0
        ? "No open comments on this page."
        : `${state.count} open comment${state.count === 1 ? "" : "s"} on this page.`;
  $("always").checked = await always();
}

async function start() {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["start.js"],
  });
}

$("start").addEventListener("click", async () => {
  await start();
  // A real toolbar panel closes, so the reviewer is straight on the page; opened in a tab, it stays and updates.
  if (!named) window.close();
  else await show();
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
