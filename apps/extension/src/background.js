// The toolbar button: how many open comments the page in that tab has, in violet, or in green while comment mode is
// on (it says "on" when there are none). Pipeup, running in the tab, says.
chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (message?.type !== "state" || tabId === undefined) return;
  const n = Number(message.n) || 0;
  const commenting = message.commenting === true;
  void chrome.action.setBadgeText({ tabId, text: n ? String(Math.min(n, 99)) : commenting ? "on" : "" });
  void chrome.action.setBadgeBackgroundColor({ tabId, color: commenting ? "#2f7d4a" : "#534ab7" });
  void chrome.action.setBadgeTextColor?.({ tabId, color: "#ffffff" });
});

// The one shortcut, Shift+Alt+C, as the browser delivers it (the page needn't be open to the extension yet: the key
// grants the tab, as the toolbar button does). Pipeup off on the page: start it with comment mode on, as Comment on
// this page does. Pipeup on: comment mode off or on, from the last state the page reported. The page's own copy of
// the shortcut stands aside while the extension is there (start.js), so one press is one change.
const commenting = new Map(); // tab id → whether comment mode is on, as the page last said
chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (message?.type === "state" && tabId !== undefined) commenting.set(tabId, message.commenting === true);
});
chrome.tabs.onRemoved.addListener((tabId) => commenting.delete(tabId));
chrome.commands?.onCommand.addListener((command, tab) => {
  if (command === "comment" && tab?.id !== undefined) void comment(tab.id);
});
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== "comment" || typeof message.tabId !== "number") return;
  comment(message.tabId).then(
    () => reply({ ok: true }),
    () => reply({ ok: false }),
  );
  return true;
});

/** Pipeup in `tab` answers once it has started there. */
async function started(tabId, frameId = 0) {
  for (let i = 0; i < 100; i++) {
    const answer = await chrome.tabs
      .sendMessage(tabId, { to: "page", type: "probe" }, { frameId })
      .catch(() => null);
    if (answer?.ok) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/**
 * A page with Pipeup built in keeps its own: the press goes to it as its shortcut (a browser takes the shortcut
 * before the page sees it, so this is how the key still reaches the page's Pipeup). True when it was handed over.
 */
async function handOver(tabId, frameId = 0) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId, ...(frameId ? { frameIds: [frameId] } : {}) },
    func: () => {
      if (!globalThis.__pipeupExt?.builtIn) return false;
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "C",
          code: "KeyC",
          shiftKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      return true;
    },
  });
  return result === true;
}

/** Comment in `tab`: Pipeup off there, start it with comment mode on; on, comment mode off or on; built in, hand over. */
async function comment(tabId) {
  const page = { to: "page" };
  try {
    const there = await chrome.tabs
      .sendMessage(tabId, { ...page, type: "probe" }, { frameId: 0 })
      .catch(() => null);
    if (there?.ok) {
      await chrome.tabs.sendMessage(
        tabId,
        { ...page, type: "act", action: "mode", value: !commenting.get(tabId) },
        { frameId: 0 },
      );
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: ["start.js"] });
    if (await handOver(tabId)) return;
    if (!(await started(tabId))) return;
    await chrome.tabs.sendMessage(
      tabId,
      { ...page, type: "act", action: "mode", value: true },
      { frameId: 0 },
    );
  } catch {
    // A page browsers keep closed to extensions.
  }
}

// Comment on this page, from the toolbar panel: adds Pipeup to the tab and starts comment mode. Done here, not in the
// panel, because Safari closes the panel while it asks whether Pipeup may see the site, which would lose the press.
// Where adding the script is refused until the question is answered, it is tried again as soon as the site is allowed.
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== "start" || typeof message.tabId !== "number") return;
  startCommenting(message.tabId).then(
    () => reply({ ok: true }),
    () => reply({ ok: false }),
  );
  return true;
});
async function startCommenting(tabId) {
  const { url } = await chrome.tabs.get(tabId);
  const origins = [`${new URL(url).origin}/*`];
  for (let i = 0; ; i++) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["start.js"] });
      break;
    } catch (e) {
      // Up to a minute for the answer to the browser's own question; then the press has lapsed.
      if (i >= 120 || (await chrome.permissions.contains({ origins }).catch(() => false))) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!(await started(tabId))) return;
  await chrome.tabs.sendMessage(
    tabId,
    { to: "page", type: "act", action: "mode", value: true },
    { frameId: 0 },
  );
}

// The browser's right-click menu: "Comment with Pipeup" on selected words, a picture, a link, or anything on the page.
// The click lets the extension into that tab, as pressing the toolbar button does.
const MENU = "pipeup-comment";
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU,
    title: "Comment with Pipeup",
    contexts: ["selection", "image", "link", "page"],
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU || tab?.id === undefined) return;
  const target = { tabId: tab.id, ...(info.frameId ? { frameIds: [info.frameId] } : {}) };
  try {
    await chrome.scripting.executeScript({ target, files: ["start.js"] });
    // Pipeup starts in a moment (it answers once it has); then the comment box opens on what was right-clicked. A page
    // with Pipeup built in gets the press as its shortcut instead.
    if (await handOver(tab.id, info.frameId ?? 0)) return;
    if (!(await started(tab.id, info.frameId ?? 0))) return;
    await chrome.tabs.sendMessage(
      tab.id,
      {
        to: "page",
        type: "commentOn",
        selection: !!info.selectionText,
        src: info.srcUrl ?? null,
        link: info.linkUrl ?? null,
      },
      { frameId: info.frameId ?? 0 },
    );
  } catch {
    // A page browsers keep closed to extensions, or one with Pipeup built in.
  }
});

// A picture of where a comment was made, kept in this browser only: the tab as it looks, cut to the comment's place and
// what's around it, everything else faded, at most 480 pixels wide.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "shot" || sender.tab?.windowId === undefined) return;
  void picture(sender.tab.windowId, message).catch(() => {
    // The extension may not be allowed to see this tab (a site that is "Always on" without a press): no picture.
  });
});
// A comment deleted: its picture goes too.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "unshot" || typeof message.thread !== "string") return;
  void chrome.storage.local.remove(`shot:${message.thread}`).catch(() => {});
});
/** Whether this browser's package takes pictures (build.json: Safari's doesn't, having nowhere to show them). */
const takesPictures = fetch(chrome.runtime.getURL("build.json"))
  .then((r) => r.json())
  .then((b) => b.pictures === true)
  .catch(() => false);
async function picture(windowId, { thread, rect, view }) {
  const { settings } = await chrome.storage.local.get("settings");
  if (settings?.pictures === false || !(await takesPictures)) return;
  const shot = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 80 });
  const bmp = await createImageBitmap(await (await fetch(shot)).blob());
  const k = bmp.width / view.width;
  const pad = 32;
  const sx = Math.max(0, (rect.x - pad) * k);
  const sy = Math.max(0, (rect.y - pad) * k);
  const sw = Math.min(bmp.width - sx, (rect.width + 2 * pad) * k);
  const sh = Math.min(bmp.height - sy, (rect.height + 2 * pad) * k, sw * 1.2);
  const scale = Math.min(1, 480 / sw);
  const [w, h] = [Math.round(sw * scale), Math.round(sh * scale)];
  const canvas = new OffscreenCanvas(w, h);
  const g = canvas.getContext("2d");
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  // Fade what isn't the comment's place, and ring the place in Pipeup's accent.
  const box = {
    x: (rect.x * k - sx) * scale,
    y: (rect.y * k - sy) * scale,
    w: rect.width * k * scale,
    h: Math.min(rect.height * k * scale, h),
  };
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.fillRect(0, 0, w, box.y);
  g.fillRect(0, box.y + box.h, w, h - box.y - box.h);
  g.fillRect(0, box.y, box.x, box.h);
  g.fillRect(box.x + box.w, box.y, w - box.x - box.w, box.h);
  g.strokeStyle = "#534ab7";
  g.lineWidth = 2;
  g.strokeRect(box.x, box.y, box.w, box.h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await chrome.storage.local.set({ [`shot:${thread}`]: `data:image/jpeg;base64,${btoa(binary)}` });
}

// Passes for the typing frame (typing.html): Pipeup in a tab asks for one as it frames a box, and the frame shows it
// back once. A page that frames typing.html itself has none, so its frame stays an empty box that does nothing.
const passes = new Set();
const TYPING = chrome.runtime.getURL("typing.html");
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === "typing-token" && sender.tab && !sender.url?.startsWith(TYPING)) {
    const token = crypto.randomUUID();
    passes.add(token);
    setTimeout(() => passes.delete(token), 60_000);
    reply(token);
  } else if (message?.type === "typing-check" && sender.url?.startsWith(TYPING)) {
    const ok = passes.delete(message.token);
    reply(ok);
    // Pipeup in the tab trusts the frame's channel only once this says so.
    if (ok && sender.tab?.id !== undefined)
      void chrome.tabs
        .sendMessage(sender.tab.id, { type: "typing-ok", token: message.token })
        .catch(() => {});
  }
});
