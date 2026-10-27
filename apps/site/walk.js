// The reviewer help page: its scene, the fallback that eases open, and the footer menu. Its prompts are in prompts.js.
(() => {
const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
if (!isMac) {
  document.querySelectorAll("[data-shortcut]").forEach((el) => (el.innerHTML = "<kbd>Shift</kbd><kbd>Alt</kbd><kbd>C</kbd>"));
  document.querySelectorAll(".stage .key").forEach((el) => (el.innerHTML = "<b>Ctrl</b><b>V</b>"));
}

// The scene: a timeline of steps (ms into a loop); a step switches its class on, the CSS eases the change. A "p" step
// is a press: the pointer's ring spreads afresh each time.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
for (const demo of document.querySelectorAll(".demo")) {
  const frame = demo.closest(".showcase2");
  const stage = demo.querySelector(".stage");
  const steps = JSON.parse(demo.dataset.steps);
  const len = +demo.dataset.len;
  const [from, to] = (demo.dataset.type || "0,1").split(",").map(Number);
  const box = demo.querySelector("[data-say]");
  const txt = box && box.querySelector(".txt");
  const ring = demo.querySelector(".tap");
  const zoomed = CSS.supports("zoom", "1");
  const fit = () => { const k = demo.clientWidth / 400; if (zoomed) stage.style.zoom = k; else stage.style.transform = `scale(${k})`; demo.style.height = 270 * k + "px"; };
  fit(); addEventListener("resize", fit);
  let pressed = -1;
  const at = (t) => {
    let press = -1;
    steps.forEach(([ms, cls], k) => { const on = t >= ms; stage.classList.toggle(cls, on); if (on && cls[0] === "p") press = k; });
    if (press !== pressed && ring) { pressed = press; ring.classList.remove("go"); if (press >= 0) { void ring.offsetWidth; ring.classList.add("go"); } }
    stage.classList.toggle("out", t >= len - 500);
    if (box) { const n = Math.round(Math.max(0, Math.min(1, (t - from) / (to - from))) * box.dataset.say.length); txt.textContent = box.dataset.say.slice(0, n); box.classList.toggle("sent", t >= to); }
  };
  const vs = (demo.dataset.variants || "").split(",").filter(Boolean);
  const story = (v) => { stage.dataset.v = v; if (frame) frame.dataset.v = v; };
  const pauseBtn = frame && frame.querySelector(".wpause");
  const still = new URLSearchParams(location.search).get("t"); // e.g. ?t=6000&v=slack shows that moment, for checking
  if (still) { const v = new URLSearchParams(location.search).get("v"); if (v && vs.includes(v)) story(v); at(+still); if (pauseBtn) pauseBtn.hidden = true; continue; }
  if (reducedMotion) { at(len - 600); if (pauseBtn) pauseBtn.hidden = true; continue; }
  // It plays while in view, and can be paused; it picks up where it was.
  let shown = 0, last = 0, raf = 0, seen = false, playing = true;
  const tick = (now) => {
    if (playing) shown += Math.min(now - last, 100);
    last = now;
    if (vs.length) story(vs[Math.floor(shown / len) % vs.length]);
    at(shown % len); raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !seen) { seen = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!e.isIntersecting && seen) { seen = false; cancelAnimationFrame(raf); }
  }).observe(demo);
  if (pauseBtn) pauseBtn.addEventListener("click", () => {
    playing = !playing;
    pauseBtn.setAttribute("aria-label", playing ? "Pause the scene" : "Play the scene");
    pauseBtn.querySelector(".i-pause").style.display = playing ? "" : "none";
    pauseBtn.querySelector(".i-play").style.display = playing ? "none" : "";
  });
}

// "Add it to your own copy": two ways, shown in full before copying, that ease open (and closed again).
for (const b of document.querySelectorAll("[aria-controls]")) {
  const panel = document.getElementById(b.getAttribute("aria-controls"));
  if (!panel) continue;
  b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    panel.classList.toggle("open", open);
    panel.inert = !open;
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
})();
