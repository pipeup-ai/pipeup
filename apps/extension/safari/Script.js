// Says whether Pipeup is on in Safari (the app tells it), and opens Safari's settings on a press.
function show(enabled, useSettingsInsteadOfPreferences) {
  if (!useSettingsInsteadOfPreferences) {
    document.querySelector(".state-unknown").innerText =
      "Turn Pipeup on in Safari Preferences, under Extensions.";
    document.querySelector(".state-off").innerText =
      "Pipeup is off. Turn it on in Safari Preferences, under Extensions.";
    document.querySelector("button.open-preferences").innerText = "Open Safari Preferences";
  }
  if (typeof enabled === "boolean") {
    document.body.classList.toggle("state-on", enabled);
    document.body.classList.toggle("state-off", !enabled);
  } else {
    document.body.classList.remove("state-on", "state-off");
  }
}

document.querySelector("button.open-preferences").addEventListener("click", () => {
  webkit.messageHandlers.controller.postMessage("open-preferences");
});
