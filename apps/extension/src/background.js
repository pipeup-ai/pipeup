// The toolbar button's number: how many open comments the page in that tab has. Pipeup, running in the tab, says.
chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (message?.type !== "count" || tabId === undefined) return;
  const n = Number(message.n) || 0;
  void chrome.action.setBadgeText({
    tabId,
    text: n ? String(Math.min(n, 99)) : "",
  });
  void chrome.action.setBadgeBackgroundColor({ tabId, color: "#534ab7" });
});
