// Every page with comments made through the extension, newest first. Words come from other pages: text only.
const all = await chrome.storage.local.get(null);
const pages = Object.entries(all)
  .filter(([k]) => k.startsWith("page:"))
  .map(([k, page]) => {
    const ops = all[`doc:${k.slice(5)}`] ?? [];
    return {
      ...page,
      threads: ops.filter((o) => o.body?.kind === "create").length,
    };
  })
  .filter((p) => p.threads > 0)
  .sort((a, b) => b.at - a.at);

const list = document.getElementById("pages");
for (const p of pages) {
  const link = Object.assign(document.createElement("a"), {
    href: p.url,
    textContent: p.title || p.url,
  });
  const where = Object.assign(document.createElement("small"), {
    textContent: p.url,
  });
  const count = Object.assign(document.createElement("span"), {
    textContent: `${p.threads} comment${p.threads === 1 ? "" : "s"} · ${new Date(p.at).toLocaleDateString()}`,
  });
  const words = document.createElement("div");
  words.append(link, where);
  const item = document.createElement("li");
  item.append(words, count);
  list.append(item);
}
document.getElementById("none").hidden = pages.length > 0;

// The one setting: bring Pipeup's own corner button back on pages the extension adds it to.
const show = document.getElementById("show-button");
show.checked = !!all.settings?.showButton;
show.addEventListener("change", () => {
  void chrome.storage.local.set({ settings: { ...all.settings, showButton: show.checked } });
});
