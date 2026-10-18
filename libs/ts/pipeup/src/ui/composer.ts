import { h } from "./dom";
import { filterPeople, locate, mentionToken, type Person } from "./mentions";
import type { Mention } from "../model/types";
import { draw } from "./icons";

export interface ComposerOptions {
  /** The send button's word ("Comment", "Reply", "Save"), and the line's name for screen readers unless `name`. */
  label: string;
  /** The line's name for screen readers, when it isn't the button's word ("Edit comment"). */
  name?: string;
  /** What the empty line says ("Comment or add others with @"). */
  placeholder?: string;
  /** Words already in the line (editing a comment). */
  value?: string;
  /** A new comment, or a reply in `thread()`. */
  kind?: "comment" | "reply";
  thread?: () => string;
  /** `mentions`: the people named in the words, found after trimming. */
  onSend(text: string, mentions: Mention[]): Promise<void> | void;
  /** Cancel or Esc: `words` are what was thrown away ("" when the line was empty). */
  onCancel?(words: string): void;
  /** Who can be mentioned with `@`; without it, `@` is just a character. */
  people?(): Person[];
}

export interface Composer {
  element: HTMLElement;
  input: HTMLTextAreaElement;
  focus(): void;
}

/** One live insertion at the caret: words in progress, then final words. */
export interface Dictation {
  /** Replace the words in progress. */
  update(text: string): void;
  /** Make them final; the next update starts after them. */
  commit(text: string): void;
  /** Remove the words in progress. */
  cancel(): void;
}

export interface ComposerHandle {
  readonly kind: "comment" | "reply";
  readonly thread: string | null;
  text(): string;
  focus(): void;
  /** The box is still on screen. */
  connected(): boolean;
  /** aria-pressed and the button's look. */
  setPressed(on: boolean): void;
  dictate(): Dictation;
  /** Send, cancel, clear. Poll `connected()` for a box that is removed. */
  onEnd(fn: () => void): () => void;
}

export interface ComposerTool {
  id: string;
  /** 24-unit SVG path data. */
  icon: readonly string[];
  /** Tooltip and aria-label. */
  label: string;
  /** false: no button at all. */
  available?(): boolean;
  press(handle: ComposerHandle): void;
}

/** What add-ons put in writing lines; set by the app while add-ons are mounted. */
export interface ComposerSource {
  tools(): ComposerTool[];
  note(): string | null;
}
let source: ComposerSource | null = null;
export const setComposerSource = (s: ComposerSource | null): void => {
  source = s;
};
/** The one quiet line add-ons may show above the new-comment box. */
export const composerNote = (): string | null => source?.note() ?? null;
/** Sent to a writing line or a new-comment box when what add-ons put in it changes. */
export const SOURCE_CHANGED = "pu-source";

/**
 * A writing box: what it is for when empty, then Cancel and Send (named for what it does) while it is in use.
 * Enter sends, Shift+Enter breaks, Esc cancels. Send stays grey, and out of Tab's reach, until there are words.
 */
export function composer(o: ComposerOptions): Composer {
  // Each box takes the direction of its own words, so Arabic and Hebrew are written right to left.
  const input = h("textarea", {
    class: "input",
    dir: "auto",
    rows: "1",
    "aria-label": o.name ?? o.label,
    placeholder: o.placeholder ?? "",
  });
  const send = h("button", { class: "send", type: "button", inert: true }, o.label);
  const cancel = h("button", { class: "cnl", type: "button" }, "Cancel");
  // Buttons for add-ons' tools, at the end of the line.
  const slot = h("span", { class: "tools" });
  slot.hidden = true;
  const line = h("div", { class: "line" }, input, slot);
  const element = h("div", { class: "row" }, line, h("div", { class: "bts" }, cancel, send));
  const kind = o.kind ?? "comment";
  let busy = false;
  const ends = new Set<() => void>();
  const ended = () => {
    for (const fn of [...ends]) fn();
  };
  const sync = () => {
    const words = input.value.trim() !== "";
    send.classList.toggle("show", words);
    element.classList.toggle("has", words);
    send.inert = !words;
    input.style.height = "auto";
    input.style.height = `${Math.max(27, input.scrollHeight)}px`;
  };
  const dictation = (): Dictation => {
    let at = -1;
    let len = 0;
    const put = (text: string, final: boolean) => {
      if (at < 0) {
        at = input.selectionStart;
        len = 0;
      }
      const before = input.value.slice(0, at);
      const lead = text && before && !/\s$/.test(before) && !/^\s/.test(text) ? " " : "";
      input.setRangeText(lead + text, at, at + len, "end");
      len = lead.length + text.length;
      if (final) at = -1;
      sync();
    };
    return {
      update: (text) => put(text, false),
      commit: (text) => put(text, true),
      cancel: () => {
        if (at >= 0 && len) input.setRangeText("", at, at + len, "end");
        at = -1;
        len = 0;
        sync();
      },
    };
  };
  const tools = new Map<string, HTMLButtonElement>();
  const syncTools = () => {
    const list = (source?.tools() ?? []).filter((t) => t.available?.() !== false);
    for (const [id, b] of tools)
      if (!list.some((t) => t.id === id)) {
        b.remove();
        tools.delete(id);
      }
    for (const t of list) {
      if (tools.has(t.id)) continue;
      const b = h(
        "button",
        { class: "ib tool", type: "button", "aria-label": t.label, title: t.label, "aria-pressed": "false" },
        draw(t.icon, 15),
      );
      // The line keeps its caret and focus: pressing a tool takes neither.
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          t.press({
            kind,
            thread: o.thread?.() ?? null,
            text: () => input.value,
            focus: () => input.focus({ preventScroll: true }),
            connected: () => element.isConnected,
            setPressed: (on) => b.setAttribute("aria-pressed", String(on)),
            dictate: dictation,
            onEnd: (fn) => {
              ends.add(fn);
              return () => ends.delete(fn);
            },
          });
        } catch (error) {
          globalThis.reportError?.(error);
        }
      });
      tools.set(t.id, b);
      slot.append(b);
    }
    slot.hidden = tools.size === 0;
  };
  syncTools();
  element.addEventListener(SOURCE_CHANGED, syncTools);
  // Typing `@` offers the people who can be mentioned; the choice is remembered, and found again in the final words.
  const chosen: { label: string; ref: string }[] = [];
  const list = h("ul", { class: "mnl", role: "listbox", "aria-label": "People" });
  const live = h("span", { class: "mn-sr", "aria-live": "polite" });
  const listId = `mn-${Math.random().toString(36).slice(2, 8)}`;
  list.id = listId;
  let options: Person[] = [];
  let active = 0;
  let token: { start: number; query: string } | null = null;
  if (o.people) {
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-controls", listId);
    element.append(list, live);
  }
  const closeList = () => {
    options = [];
    list.classList.remove("show");
    input.removeAttribute("aria-activedescendant");
    window.setTimeout(() => !options.length && list.replaceChildren(), 220);
  };
  const paintList = () => {
    for (const [i, li] of [...list.children].entries()) {
      const on = i === active;
      li.setAttribute("aria-selected", String(on));
      li.classList.toggle("on", on);
      if (on) input.setAttribute("aria-activedescendant", (li as HTMLElement).id);
    }
  };
  const openList = () => {
    token =
      input.selectionStart === input.selectionEnd
        ? mentionToken(input.value.slice(0, input.selectionStart))
        : null;
    options = token && o.people ? filterPeople(o.people(), token.query) : [];
    if (!options.length) return closeList();
    active = Math.min(active, options.length - 1);
    list.replaceChildren(
      ...options.map((p, i) => {
        const li = h(
          "li",
          { role: "option", id: `${listId}-${i}`, class: p.agent ? "agent" : "" },
          h("span", {}, p.name),
          p.agent ? h("small", {}, "AI agent") : null,
        );
        // The line keeps its caret: choosing with the pointer takes no focus.
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          choose(i);
        });
        return li;
      }),
    );
    list.classList.add("show");
    live.textContent = `${options.length} ${options.length === 1 ? "person" : "people"}`;
    paintList();
  };
  const choose = (i: number) => {
    const p = options[i];
    if (!p || !token) return;
    const at = input.selectionStart;
    input.setRangeText(`@${p.name} `, token.start, at, "end");
    chosen.push({ label: p.name, ref: p.ref });
    closeList();
    sync();
  };
  const submit = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    try {
      await o.onSend(text, chosen.length ? locate(text, chosen) : []);
      if (send.matches(":focus")) input.focus();
      input.value = "";
      chosen.length = 0;
      closeList();
      sync();
      ended();
    } catch {
      // The caller has already told the reviewer what went wrong; keep their words.
    } finally {
      busy = false;
    }
  };
  // The whole line is somewhere to write: a press anywhere on it but its buttons puts the caret at the end.
  line.addEventListener("mousedown", (e) => {
    if (e.target === input || slot.contains(e.target as Node)) return;
    e.preventDefault();
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  });
  input.addEventListener("input", () => {
    sync();
    if (o.people) openList();
  });
  input.addEventListener("blur", () => options.length && closeList());
  // A page's focus trap that cancels presses outside its dialog would keep the caret out: the line takes it anyway.
  input.addEventListener("mousedown", (e) => e.defaultPrevented && input.focus({ preventScroll: true }));
  // What is typed here is never the page's: not the key going down, nor coming up (a deck may turn on either).
  for (const t of ["keyup", "keypress"]) input.addEventListener(t, (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (options.length && !e.isComposing) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
        return paintList();
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return choose(active);
      }
      // Escape closes the list and nothing else: the words and the line stay.
      if (e.key === "Escape") {
        e.preventDefault();
        return closeList();
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape" && !e.isComposing) {
      // Esc while an input method is composing cancels the composition, never the words.
      e.preventDefault();
      stop();
    }
  });
  /** Cancel and Esc: the words go (the caller may offer them back); a reply line that had words keeps focus. */
  const stop = () => {
    const words = input.value.trim() ? input.value : "";
    input.value = "";
    sync();
    if (!words || kind !== "reply") input.blur();
    ended();
    o.onCancel?.(words);
  };
  // A press on a button keeps the caret where it is (the line doesn't lose focus first).
  for (const b of [send, cancel]) b.addEventListener("mousedown", (e) => e.preventDefault());
  send.addEventListener("click", (e) => {
    e.stopPropagation();
    void submit();
  });
  cancel.addEventListener("click", (e) => {
    e.stopPropagation();
    stop();
  });
  if (o.value) {
    input.value = o.value;
    queueMicrotask(sync);
  }
  return {
    element,
    input,
    focus: () => input.focus({ preventScroll: true }),
  };
}
