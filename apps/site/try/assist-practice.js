// Practice mode for the Assist try pages (add ?practice to the address): a scripted pretend assistant, so the flow can
// be seen in a browser with no built-in model. It is not an AI: it reads the page's words with simple rules.
(() => {
  const practice = new URLSearchParams(location.search).has("practice");
  const here = location.pathname.split("/").pop() || "assist.html";
  const note = document.querySelector("[data-practice-note]");
  if (note)
    note.innerHTML = practice
      ? `<b>Practice mode:</b> a scripted pretend assistant, not an AI. <a href="${here}">Use the browser's model instead</a>`
      : `No built-in model? <a href="${here}?practice">Try practice mode</a>, a scripted pretend assistant.`;
  if (!practice) return;
  const tag = (text, name) => (text.split(`<${name}>`).pop() ?? "").split(`</${name}>`)[0].trim();
  window.pipeupAssistEngine = {
    info: { name: "Practice assistant (scripted, not an AI)", maker: "Pipeup", download: "None", memory: "none" },
    availability: async () => "ready",
    create: async () => ({
      prompt: async (text) => {
        if (/Read this section/.test(text)) return "Gist: a part of the plan.\nFacts: dates, numbers and goals.";
        if (/Find the one sentence/.test(text)) {
          const seen = tag(text, "passage");
          // The first sentence of the section that says something with a number, a goal or a date, and isn't the passage.
          return (
            tag(text, "section")
              .split(/(?<=[.!?])\s+/)
              .find((s) => /(\d|July|churn|goal)/i.test(s) && !seen.includes(s)) || "NONE"
          );
        }
        return /(\d|date|July|sure|churn|goal|risk)/i.test(tag(text, "comment")) ? "related" : "none";
      },
      async *stream() {
        yield "Do you mean the date, or the number?";
      },
      destroy() {},
    }),
  };
})();
