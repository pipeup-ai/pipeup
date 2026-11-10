// What differs between the browsers Pipeup's extension runs in, in one place. Everything else is the same code: Chrome,
// Edge, Firefox and Safari all answer to `chrome.*`.
//
// - The panel beside the page: Chrome and Edge's side panel (per tab), Firefox's sidebar (per window); Safari has none,
//   so comments are never pinned there and always open on the page.
// - The link to agents on this computer (native messaging): Chrome, Edge and Firefox start `pipeup browser`'s host,
//   each from its own host file; Safari only talks to the app it comes in, and `pipeup browser` can't set it up on
//   Windows yet, so it isn't offered there.
// - What this browser's package holds (build.json, written by tools/build-extension.mjs): its add-ons, and whether it
//   takes pictures of where comments were made.

const scheme = location.protocol;
export const browserName = scheme.startsWith("moz-")
  ? "firefox"
  : scheme.startsWith("safari-")
    ? "safari"
    : "chrome";

const firefox = globalThis.browser?.sidebarAction;

/** What this browser's package holds: `{ addons: string[], pictures: boolean }`. */
export const build = await fetch(chrome.runtime.getURL("build.json"))
  .then((r) => r.json())
  .catch(() => ({ addons: ["emoji"], pictures: false }));

/** Which Chromium browser this is, for the host file's place: Edge and Brave keep theirs apart from Chrome's. */
const chromium = () => {
  const brands = navigator.userAgentData?.brands?.map((b) => b.brand) ?? [];
  if (brands.includes("Microsoft Edge") || / Edg\//.test(navigator.userAgent)) return "edge";
  if (navigator.brave || brands.includes("Brave")) return "brave";
  return "chrome";
};

const windows = navigator.userAgentData?.platform === "Windows" || /Windows/.test(navigator.userAgent ?? "");

/** Whether this browser has a panel beside the page for the comments. */
export const canPin = !!(chrome.sidePanel || firefox);

/** Whether Send to my agent can reach agents on this computer from this browser. */
export const canReachAgents = browserName !== "safari" && !windows && !!chrome.runtime.sendNativeMessage;

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

/** The one command that sets up Send to my agent for this browser, from the release this extension is. */
export function agentSetup() {
  const pipeup = `npx --yes pipeup@${chrome.runtime.getManifest().version} browser install`;
  if (browserName === "firefox") return `${pipeup} --browser firefox`;
  const kind = chromium();
  return `${pipeup}${kind === "chrome" ? "" : ` --browser ${kind}`} --extension-id ${chrome.runtime.id}`;
}

/**
 * Firefox asks the reviewer to agree before an extension sends what they write anywhere (its add-ons site requires it):
 * call in answer to a press, before anything is awaited. Resolves true where the browser doesn't ask.
 */
export function agreeToSend() {
  const ask = globalThis.browser?.permissions;
  if (browserName !== "firefox" || !ask) return Promise.resolve(true);
  return ask.request({ data_collection: DATA_SENT }).catch(() => false);
}
/** What Share, Live, Save to GitHub and Send to my agent send, in Firefox's words (manifest: optional data collection). */
export const DATA_SENT = [
  "websiteContent",
  "browsingActivity",
  "personalCommunications",
  "personallyIdentifyingInfo",
];

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
