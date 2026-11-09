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
