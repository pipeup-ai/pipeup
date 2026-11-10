// Pipeup's comment, reply or name box, as a page of the extension's own, framed where Pipeup's box would be. Keys,
// pastes and dictated words land in this document, which the page can't hear; the words go to Pipeup over a private
// channel. The frame works only for Pipeup: it waits for a channel that brings a one-time pass the extension issued.
let port = null;
let box = null;
let listOpen = false;

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (port || !d || d.pipeup !== "typing" || !e.ports[0]) return;
  const ok = await chrome.runtime.sendMessage({ type: "typing-check", token: d.token }).catch(() => false);
  if (!ok || port) return;
  port = e.ports[0];
  port.onmessage = (m) => fromPipeup(m.data);
  build(d);
  port.postMessage({ type: "ready" });
});

/** The box, made like Pipeup's: a text area for comments and replies, a line for a name. */
function build(d) {
  box = document.createElement(d.kind === "input" ? "input" : "textarea");
  box.className = "box";
  if (d.kind === "input") box.type = "text";
  else box.rows = 1;
  for (const [k, v] of Object.entries(d.attrs ?? {})) box.setAttribute(k, v);
  look(d.look);
  document.body.append(box);
  box.addEventListener("input", () => {
    say({ type: "input", value: box.value, start: box.selectionStart, end: box.selectionEnd });
    height();
  });
  for (const t of ["keyup", "mouseup", "select"])
    box.addEventListener(t, () => say({ type: "caret", start: box.selectionStart, end: box.selectionEnd }));
  box.addEventListener("keydown", (e) => {
    if (taken(e)) e.preventDefault();
    say(keyOf(e));
  });
  box.addEventListener("keyup", (e) => say(keyOf(e)));
  box.addEventListener("blur", () => say({ type: "blur" }));
  box.addEventListener("focus", () => say({ type: "focus" }));
  // The frame given the focus (a press on it, or Pipeup's) puts it in the box.
  window.addEventListener("focus", () => document.activeElement !== box && box.focus());
  new ResizeObserver(height).observe(document.documentElement);
  height();
}

/** Keys Pipeup acts on, whose own effect here would be wrong: Pipeup does what they mean instead. */
function taken(e) {
  if (e.isComposing) return false;
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  if (e.key === "Escape") return true;
  if (e.key === "Enter" && (!e.shiftKey || box.localName === "input")) return true;
  if (listOpen && ["ArrowUp", "ArrowDown", "Tab"].includes(e.key) && plain) return true;
  // A space in an empty box would be thrown away: Space pauses comment mode there instead.
  return e.key === " " && plain && box.localName === "textarea" && box.value.trim() === "";
}

const keyOf = (e) => ({
  type: "key",
  event: e.type,
  key: e.key,
  code: e.code,
  location: e.location,
  repeat: e.repeat,
  isComposing: e.isComposing,
  ctrlKey: e.ctrlKey,
  shiftKey: e.shiftKey,
  altKey: e.altKey,
  metaKey: e.metaKey,
  modifiers: Object.fromEntries(
    ["AltGraph", "CapsLock", "Shift", "Control", "Alt", "Meta"].map((k) => [k, e.getModifierState(k)]),
  ),
});

function fromPipeup(m) {
  if (!box) return;
  if (m.type === "set") {
    // Taking over from Pipeup's own box: anything typed here meanwhile follows what was typed there.
    const typed = m.init ? box.value : "";
    if (box.value !== m.value + typed) box.value = m.value + typed;
    if (typed) {
      box.setSelectionRange(box.value.length, box.value.length);
      say({ type: "input", value: box.value, start: box.selectionStart, end: box.selectionEnd });
    } else if (typeof m.start === "number") box.setSelectionRange(m.start, m.end ?? m.start);
    height();
  } else if (m.type === "focus") {
    box.focus({ preventScroll: true });
  } else if (m.type === "blur") {
    box.blur();
  } else if (m.type === "list") {
    listOpen = !!m.open;
  } else if (m.type === "look") {
    look(m.look);
  } else if (m.type === "attrs") {
    for (const [k, v] of Object.entries(m.attrs)) box.setAttribute(k, v);
  }
}

function look(l) {
  if (!l) return;
  const s = document.documentElement.style;
  s.setProperty("--placeholder", l.placeholder);
  Object.assign(document.body.style, { color: l.color, font: l.font, caretColor: l.caret });
  if (box) Object.assign(box.style, { padding: l.padding, lineHeight: l.lineHeight, textAlign: l.textAlign });
  height();
}

let last = 0;
function height() {
  if (!box || !port) return;
  if (box.localName === "textarea") {
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }
  const h = Math.ceil(box.getBoundingClientRect().height);
  if (h !== last) say({ type: "height", px: (last = h) });
}

const say = (m) => port?.postMessage(m);
