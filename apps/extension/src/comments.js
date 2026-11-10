// Every page with comments made through the extension, newest first. Words come from other pages: text only.
import { agentSetup, agreeToSend, build, canReachAgents } from "./browser.js";
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

// Settings, kept for every site.
const settings = () => ({ ...(all.settings ?? {}) });
const save = async (change) => {
  all.settings = { ...settings(), ...change };
  await chrome.storage.local.set({ settings: all.settings });
};
const show = document.getElementById("show-button");
show.checked = !!all.settings?.showButton;
show.addEventListener("change", () => void save({ showButton: show.checked }));

// Pictures: on unless turned off; turning them off deletes the ones kept. A browser with nowhere to show them (Safari)
// takes none, and doesn't offer the switch.
document.getElementById("pictures").closest(".row").hidden = !build.pictures;
const pictures = document.getElementById("pictures");
pictures.checked = all.settings?.pictures !== false;
pictures.addEventListener("change", async () => {
  await save({ pictures: pictures.checked });
  if (!pictures.checked)
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith("shot:")));
});

// Add-ons, each with what it needs from the reviewer.
const ADDONS = [
  { id: "emoji", name: "Emoji", says: "Every emoji for reactions. Sends nothing.", on: true },
  { id: "voice", name: "Voice", says: "Dictate a comment. Uses your browser's speech recognition." },
  {
    id: "share",
    name: "Share",
    says: "Share a page's comments with others through a shared copy.",
    field: { key: "share", label: "Sharing address (a mailbox or PrivateBin address)" },
  },
  { id: "live", name: "Live", says: "See others reviewing the same page at the same time." },
  {
    id: "github",
    name: "Save to GitHub",
    says: "Opens GitHub's new-issue page with your comment; GitHub asks you to sign in there, not here.",
    field: { key: "githubRepo", label: "Repository for issues (owner/repo)" },
  },
  {
    id: "identity",
    name: "My identity",
    says: "Take your reviewer identity to another browser with a recovery code.",
  },
];
// Add-ons that send what the reviewer writes: Firefox asks the reviewer to agree before the first is turned on.
const SENDS = new Set(["share", "live", "github"]);
const addonList = document.getElementById("addons");
for (const a of ADDONS.filter((x) => build.addons.includes(x.id))) {
  const id = `addon-${a.id}`;
  const box = Object.assign(document.createElement("input"), { id, type: "checkbox" });
  box.setAttribute("role", "switch");
  box.checked = all.settings?.addons?.[a.id] ?? !!a.on;
  box.addEventListener("change", async () => {
    if (box.checked && SENDS.has(a.id) && !(await agreeToSend())) {
      box.checked = false;
      return;
    }
    await save({ addons: { ...(settings().addons ?? {}), [a.id]: box.checked } });
  });
  const label = Object.assign(document.createElement("label"), { htmlFor: id });
  label.append(a.name, Object.assign(document.createElement("small"), { textContent: a.says }));
  if (a.field) {
    const field = Object.assign(document.createElement("input"), {
      className: "field",
      type: "text",
      value: all.settings?.[a.field.key] ?? "",
      placeholder: a.field.label,
      ariaLabel: a.field.label,
    });
    field.addEventListener("change", () => void save({ [a.field.key]: field.value.trim() }));
    label.append(field);
  }
  const row = Object.assign(document.createElement("div"), { className: "row setting" });
  row.append(label, box);
  addonList.append(row);
}

document.getElementById("agent-cmd").textContent = agentSetup();
// Agents read and answer with the same release as this extension.
const release = `npx --yes pipeup@${chrome.runtime.getManifest().version} browser`;
document.getElementById("agent-read").textContent = `${release} read`;
document.getElementById("agent-reply").textContent = `${release} reply`;
document.getElementById("agent-section").hidden = !canReachAgents;
