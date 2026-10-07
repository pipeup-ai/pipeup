import { h } from "./dom";
import { icon } from "./icons";

export interface ComposerOptions {
  label: string;
  /** Something to show before the line instead, such as the writer's avatar. */
  before?: Node;
  onSend(text: string): Promise<void> | void;
  onCancel?(): void;
}

export interface Composer {
  element: HTMLElement;
  input: HTMLTextAreaElement;
  focus(): void;
  clear(): void;
}

/** A writing line: no placeholder, Enter sends, Shift+Enter breaks, Esc cancels, a paper plane appears with text. */
export function composer(o: ComposerOptions): Composer {
  const input = h("textarea", { class: "input", rows: "1", "aria-label": o.label });
  // Hidden while the line is empty, and out of Tab's reach.
  const send = h(
    "button",
    { class: "send", type: "button", "aria-label": "Send", title: "Send", inert: true },
    icon("send"),
  );
  const element = h("div", { class: "row" }, o.before, input, send);
  let busy = false;
  const sync = () => {
    const words = input.value.trim() !== "";
    send.classList.toggle("show", words);
    send.inert = !words;
    input.style.height = "auto";
    input.style.height = `${Math.max(27, input.scrollHeight)}px`;
  };
  const submit = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    try {
      await o.onSend(text);
      if (send.matches(":focus")) input.focus();
      input.value = "";
      sync();
    } catch {
      // The caller has already told the reviewer what went wrong; keep their words.
    } finally {
      busy = false;
    }
  };
  // The whole line is somewhere to write: a press anywhere on it but the send arrow puts the caret at the end.
  element.addEventListener("mousedown", (e) => {
    if (e.target === input || send.contains(e.target as Node)) return;
    e.preventDefault();
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  });
  input.addEventListener("input", sync);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      input.value = "";
      sync();
      input.blur();
      o.onCancel?.();
    }
  });
  send.addEventListener("click", (e) => {
    e.stopPropagation();
    void submit();
  });
  return {
    element,
    input,
    focus: () => input.focus({ preventScroll: true }),
    clear: () => {
      input.value = "";
      sync();
    },
  };
}
