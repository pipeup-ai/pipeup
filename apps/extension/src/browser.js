// What differs between the browsers Pipeup's extension runs in, in one place. Everything else is the same code: Chrome,
// Edge, Firefox and Safari all answer to `chrome.*`.
//
// - The panel beside the page: Chrome and Edge's side panel (per tab), Firefox's sidebar (per window); Safari has none,
//   so comments are never pinned there and always open on the page.
// - The link to agents on this computer (native messaging): Chrome, Edge and Firefox start `pipeup browser`'s host,
//   each from its own host file; Safari only talks to the app it comes in, so it isn't offered there yet.

const scheme = location.protocol;
export const browserName = scheme.startsWith("moz-")
  ? "firefox"
  : scheme.startsWith("safari-")
    ? "safari"
    : "chrome";

const firefox = globalThis.browser?.sidebarAction;

/** Whether this browser has a panel beside the page for the comments. */
export const canPin = !!(chrome.sidePanel || firefox);

/** Whether Send to my agent can reach agents on this computer from this browser. */
export const canReachAgents = browserName !== "safari" && !!chrome.runtime.sendNativeMessage;

/**
 * Opens the panel beside the page. Browsers allow it only in answer to a press, so call it before anything is awaited.
 * Resolves whether or not it opened.
 */
export function openSide(tabId) {
  if (chrome.sidePanel) return chrome.sidePanel.open({ tabId }).catch(() => {});
  if (firefox) return firefox.open().catch(() => {});
  return Promise.resolve();
}

/** Closes the panel beside the page, from inside it. */
export function closeSide() {
  if (firefox) return void firefox.close().catch(() => window.close());
  window.close();
}

/** The one command that sets up Send to my agent for this browser. */
export function agentSetup() {
  return browserName === "firefox"
    ? "npx --yes pipeup@0 browser install --browser firefox"
    : `npx --yes pipeup@0 browser install --extension-id ${chrome.runtime.id}`;
}

/**
 * Tells the background whether the browser is dark, so the toolbar button's bubble is light on a dark toolbar and dark
 * on a light one (Safari tints its template itself). Every page of the extension says so as it opens, and again when it
 * changes.
 */
export function sayLook() {
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const say = () => void chrome.runtime.sendMessage({ type: "look", dark: dark.matches }).catch(() => {});
  say();
  dark.addEventListener("change", say);
}
sayLook();
