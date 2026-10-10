// The walkthrough pages: each plays its scene, has its own prompt, and the footer menu.
(() => {
const TAG = '<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js"><\/script>';
const SITE = "https://pipeup-ai.github.io/pipeup/"; // The canonical address.
const base = location.protocol.startsWith("http") ? new URL(".", location.href).href : SITE; // From disk: the published site.
const GUIDE = `${base}skills/pipeup-integrate/SKILL.md`;
let docKey = null; // A fresh document key for the reader's page, made in this browser.
const prompts = {
  a: () => [
    "Someone sent me this HTML file and I'd like to comment on it. Please add Pipeup to my copy so I can comment right on the page.",
    "",
    `1. Edit only the HTML file (there is nothing to download or run): add ${TAG} just before </body>.`,
    `2. If the <html> element has no data-pipeup-doc attribute, add data-pipeup-doc="${docKey ?? "<a key from Pipeup.newDocumentAttribute()>"}". If it already has one, leave it exactly as it is.`,
    "3. Don't change the page's layout or styling.",
    "",
    `When you are done, tell me how to start commenting. The full guide: ${GUIDE}`,
  ].join("\n"),
  b: () => [
    "When you create this HTML page, add Pipeup so the people I share it with can comment on it right on the page.",
    "",
    `1. Add ${TAG} just before </body>. Edit only the HTML file: there is nothing to download or run.`,
    `2. Add data-pipeup-doc="${docKey ?? "<a key from Pipeup.newDocumentAttribute()>"}" to the <html> element, and keep it exactly as it is from then on.`,
    "3. Mark stable blocks (sections, figures, cards) with short data-pipeup-id names, label charts and images with data-pipeup-label, and mark navigation with data-pipeup-ignore.",
    "4. Don't change the page's layout to make room for Pipeup.",
    "",
    "Later I will paste comments copied from Pipeup (Copy as Markdown); apply each one to the page.",
    `The full guide: ${GUIDE}`,
  ].join("\n"),
};

// The scenes: each is a timeline of steps (ms into a loop); a step switches its class on, the CSS eases the change.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
for (const demo of document.querySelectorAll(".demo")) {
  const stage = demo.querySelector(".stage");
  const steps = JSON.parse(demo.dataset.steps);
  const len = +demo.dataset.len;
  const [from, to] = (demo.dataset.type || "0,1").split(",").map(Number);
  const box = demo.querySelector("[data-say]");
  const txt = box && box.querySelector(".txt");
  const zoomed = CSS.supports("zoom", "1");
  const fit = () => { const k = demo.clientWidth / 400; if (zoomed) stage.style.zoom = k; else stage.style.transform = `scale(${k})`; demo.style.height = 270 * k + "px"; };
  fit(); addEventListener("resize", fit);
  const compose = demo.dataset.compose ? JSON.parse(demo.dataset.compose) : null;
  const typed = compose && demo.querySelector(".typed");
  const at = (t) => {
    if (compose) {
      let text = "", typing = false;
      for (const c of compose) {
        if (t < c.from || t >= c.clear) continue;
        const n = Math.round(Math.max(0, Math.min(1, (t - c.from) / (c.to - c.from))) * c.text.length);
        text = c.text.slice(0, n); typing = t < c.to + 200;
      }
      typed.textContent = text;
      stage.classList.toggle("tp", typing);
    }
    for (const [ms, cls] of steps) stage.classList.toggle(cls, t >= ms);
    stage.classList.toggle("carrying", stage.classList.contains("cy") && !stage.classList.contains("dr"));
    stage.classList.toggle("out", t >= len - 500);
    if (box) { const n = Math.round(Math.max(0, Math.min(1, (t - from) / (to - from))) * box.dataset.say.length); txt.textContent = box.dataset.say.slice(0, n); box.classList.toggle("sent", t >= to); }
  };
  const still = new URLSearchParams(location.search).get("t"); // e.g. ?t=6000&v=slack shows that moment, for checking
  if (still) { const v = new URLSearchParams(location.search).get("v"); if (v && demo.dataset.variants) stage.dataset.v = v; at(+still); continue; }
  if (reducedMotion) { at(len - 600); continue; }
  let start = 0, raf = 0, seen = false;
  const vs = (demo.dataset.variants || "").split(",").filter(Boolean);
  const frame = (now) => {
    const n = Math.floor((now - start) / len);
    if (vs.length) stage.dataset.v = vs[n % vs.length];
    at((now - start) % len); raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !seen) { seen = true; start = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && seen) { seen = false; cancelAnimationFrame(raf); }
  }).observe(demo);
}
for (const b of document.querySelectorAll("[data-scopy]")) {
  b.addEventListener("click", async () => {
    const text = prompts[b.dataset.scopy]();
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
    const label = b.querySelector(".label"); const was = label.textContent;
    b.classList.add("copied"); label.textContent = "Copied";
    setTimeout(() => { b.classList.remove("copied"); label.textContent = was; }, 2000);
  });
}
// For agents: hover or focus shows the menu; on touch screens (no hover) the first tap opens it.
const agents = document.querySelector(".agents");
const agentsLink = agents.querySelector(".agents-link");
const setAgents = (on) => { agents.classList.toggle("open", on); agentsLink.setAttribute("aria-expanded", String(on)); };
agentsLink.addEventListener("click", (e) => {
  if (matchMedia("(hover: none)").matches && !agents.classList.contains("open")) { e.preventDefault(); setAgents(true); }
});
agents.addEventListener("mouseenter", () => agentsLink.setAttribute("aria-expanded", "true"));
agents.addEventListener("mouseleave", () => setAgents(false));
agents.addEventListener("keydown", (e) => { if (e.key === "Escape") { setAgents(false); agentsLink.blur(); } });
document.addEventListener("click", (e) => { if (!agents.contains(e.target)) setAgents(false); });
async function freshKey() { try { docKey = await window.Pipeup.newDocumentAttribute(); } catch {} }
if (window.Pipeup) freshKey(); else addEventListener("load", freshKey);
})();
