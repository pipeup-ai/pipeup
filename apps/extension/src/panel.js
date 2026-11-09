// The browser's side panel: Pipeup's comments for the tab in front. Pipeup, running in the tab, sends the threads and
// what happens on the page (a highlight clicked, a place picked); this panel draws them and sends back what the
// reviewer does. Words come from other people: they are set as text, never as HTML.
import { formatAgo, nameOf } from "./pipeup/pipeup.esm.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false));
  return e;
};

// The tab it shows: the one in front, or one named in the address (how the tests open it in a tab of its own).
const named = Number(new URLSearchParams(location.search).get("tab"));
let tabId = named || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
let data = null;
let openId = null;
let pick = null;
const filter = { mine: false, resolved: false };
/** Edits under way, by comment id: their words, kept across redraws. */
const editing = new Map();
/** Replies being written, by thread id. */
const replying = new Map();

/** Asks Pipeup in the tab; resolves to its answer, or rejects when Pipeup isn't there. */
async function ask(type, fields = {}) {
  const answer = await chrome.tabs.sendMessage(tabId, { to: "page", type, ...fields });
  if (!answer) throw new Error("Pipeup isn't on this page");
  if (!answer.ok) throw new Error(answer.error);
  return answer.result;
}

async function load() {
  try {
    data = await ask("snapshot");
  } catch {
    data = null;
  }
  // A place picked while this panel was closed waits for it.
  const key = `pick:${tabId}`;
  const kept = (await chrome.storage.session?.get(key))?.[key];
  if (kept && data && !pick) {
    pick = { anchor: kept.anchor, label: kept.label };
    void chrome.storage.session.remove(key);
  }
  draw();
  if (pick) drawDraft(true);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab?.id !== tabId) return;
  if (message.type === "threads") {
    data = message.off ? null : message;
    if (message.off) pick = null;
    draw();
  } else if (message.type === "open") {
    openId = message.id;
    draw();
    if (openId)
      document.querySelector(`[data-thread="${CSS.escape(openId)}"]`)?.scrollIntoView({ block: "nearest" });
  } else if (message.type === "pick") {
    pick = { anchor: message.anchor, label: message.label };
    void chrome.storage.session?.remove(`pick:${tabId}`);
    drawDraft(true);
  }
});

// The panel follows the tab in front, unless the tests named one.
if (!named) {
  chrome.tabs.onActivated.addListener(({ tabId: id }) => {
    tabId = id;
    openId = null;
    pick = null;
    void load();
  });
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (id === tabId && change.status === "complete") void load();
  });
}

$("for-you").addEventListener("click", () => {
  filter.mine = !filter.mine;
  $("for-you").setAttribute("aria-pressed", String(filter.mine));
  draw();
});
$("resolved").addEventListener("click", () => {
  filter.resolved = !filter.resolved;
  $("resolved").setAttribute("aria-pressed", String(filter.resolved));
  draw();
});

// A new comment: written here, about the place picked on the page.
function drawDraft(focus = false) {
  $("draft").hidden = !pick;
  if (!pick) return;
  $("draft-on").textContent = `On ${pick.label}`;
  if (focus) $("draft-words").focus();
}
$("draft-cancel").addEventListener("click", () => {
  pick = null;
  $("draft-words").value = "";
  drawDraft();
});
const send = async () => {
  const text = $("draft-words").value.trim();
  if (!text || !pick) return;
  $("draft-send").disabled = true;
  try {
    openId = await ask("comment", { anchor: pick.anchor, text });
    pick = null;
    $("draft-words").value = "";
    // The new thread opens; the page may have sent it already, before its id came back.
    draw();
  } finally {
    $("draft-send").disabled = false;
  }
};
$("draft-send").addEventListener("click", () => void send());
$("draft-words").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
  if (e.key === "Escape") $("draft-cancel").click();
});

const mentionsMe = (c) => (c.mentions ?? []).some((m) => m.ref === data.me);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const button = (label, run, primary = false) => {
  const b = el("button", { type: "button", className: primary ? "btn primary" : "btn", textContent: label });
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    void run();
  });
  return b;
};

/** One comment: who and when, then the words; your own can be edited or deleted. */
function comment(c, now) {
  const who = nameOf(c);
  const mine = c.author === data.me;
  const words = editing.has(c.id)
    ? editBox(c)
    : el("p", {
        className: "words",
        textContent: c.deleted ? "(deleted)" : c.text + (c.edited ? " (edited)" : ""),
      });
  const reacts = c.reactions?.length
    ? el("p", {
        className: "reacts",
        textContent: c.reactions.map((r) => `${r.emoji} ${r.by.length}`).join(" · "),
      })
    : null;
  return el(
    "div",
    {},
    el(
      "div",
      { className: "head" },
      el("span", { className: "av", textContent: (who[0] ?? "?").toUpperCase() }),
      el("b", { textContent: who }),
      el("span", { textContent: `· ${formatAgo(c.at, now)}` }),
    ),
    words,
    reacts,
    mine && !c.deleted && !editing.has(c.id)
      ? el(
          "div",
          { className: "acts" },
          button("Edit", () => {
            editing.set(c.id, c.text);
            draw();
          }),
          button("Delete", () => ask("remove", { id: c.id })),
        )
      : null,
  );
}

function editBox(c) {
  const box = el("textarea", { value: editing.get(c.id), ariaLabel: "Edit your comment" });
  box.addEventListener("input", () => editing.set(c.id, box.value));
  const save = async () => {
    const text = box.value.trim();
    if (text && text !== c.text) await ask("edit", { id: c.id, text });
    editing.delete(c.id);
    draw();
  };
  return el(
    "div",
    {},
    box,
    el(
      "div",
      { className: "btns" },
      button("Cancel", () => {
        editing.delete(c.id);
        draw();
      }),
      button("Save", save, true),
    ),
  );
}

/** A thread: its place, its first comment, and, open, its replies, a reply box and Resolve. */
function thread(t, now) {
  const open = t.id === openId;
  const place = t.anchor.quote?.exact || t.anchor.snapshot || "";
  const lost = (t.where ?? "").startsWith("No longer on the page");
  const card = el("li", {
    className: `card${open ? " open" : ""}${t.resolved ? " resolved" : ""}`,
  });
  card.dataset.thread = t.id;
  const headline = el(
    "button",
    { type: "button", className: "head", ariaExpanded: String(open) },
    el("span", {
      className: "on",
      textContent: lost ? `No longer on the page · “${clip(place, 70)}”` : `On “${clip(place, 80)}”`,
    }),
  );
  headline.addEventListener("click", () => {
    openId = open ? null : t.id;
    draw();
    if (!open && !lost) void ask("go", { id: t.id }).catch(() => {});
  });
  card.append(headline, comment(t.root, now));
  const replies = t.root.replies.filter((r) => !r.deleted);
  if (!open) {
    if (replies.length)
      card.append(
        el("p", {
          className: "more",
          textContent: `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`,
        }),
      );
    return card;
  }
  if (replies.length)
    card.append(el("ol", { className: "replies" }, ...replies.map((r) => el("li", {}, comment(r, now)))));
  const box = el("textarea", {
    value: replying.get(t.id) ?? "",
    placeholder: "Reply",
    ariaLabel: "Reply",
  });
  box.addEventListener("input", () => replying.set(t.id, box.value));
  const reply = async () => {
    const text = box.value.trim();
    if (!text) return;
    replying.delete(t.id);
    box.value = "";
    try {
      await ask("reply", { id: t.id, text });
    } catch (e) {
      // Not sent: the words come back, so nothing is lost.
      replying.set(t.id, text);
      draw();
      throw e;
    }
  };
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void reply();
  });
  card.append(
    box,
    el(
      "div",
      { className: "btns" },
      t.resolved
        ? button("Reopen", () => ask("reopen", { id: t.id }))
        : button("✓ Resolve", () => ask("resolve", { id: t.id })),
      button("Reply", reply, true),
    ),
  );
  return card;
}

function draw() {
  $("away").hidden = !!data;
  drawDraft();
  const list = $("list");
  const typingIn = document.activeElement?.closest?.("[data-thread]")?.dataset.thread;
  const caret = document.activeElement?.tagName === "TEXTAREA" ? document.activeElement.selectionStart : null;
  list.replaceChildren();
  if (!data) {
    $("empty").hidden = true;
    return;
  }
  const now = Date.now();
  const shown = data.threads.filter(
    (t) =>
      (filter.resolved || !t.resolved) &&
      (!filter.mine || mentionsMe(t.root) || t.root.replies.some(mentionsMe)),
  );
  list.append(...shown.map((t) => thread(t, now)));
  $("empty").hidden = shown.length > 0;
  $("empty").textContent = filter.mine
    ? "No comments mention you."
    : "No comments yet. Turn on Start commenting and click something on the page.";
  // A redraw keeps the caret where the reviewer was writing.
  if (typingIn) {
    const box = list.querySelector(`[data-thread="${CSS.escape(typingIn)}"] textarea`);
    if (box) {
      box.focus();
      if (caret !== null) box.setSelectionRange(caret, caret);
    }
  }
}

await load();
