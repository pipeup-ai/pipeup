// The prompts, the note for reviewers and the lines for a page, and the Copy buttons that copy them: one source for
// the home page, What your AI does, The details and the reviewer help page. A box marked data-sprompt shows a text's
// words exactly as copied.
(() => {
const SRC = "https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js";
const SRI = "{{SRI:pipeup}}"; // The core's integrity hash for that version, put in when the site is built (inject-core.py).
const PIN = SRI.startsWith("sha") ? ` integrity="${SRI}" crossorigin="anonymous"` : ""; // Unbuilt, or the hash unknown: none.
const TAG = `<script src="${SRC}"${PIN}><\/script>`;
const SITE = "https://pipeup-ai.github.io/pipeup/"; // The canonical address.
const base = location.protocol.startsWith("http") ? new URL(".", location.href).href : SITE; // From disk: the published site.
const GUIDE = `${base}skills/pipeup-integrate/SKILL.md`;
const HELP = `${SITE}add-comments.html`; // In the note, which reviewers read wherever it was sent.
let docKey = null; // A fresh document key for the reader's page, made in this browser.
let copiedKey = null; // The key last copied: the next copy gets a new one, so no two pages share a key.
let nextKey = null; // Made ahead of time, so a copy never waits (the clipboard needs the click's own moment).
const key = () => docKey ?? "<a key from Pipeup.newDocumentAttribute()>";
const NOTE = [
  "You can comment right on this page. Open the file in a web browser such as Chrome, Safari, Edge or Firefox; a preview inside email, chat or a drive may not show the comments.",
  "Click the comment button in the bottom-right corner and choose Start commenting, then click anything, or select some words, and type. On a phone, tap instead of click.",
  "When you're done, click the comment button again, choose Copy comments › As Markdown and paste it into a reply to me. Your comments stay in your browser until you send them.",
  `Help: ${HELP}`,
].join(" ");
const texts = {
  // For someone who was sent a page with no comment button (the reviewer help page).
  a: () => [
    "Someone sent me this HTML file and I'd like to comment on it. Please add Pipeup to my copy so I can comment right on the page.",
    "",
    `1. Edit only the HTML file (there is nothing to download or run): add ${TAG} just before </body>.`,
    `2. If the <html> element has no data-pipeup-doc attribute, add data-pipeup-doc="${key()}". If it already has one, leave it exactly as it is. This key is for this one page: never put it on another page.`,
    "3. Don't change the page's layout or styling.",
    "",
    "When you're done:",
    "- If you can't change the file on my computer, give me the whole new file to download.",
    "- Tell me to open it in my web browser and check for the comment button in the bottom-right corner.",
    "",
    `The full guide: ${GUIDE}`,
  ].join("\n"),
  // For an author with a page to share (the home page's Copy prompt).
  b: () => [
    "Add Pipeup to this HTML page (or the one you are making) so the people I share it with can comment on it right on the page.",
    "",
    `1. Add ${TAG} just before </body>. Edit only the HTML file: there is nothing to download or run.`,
    `2. Add data-pipeup-doc="${key()}" to the <html> element, and keep it exactly as it is from then on. This key is for this one page: every other page needs a key of its own (make one with Pipeup.newDocumentAttribute(), or ask me), never a copy of this one, or their comments mix.`,
    "3. Mark stable blocks (sections, figures, cards) with short data-pipeup-id names, label charts and images with data-pipeup-label, and mark navigation with data-pipeup-ignore.",
    "4. Don't change the page's layout to make room for Pipeup.",
    "",
    "When you're done:",
    "- If you can't change the file on my computer, give me the whole new file to download, and remind me to share that file, not the one I had before.",
    "- Tell me to open it in my web browser and check for the comment button in the bottom-right corner.",
    `- Give me this note to send with it, word for word: "${NOTE}"`,
    "",
    "Later I will paste the comments people send me. Apply each one to the page, tell me what you changed, and give me the whole file again.",
    `The full guide: ${GUIDE}`,
  ].join("\n"),
  note: () => NOTE,
  // The two lines for adding it by hand (The details), and the script line alone (the reviewer help page).
  lines: () => `<html data-pipeup-doc="${key()}">\n\n${PIN ? TAG.replace(" integrity", "\n  integrity") : TAG}`,
  tag: () => TAG,
};
const keyed = new Set(["a", "b", "lines"]); // The texts that carry a document key.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Arriving from a Copy prompt that couldn't copy (prompt.html#select): the prompt's words are selected, ready to copy.
let selecting = location.hash === "#select";
const select = (box) => {
  box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  getSelection().selectAllChildren(box);
};
const show = () => {
  for (const box of document.querySelectorAll("[data-sprompt]")) {
    const words = texts[box.dataset.sprompt]();
    // The note's help address is a link on the page; its words are the same either way.
    if (words.endsWith(HELP)) box.replaceChildren(words.slice(0, -HELP.length), Object.assign(document.createElement("a"), { href: HELP, textContent: HELP }));
    else box.textContent = words;
  }
  const wanted = selecting && document.querySelector('[data-sprompt="b"]');
  if (wanted) select(wanted);
};
show();

// Copying: the clipboard, else the old copy command. If neither is allowed, the page eases to the shown words and
// selects them instead; where they aren't shown (the home page's Copy prompt), What your AI does opens with them selected.
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
  document.body.append(t); t.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  t.remove(); return ok;
};
const said = Object.assign(document.createElement("span"), { className: "sr" }); // Tells screen readers it was copied.
said.setAttribute("aria-live", "polite"); document.body.append(said);
const SAID = { a: "Prompt copied", b: "Prompt copied", note: "Note copied", lines: "Lines copied", tag: "Script line copied" };
for (const b of document.querySelectorAll("[data-scopy]")) {
  let timer = 0;
  b.addEventListener("click", async () => {
    const which = b.dataset.scopy;
    selecting = false;
    if (keyed.has(which) && docKey && docKey === copiedKey && nextKey) { docKey = nextKey; nextKey = null; show(); }
    if (await copy(texts[which]())) {
      if (keyed.has(which) && docKey && docKey !== copiedKey) { copiedKey = docKey; makeNext(); }
      b.classList.add("copied"); said.textContent = SAID[which];
      clearTimeout(timer); timer = setTimeout(() => { b.classList.remove("copied"); said.textContent = ""; }, 2000);
    } else {
      const box = document.querySelector(`[data-sprompt="${which}"]`);
      if (box) select(box);
      else if (which === "b") location.href = "prompt.html#select";
    }
  });
}
async function freshKey() { try { docKey = await window.Pipeup.newDocumentAttribute(); show(); } catch {} }
async function makeNext() { try { nextKey = await window.Pipeup.newDocumentAttribute(); } catch {} }
if (window.Pipeup) freshKey(); else addEventListener("load", freshKey);
})();
