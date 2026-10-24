// The walkthrough pages: each plays its scene, and the footer menu. Their prompts are in prompts.js.
(() => {
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
