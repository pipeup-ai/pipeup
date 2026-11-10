// The toolbar panel: Pipeup's menu. It reads the tab's state each time it opens: on, off, built in, or a page
// extensions can't reach. With Pipeup on, every row of Pipeup's own menu is here, drawn by the extension.
import { agentSetup, agreeToSend, canPin, canReachAgents, openSide } from "./browser.js";

const $ = (id) => document.getElementById(id);
// The tab it acts on: the active tab, or one named in the address (how the tests open it in a tab of its own).
const named = Number(new URLSearchParams(location.search).get("tab"));
const [active] = named ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
const tab = named ? await chrome.tabs.get(named) : active;
const url = new URL(tab?.url || "about:blank");
const web = url.protocol === "http:" || url.protocol === "https:";
// Pages served from this computer, where agents mostly build: one switch covers every port.
const LOCAL = ["http://localhost/*", "http://127.0.0.1/*", "http://[::1]/*"];
const local = web && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
const origin = url.origin;
const scriptId = `always ${origin}`;
const LOOKS = ["auto", "light", "dark"];
const LOOK_WORDS = { auto: "Automatic", light: "Light", dark: "Dark" };

$("where").textContent = web ? url.host + url.pathname.replace(/\/$/, "") : url.protocol.replace(":", "");
$("always-label").textContent = `Always on for ${url.host}`;

/** Says something to the tab's Pipeup and returns its answer, or null when it isn't there (yet). */
async function tell(type, fields = {}) {
  // The page's own frame: Pipeup may also be in a frame the right-click menu reached.
  const answer = await chrome.tabs
    .sendMessage(tab.id, { to: "page", type, ...fields }, { frameId: 0 })
    .catch(() => null);
  return answer?.ok ? answer.result : null;
}

/**
 * What the tab is showing. The extension's Pipeup answers for itself, by message; otherwise the page is looked at for
 * a Pipeup of its own (its root, or Pipeup's file in a script), or the browser keeps it closed to extensions (null).
 */
async function probe() {
  const mine = await tell("probe");
  if (mine) return { ...mine, builtIn: false };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        !!document.querySelector("pipeup-root") ||
        [...document.scripts].some((script) => {
          const path = script.src ? new URL(script.src, location.href).pathname : "";
          return /\/pipeup(\.[\w-]+)*\.m?js$|\/pipeup@[^/]+\/|\/pipeup\/dist\//i.test(path);
        }),
    });
    return { on: false, builtIn: !!result, count: 0 };
  } catch {
    return null;
  }
}

/** Asks the tab's Pipeup to do one thing, once it has started there (it takes a moment after Comment on this page). */
async function ask(action, value) {
  for (let i = 0; i < 100; i++) {
    const answer = await chrome.tabs
      .sendMessage(tab.id, { to: "page", type: "act", action, value: value ?? null }, { frameId: 0 })
      .catch(() => null);
    if (answer?.ok) return answer.result;
    if (answer && !answer.ok) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
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
  $("always-row").hidden = !state || state.builtIn || local;
  $("local-row").hidden = !state || state.builtIn || !local;
  $("local").checked =
    (await chrome.scripting.getRegisteredContentScripts({ ids: ["always local"] })).length > 0;
  if (state?.on) {
    $("count").textContent = String(state.count);
    $("count").hidden = state.count === 0;
    $("commenting").checked = state.commenting;
    $("hide").checked = state.hidden;
    $("theme-now").textContent = LOOK_WORDS[state.look] ?? "Automatic";
    $("who-name").textContent = state.name || "Add your name";
    $("who-hint").textContent = state.name ? "Edit name" : "Add name";
    $("pinned").checked = canPin && !!(await settings()).pinned;
    // Safari has no panel beside the page, nor a way to reach agents on this computer: those rows aren't offered.
    $("pin-row").hidden = !canPin;
    $("agent-group").hidden = !canReachAgents;
    $("extras").hidden = !state.extras;
  }
  $("always").checked = await always();
}

/** The panel's job is done: it closes so the reviewer is straight on the page (opened in a tab, it stays and updates). */
async function done() {
  if (!named) window.close();
  else await show();
  // Replies an agent left since this page was last open come into their threads (once Send to my agent has been used).
  if (state?.on && canReachAgents && (await chrome.storage.local.get("agentUsed")).agentUsed)
    void agentReplies();
}

/** Opens the browser's side panel for this tab, where the comments are. Only allowed in answer to a press here. */
function openComments() {
  return openSide(tab.id);
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

// Comments: every comment. Pinned, in the side panel; otherwise in Pipeup's own panel on the page.
$("all").addEventListener("click", async () => {
  if (state?.mode === "pinned") await openComments();
  else await ask("all");
  await done();
});

// Add-ons' own rows (Share, Live and the rest) are in Pipeup's menu on the page.
$("extras").addEventListener("click", async () => {
  await ask("menu");
  await done();
});

// Save comments: one row that opens to its two choices; the file is saved where the browser saves downloads.
$("save").addEventListener("click", () => {
  const open = $("save-as").hidden;
  $("save-as").hidden = !open;
  $("save").setAttribute("aria-expanded", String(open));
});
const fileName = (ext) =>
  `${
    (tab.title || url.host)
      .replace(/[^\p{L}\p{N} _-]+/gu, " ")
      .trim()
      .slice(0, 60) || "comments"
  }.${ext}`;
async function save(text, ext, type) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([text], { type })),
    download: fileName(ext),
  });
  document.body.append(a);
  a.click();
  a.remove();
  $("saved").textContent = "Saved";
  $("save-as").hidden = true;
}
$("save-md").addEventListener("click", async () => {
  const text = await ask("copy", "ai");
  if (typeof text === "string") await save(text, "md", "text/markdown");
});
$("save-file").addEventListener("click", async () => {
  const text = await tell("file");
  if (typeof text === "string") await save(text, "pipeup.json", "application/json");
});

// Send to my agent: the page's comments go to agents on this computer (`pipeup browser read`), and their replies
// (`pipeup browser reply`) come back into the threads.
const HOST = "ai.pipeup.browser";
async function agentReplies() {
  const sent = await tell("agentSend");
  if (!sent) return 0;
  const back = await chrome.runtime
    .sendNativeMessage(HOST, { type: "replies", doc: sent.doc })
    .catch(() => null);
  return back?.ok && back.replies.length ? ((await tell("agentReplies", { replies: back.replies })) ?? 0) : 0;
}
$("agent").addEventListener("click", async () => {
  // Firefox asks first; the question is put in answer to this press, before anything is awaited.
  if (!(await agreeToSend())) {
    $("agent-said").textContent = "not sent: Firefox wasn't allowed to";
    return;
  }
  const sent = await tell("agentSend");
  if (!sent) return;
  const answer = await chrome.runtime.sendNativeMessage(HOST, { type: "send", ...sent }).catch(() => null);
  if (!answer?.ok) {
    $("agent-cmd").textContent = agentSetup();
    $("agent-help").hidden = false;
    $("agent-said").textContent = "not set up yet";
    return;
  }
  $("agent-said").textContent = "Sent";
  await chrome.storage.local.set({ agentUsed: true });
  await agentReplies();
});
$("agent-copy").addEventListener(
  "click",
  () => void navigator.clipboard.writeText($("agent-cmd").textContent),
);

$("local").addEventListener("change", async (e) => {
  if (e.target.checked) {
    // The browser asks the reviewer, for pages on this computer only.
    const granted = await chrome.permissions.request({ origins: LOCAL });
    if (!granted) return void (e.target.checked = false);
    await chrome.scripting.registerContentScripts([
      {
        id: "always local",
        matches: LOCAL,
        js: ["start.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
    await start();
  } else {
    await chrome.scripting.unregisterContentScripts({ ids: ["always local"] }).catch(() => {});
    await chrome.permissions.remove({ origins: LOCAL }).catch(() => {});
  }
  await show();
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
  await tell("off");
  // Pipeup takes itself off a moment after answering.
  for (let i = 0; i < 40 && (await tell("probe")); i++) await new Promise((r) => setTimeout(r, 50));
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
