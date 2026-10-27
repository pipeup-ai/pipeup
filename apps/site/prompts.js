// The prompts for putting Pipeup in a page, and the Copy prompt buttons that copy them: one source for the home
// page's Quick start and the walkthrough pages. A box marked data-sprompt shows a prompt's words exactly as copied.
(() => {
const TAG = '<script src="https://cdn.jsdelivr.net/npm/pipeup@0.8.2/dist/pipeup.min.js"><\/script>';
const SITE = "https://pipeup-ai.github.io/pipeup/"; // The canonical address.
const base = location.protocol.startsWith("http") ? new URL(".", location.href).href : SITE; // From disk: the published site.
const GUIDE = `${base}skills/pipeup-integrate/SKILL.md`;
let docKey = null; // A fresh document key for the reader's page, made in this browser.
let copiedKey = null; // The key last copied: the next copy gets a new one, so no two pages share a key.
let nextKey = null; // Made ahead of time, so a copy never waits (the clipboard needs the click's own moment).
const prompts = {
  a: () => [
    "Someone sent me this HTML file and I'd like to comment on it. Please add Pipeup to my copy so I can comment right on the page.",
    "",
    `1. Edit only the HTML file (there is nothing to download or run): add ${TAG} just before </body>.`,
    `2. If the <html> element has no data-pipeup-doc attribute, add data-pipeup-doc="${docKey ?? "<a key from Pipeup.newDocumentAttribute()>"}". If it already has one, leave it exactly as it is. This key is for this one page: never put it on another page.`,
    "3. Don't change the page's layout or styling.",
    "",
    `When you are done, tell me how to start commenting. The full guide: ${GUIDE}`,
  ].join("\n"),
  b: () => [
    "Add Pipeup to this HTML page (or the one you are making) so the people I share it with can comment on it right on the page.",
    "",
    `1. Add ${TAG} just before </body>. Edit only the HTML file: there is nothing to download or run.`,
    `2. Add data-pipeup-doc="${docKey ?? "<a key from Pipeup.newDocumentAttribute()>"}" to the <html> element, and keep it exactly as it is from then on. This key is for this one page: every other page needs a key of its own (make one with Pipeup.newDocumentAttribute(), or ask me), never a copy of this one, or their comments mix.`,
    "3. Mark stable blocks (sections, figures, cards) with short data-pipeup-id names, label charts and images with data-pipeup-label, and mark navigation with data-pipeup-ignore.",
    "4. Don't change the page's layout to make room for Pipeup.",
    "",
    "Later I will paste comments copied from Pipeup (Copy comments › As Markdown); apply each one to the page.",
    `The full guide: ${GUIDE}`,
  ].join("\n"),
};
const show = () => { for (const box of document.querySelectorAll("[data-sprompt]")) box.textContent = prompts[box.dataset.sprompt](); };
show();

// Copying: the clipboard, else the old copy command; if neither is allowed, the shown words are selected instead.
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
  document.body.append(t); t.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  t.remove(); return ok;
};
const said = Object.assign(document.createElement("span"), { className: "sr" }); // Tells screen readers it was copied.
said.setAttribute("aria-live", "polite"); document.body.append(said);
for (const b of document.querySelectorAll("[data-scopy]")) {
  let timer = 0;
  b.addEventListener("click", async () => {
    const key = b.dataset.scopy;
    if (docKey && docKey === copiedKey && nextKey) { docKey = nextKey; nextKey = null; show(); }
    if (await copy(prompts[key]())) {
      if (docKey && docKey !== copiedKey) { copiedKey = docKey; makeNext(); }
      b.classList.add("copied"); said.textContent = "Prompt copied";
      clearTimeout(timer); timer = setTimeout(() => { b.classList.remove("copied"); said.textContent = ""; }, 2000);
    } else {
      const box = document.querySelector(`[data-sprompt="${key}"]`);
      if (box) getSelection().selectAllChildren(box);
    }
  });
}
async function freshKey() { try { docKey = await window.Pipeup.newDocumentAttribute(); show(); } catch {} }
async function makeNext() { try { nextKey = await window.Pipeup.newDocumentAttribute(); } catch {} }
if (window.Pipeup) freshKey(); else addEventListener("load", freshKey);
})();
