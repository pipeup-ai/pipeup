// The toolbar panel: Pipeup's menu, the one menu in the extension. It reads the tab's state each time it opens: on,
// off, built in, or a page extensions can't reach. Off, one action and one sentence. On, six rows for the reviewer's
// job (comment, then get the comments to whoever asked) and More for everything set once or rarely. Design note:
// docs/design/one-menu.md.
import { agentSetup, agreeToSend, browserName, canPin, canReachAgents, openSide } from "./browser.js";

const $ = (id) => document.getElementById(id);
// The tab it acts on: the active tab, or one named in the address (how the tests open it in a tab of its own).
const named = Number(new URLSearchParams(location.search).get("tab"));
const [active] = named ? [] : await chrome.tabs.query({ active: true, currentWindow: true });
const tab = named ? await chrome.tabs.get(named) : active;
// Safari gives no address for a page the extension can't reach (a file opened from this computer among them).
const known = !!tab?.url;
const url = new URL(tab?.url || "about:blank");
const web = url.protocol === "http:" || url.protocol === "https:";
const file = url.protocol === "file:";
// Pages served from this computer, where agents mostly build: one switch covers every port.
const LOCAL = ["http://localhost/*", "http://127.0.0.1/*", "http://[::1]/*"];
const local = web && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
const origin = url.origin;
const scriptId = `always ${origin}`;
const LOOKS = ["auto", "light", "dark"];
const LOOK_WORDS = { auto: "Automatic", light: "Light", dark: "Dark" };

$("where").textContent = web
  ? url.host + url.pathname.replace(/\/$/, "")
  : file
    ? decodeURIComponent(url.pathname.split("/").pop() || "A file on this computer")
    : known
      ? url.protocol.replace(":", "")
      : "This page";
$("always-label").textContent = `Always on for ${url.host}`;
// Why Pipeup can't run here, when it can't: the browser's own pages, or a file opened from this computer, which
// browsers keep closed to extensions too (Chrome has a switch for it; Safari and Firefox don't).
const OPEN_FILE = "To comment on it, open it through a local server, or with pipeup browser.";
const FILE_SWITCH =
  browserName === "firefox" || browserName === "safari"
    ? ""
    : " Or, on the browser's extensions page, turn on Allow access to file URLs for Pipeup, then press Pipeup again.";
$("blocked").textContent = file
  ? `This is a file on this computer, and browsers keep files closed to extensions. ${OPEN_FILE}${FILE_SWITCH}`
  : known
    ? "Pipeup can't run here. Browsers keep their own pages, like settings, the new tab page and their stores, closed to extensions."
    : `Pipeup can't run here. Browsers keep their own pages, like settings, the new tab page and their stores, closed to extensions, and so are files opened from this computer. ${OPEN_FILE}`;

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

// Save as a file and More open in place, under their row, and fold back with ‹, Esc or ←.
const SUBS = { save: "save-as", more: "more-rows" };
function fold(id, open) {
  const sub = $(SUBS[id]);
  sub.classList.toggle("open", open);
  sub.inert = !open;
  $(id).setAttribute("aria-expanded", String(open));
  $(id).querySelector(".chev").textContent = open ? "‹" : "›";
}
const isOpen = (id) => $(id).getAttribute("aria-expanded") === "true";
for (const id of Object.keys(SUBS)) $(id).addEventListener("click", () => fold(id, !isOpen(id)));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" && e.key !== "ArrowLeft") return;
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
  const open = Object.keys(SUBS).find(
    (id) => isOpen(id) && ($(SUBS[id]).contains(e.target) || e.target === $(id)),
  );
  if (!open) return;
  e.preventDefault();
  fold(open, false);
  $(open).focus();
});

/** The add-ons' own rows (Share, Live and the rest), under More, as Pipeup's menu would show them: words only. */
function extras(rows) {
  const box = $("extras");
  box.replaceChildren(
    ...rows.map((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item";
      b.title = r.hint;
      const label = Object.assign(document.createElement("span"), { textContent: r.label });
      b.append(label);
      if (r.count) b.append(Object.assign(document.createElement("small"), { textContent: r.count }));
      if (r.checked !== undefined) {
        b.setAttribute("role", "switch");
        b.setAttribute("aria-checked", String(r.checked));
        const sw = document.createElement("span");
        sw.className = "sw";
        sw.setAttribute("aria-hidden", "true");
        b.append(sw);
      }
      b.addEventListener("click", async () => {
        await ask("row", r.key);
        await show();
      });
      return b;
    }),
  );
}

let state = null;
async function show() {
  state = web ? await probe() : null;
  void warnOfAsking();
  $("blocked").hidden = !!state;
  $("built-in").hidden = !state?.builtIn;
  $("off").hidden = !state || state.on || state.builtIn;
  $("on").hidden = !state?.on;
  if (state?.on) {
    $("count").textContent = String(state.count);
    $("count").hidden = state.count === 0;
    $("commenting").checked = state.commenting;
    $("hide").checked = state.hidden;
    $("theme-now").textContent = LOOK_WORDS[state.look] ?? "Automatic";
    // Who you are: the name, or the animal Pipeup gave until there is one, with the invitation beside it.
    $("who-name").textContent = state.name || state.animal || "You";
    $("who-hint").textContent = state.name ? "Edit" : "Add your name";
    $("pinned").checked = canPin && !!(await settings()).pinned;
    // Safari has no panel beside the page, nor a way to reach agents on this computer: those rows aren't offered.
    $("pin-row").hidden = !canPin;
    // Send to my agent is in the top level once it is set up (a send has reached an agent), naming the agent that
    // last answered; until then it is under More, as a row to set up once.
    const { agentUsed, agentName } = await chrome.storage.local.get(["agentUsed", "agentName"]);
    $("agent").hidden = !canReachAgents || !agentUsed;
    $("agent-setup").hidden = !canReachAgents || !!agentUsed;
    $("agent-said").textContent = agentName || "on this computer";
    $("always-row").hidden = local;
    $("local-row").hidden = !local;
    $("local").checked =
      (await chrome.scripting.getRegisteredContentScripts({ ids: ["always local"] })).length > 0;
    $("always").checked = await always();
    extras(state.rows ?? []);
  }
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
// open beside the page too. The background does the adding, so the panel closing (Safari closes it to ask whether
// Pipeup may see the site) doesn't lose the press.
$("start").addEventListener("click", async () => {
  const side = (await settings()).pinned ? openComments() : null;
  const begun = chrome.runtime.sendMessage({ type: "start", tabId: tab.id }).catch(() => null);
  await Promise.race([begun, new Promise((r) => setTimeout(r, 3000))]);
  await side;
  await done();
});

/**
 * Safari grants nothing on a toolbar press: the first time, it asks in words whether Pipeup may see websites. Said
 * here before the press, once, so the question isn't a surprise; after Always Allow on Every Website it never asks again.
 */
async function warnOfAsking() {
  const asks =
    browserName === "safari" &&
    web &&
    !(await chrome.permissions.contains({ origins: ["<all_urls>"] }).catch(() => true));
  $("asks").hidden = !asks;
}

$("commenting").addEventListener("change", async (e) => {
  const side = e.target.checked && state?.hosted ? openComments() : null;
  await ask("mode", e.target.checked);
  await side;
  await done();
});

// Your comments on this page: every comment. Pinned, in the side panel; otherwise in Pipeup's own panel on the page.
$("all").addEventListener("click", async () => {
  if (state?.mode === "pinned") await openComments();
  else await ask("all");
  await done();
});

// Save as a file: a Markdown file or a Pipeup file, saved where the browser saves downloads.
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
  fold("save", false);
  $("saved").textContent = "Saved";
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
  if (!back?.ok || !back.replies.length) return 0;
  // The agent that last answered names the row from now on.
  const agent = back.replies.at(-1)?.agent;
  if (agent) await chrome.storage.local.set({ agentName: String(agent) });
  return (await tell("agentReplies", { replies: back.replies })) ?? 0;
}
/** Sends to the agent, from either row: set up, it says so and the row moves to the top level; else the one command. */
async function sendToAgent(said) {
  // Firefox asks first; the question is put in answer to this press, before anything is awaited.
  if (!(await agreeToSend())) {
    said.textContent = "not sent: Firefox wasn't allowed to";
    return;
  }
  const sent = await tell("agentSend");
  if (!sent) return;
  const answer = await chrome.runtime.sendNativeMessage(HOST, { type: "send", ...sent }).catch(() => null);
  if (!answer?.ok) {
    // The command is under More, with the set-up row: opened, in case the press came from the top level.
    $("agent-cmd").textContent = agentSetup();
    $("agent-help").hidden = false;
    said.textContent = "Not set up yet";
    fold("more", true);
    return;
  }
  said.textContent = "Sent";
  await chrome.storage.local.set({ agentUsed: true });
  await agentReplies();
  await show();
  $("agent-said").textContent = "Sent";
}
$("agent").addEventListener("click", () => sendToAgent($("agent-said")));
$("agent-setup").addEventListener("click", () => sendToAgent($("agent-setup-said")));
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

// Copy comments, one press: readable text a person can paste into a message or an AI chat, which is also Markdown.
$("copy").addEventListener("click", async () => {
  const text = await ask("copy", "ai");
  if (typeof text !== "string") return;
  try {
    await navigator.clipboard.writeText(text);
    const n = state?.count ?? 0;
    $("copied").textContent = `Copied ${n} thread${n === 1 ? "" : "s"}`;
  } catch {
    $("copied").textContent = "Couldn't copy";
  }
});

$("stop").addEventListener("click", async () => {
  await tell("off");
  // Pipeup takes itself off a moment after answering.
  for (let i = 0; i < 40 && (await tell("probe")); i++) await new Promise((r) => setTimeout(r, 50));
  fold("more", false);
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
