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

// The toolbar button's bubble follows the browser's look: dark on a light toolbar, light on a dark one. The background
// can't see the look, so the extension's pages and Pipeup in tabs say it; the last one heard is kept for the next start.
// Safari takes its one icon as a template and tints it itself.
const safari = location.protocol.startsWith("safari");
const toolbarIcon = (dark) => {
  const look = dark ? "dark" : "light";
  return chrome.action.setIcon({
    path: { 16: `icons/toolbar-${look}-16.png`, 32: `icons/toolbar-${look}-32.png` },
  });
};
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "look" || safari) return;
  const dark = message.dark === true;
  void toolbarIcon(dark).catch(() => {});
  void chrome.storage.local.set({ dark });
});
if (!safari)
  void chrome.storage.local.get("dark").then(({ dark }) => dark && toolbarIcon(true).catch(() => {}));

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
    // Pipeup starts in a moment; then the comment box opens on what was right-clicked.
    await chrome.scripting.executeScript({
      target,
      func: async () => {
        for (let i = 0; i < 100 && !globalThis.__pipeupExt?.pu; i++)
          await new Promise((r) => setTimeout(r, 50));
      },
    });
    await chrome.tabs.sendMessage(tab.id, {
      to: "page",
      type: "commentOn",
      selection: !!info.selectionText,
      src: info.srcUrl ?? null,
      link: info.linkUrl ?? null,
    });
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
async function picture(windowId, { thread, rect, view }) {
  const { settings } = await chrome.storage.local.get("settings");
  if (settings?.pictures === false) return;
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
