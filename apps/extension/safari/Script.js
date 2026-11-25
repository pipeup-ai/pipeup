// Says whether Pipeup is on in Safari (the app tells it), opens Safari's settings or the sample page on a press, and
// shows the licences in place. Design note: docs/design/safari-app-window.md.
function show(enabled, useSettingsInsteadOfPreferences) {
  if (!useSettingsInsteadOfPreferences) {
    for (const b of document.querySelectorAll("button.open-preferences"))
      b.innerText = "Open Safari Preferences";
  }
  if (typeof enabled === "boolean") {
    document.body.classList.toggle("state-on", enabled);
    document.body.classList.toggle("state-off", !enabled);
  } else {
    document.body.classList.remove("state-on", "state-off");
  }
}

const tell = (what) => webkit.messageHandlers.controller.postMessage(what);
for (const b of document.querySelectorAll("button.open-preferences"))
  b.addEventListener("click", () => tell("open-preferences"));
document.querySelector("button.open-sample").addEventListener("click", () => tell("open-sample"));

const front = document.querySelector("main");
const licences = document.querySelector(".licences");
const flip = (toLicences) => (event) => {
  event.preventDefault();
  front.hidden = toLicences;
  licences.hidden = !toLicences;
  window.scrollTo(0, 0);
};
document.querySelector(".show-licences").addEventListener("click", flip(true));
document.querySelector(".hide-licences").addEventListener("click", flip(false));

// The drawing moves, as the website's hero does: each scene is a loop of moments (ms, class on; ms, class off) and
// two spots for the pointer. Only the shown scene plays; with reduced motion each holds its last moment.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const scenes = [
  {
    el: document.querySelector(".scene-settings"),
    len: 5200,
    at: [
      [500, "go", true],
      [500, "s1", true], // the pointer comes in and Pipeup's row lights
      [1500, "press", true],
      [1650, "press", false],
      [1550, "s2", true], // the tick
      [4400, "go", false],
      [4600, "s1", false],
      [4700, "s2", false],
    ],
    spots: [
      [0, 300, 170],
      [500, 31, 87],
    ],
    still: ["s2"],
  },
  {
    el: document.querySelector(".scene-page"),
    len: 8200,
    at: [
      [400, "go", true],
      [900, "s1", true], // towards the words, which light up
      [1500, "press", true],
      [1650, "press", false],
      [1550, "s2", true], // the box opens
      [2100, "s3", true], // typing (the script fills the words)
      [4700, "press", true],
      [4850, "press", false],
      [4800, "s4", true], // sent: the card, and the mark
      [7200, "go", false],
      [7600, "s5", true],
      [8000, "s1", false],
      [8000, "s2", false],
      [8000, "s3", false],
      [8000, "s4", false],
      [8000, "s5", false],
    ],
    spots: [
      [0, 300, 170],
      [400, 150, 56],
      [2000, 150, 56],
      [4000, 182, 122],
    ],
    type: [2100, 4300],
    still: ["s2", "s3", "s4"],
  },
];
for (const sc of scenes) {
  const pointer = sc.el.querySelector(".pointer");
  const box = sc.el.querySelector("[data-say]");
  const txt = box && box.querySelector(".txt");
  sc.draw = (t) => {
    for (const [ms, cls, on] of sc.at) if (t >= ms) sc.el.classList.toggle(cls, on);
    let spot = sc.spots[0];
    for (const s of sc.spots) if (t >= s[0]) spot = s;
    pointer.style.transform = `translate(${spot[1]}px, ${spot[2]}px)`;
    if (box) {
      const [from, to] = sc.type;
      const n = Math.round(Math.max(0, Math.min(1, (t - from) / (to - from))) * box.dataset.say.length);
      txt.textContent = box.dataset.say.slice(0, n);
    }
  };
  if (reduced) {
    for (const cls of sc.still) sc.el.classList.add(cls);
    if (box) txt.textContent = box.dataset.say;
  }
}
if (!reduced) {
  let start = performance.now();
  let last = -1;
  const frame = (now) => {
    const t = (now - start) % scenes[0].len; // settings scene's clock; the page scene has its own below
    const shown = document.body.classList.contains("state-on") ? scenes[1] : scenes[0];
    const tt = (now - start) % shown.len;
    if (shown !== last) {
      for (const sc of scenes) {
        for (const [, cls] of sc.at) sc.el.classList.remove(cls);
        sc.el.classList.remove("go", "press");
      }
      start = now;
      last = shown;
    } else shown.draw(tt);
    void t;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
