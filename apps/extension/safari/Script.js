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
