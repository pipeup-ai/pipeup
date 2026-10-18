import { animalName } from "../model/animals";
import type { Mention } from "../model/types";
import { avatar, easeIn, retire } from "./animals";
import { composer, composerNote, SOURCE_CHANGED } from "./composer";
import type { Ctx, Draft } from "./context";
import { h, inert } from "./dom";
import type { Person } from "./mentions";

export interface DraftOptions {
  /** What the comment is on: a quote or an element label. */
  label: string;
  /** The writer's public key, which picks their animal. */
  me: string;
  /** The writer's name; "" until they add one. */
  name(): string;
  /** Saves a new name (the same path as the menu's Your name). */
  rename(name: string): Promise<void>;
  onSend(text: string, mentions: Mention[]): Promise<void>;
  /** `words`: what Cancel or Esc threw away ("" for an empty box). */
  onCancel(words: string): void;
  /** Who can be mentioned with `@`. */
  people?(): Person[];
}

export interface DraftBox {
  element: HTMLElement;
  focus(): void;
  setLabel(label: string): void;
  /** The naming bar already says what the box is on: its label row takes no space. */
  hideLabel(on: boolean): void;
  /** Remembers the caret; the returned function focuses the box and puts it back. */
  caret(): () => void;
  isEmpty(): boolean;
  /** Puts words back in the box (Undo), with the caret after them. */
  fill(words: string): void;
}

/**
 * The box for a new comment, as a card: who is writing, what it's on, then the writing box. Nobody has to give a
 * name; the top line says who they are ("You're Otter · add your name") and opens a name field in its place.
 */
export function renderDraft(o: DraftOptions): DraftBox {
  // The avatar is a shortcut for the mouse; keyboards and screen readers use the line's own button.
  const me = h("button", { class: "me", type: "button", tabindex: "-1", "aria-hidden": "true" });
  // A click must not leave focus on a button screen readers can't see.
  me.addEventListener("mousedown", (e) => e.preventDefault());
  const comp = composer({
    label: "Comment",
    placeholder: "Comment or add others with @",
    kind: "comment",
    onSend: o.onSend,
    onCancel: o.onCancel,
    people: o.people,
  });
  // One quiet line from add-ons above the box, such as "Comments here are shared with everyone who has this page".
  const note = h("div", { class: "note" });
  const syncNote = () => {
    const text = composerNote();
    note.textContent = text ?? "";
    note.hidden = !text;
  };
  syncNote();

  const say = h("div", { class: "say" });
  // One line: a pasted newline can't split the name.
  const field = h("input", { class: "input", type: "text", maxlength: "80", "aria-label": "Your name" });
  const nf = h("div", { class: "nf" }, field);
  const you = h("div", { class: "you" }, say, nf);
  let shown = "";
  let saving = false;

  /** Shows the current name (or animal) on the avatar and the quiet line. */
  const sync = () => {
    const name = o.name();
    const action = name ? "change" : "add your name";
    me.title = name ? "Change your name" : "Add your name";
    if (!me.lastChild || shown !== name) {
      // The draft's first face arrives with the draft; a new one (a name added) eases in over the old one,
      // which leaves once it is covered.
      const face = avatar(o.me, name);
      const old = me.lastChild as HTMLElement | null;
      if (old) {
        easeIn(face);
        retire(old);
      } else face.classList.add("in");
      me.append(face);
      shown = name;
    }
    const link = h("button", { type: "button" }, action);
    link.addEventListener("click", openName);
    say.replaceChildren(h("span", { class: "nm" }, name || `You're ${animalName(o.me)}`), " · ", link);
  };

  const setNaming = (on: boolean) => {
    you.classList.toggle("naming", on);
    inert(say, on);
    inert(nf, !on);
  };

  function openName(e: Event): void {
    e.stopPropagation();
    field.value = o.name();
    setNaming(true);
    // At once, not on a timer: keys typed right away belong to the field.
    field.focus({ preventScroll: true });
    field.select();
  }

  const closeName = () => {
    setNaming(false);
    comp.focus();
  };

  me.addEventListener("click", openName);
  field.addEventListener("keydown", (e) => {
    // The name field's keys are its own: Escape here must not also drop the draft.
    e.stopPropagation();
    if (e.key === "Escape" && !e.isComposing) {
      e.preventDefault();
      closeName();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const value = field.value.trim();
      if (!value || value === o.name()) return closeName();
      if (saving) return;
      saving = true;
      void o.rename(value).finally(() => {
        saving = false;
        sync();
        closeName();
      });
    }
  });

  sync();
  setNaming(false);
  const ctxLine = h("div", { class: "ctx" }, o.label);
  const element = h(
    "div",
    { class: "draft" },
    h("div", { class: "hdr" }, me, you),
    ctxLine,
    note,
    comp.element,
  );
  element.addEventListener(SOURCE_CHANGED, syncNote);
  return {
    element,
    caret: () => {
      const { selectionStart: a, selectionEnd: b } = comp.input;
      return () => {
        comp.focus();
        comp.input.setSelectionRange(a, b);
      };
    },
    hideLabel: (on) => {
      ctxLine.hidden = on;
    },
    setLabel: (label) => {
      ctxLine.textContent = label;
    },
    focus: () => comp.focus(),
    isEmpty: () => comp.input.value.trim() === "",
    fill: (words) => {
      comp.input.value = words;
      comp.input.dispatchEvent(new Event("input"));
      comp.focus();
      comp.input.setSelectionRange(words.length, words.length);
    },
  };
}

/** Each draft keeps one box, so it can move between the page and All comments with its words, caret and name field. */
const boxes = new WeakMap<Draft, DraftBox>();

/**
 * The box for the app's current draft. While it holds words, a click elsewhere won't throw them away.
 * The caller focuses it as soon as it is in the page: a deferred focus could land after the reader has
 * already moved on, taking their typing or the new selection they just made.
 */
export function draftBox(ctx: Ctx, d: Draft): DraftBox {
  const box =
    boxes.get(d) ??
    renderDraft({
      label: d.label,
      me: ctx.doc.me,
      name: () => ctx.menu.name(),
      rename: (name) => ctx.menu.rename(name),
      onSend: (text, mentions) => ctx.postDraft(text, mentions),
      people: () => ctx.people(),
      onCancel: (words) => ctx.cancelDraft(words),
    });
  boxes.set(d, box);
  ctx.registerDraft(box);
  return box;
}
