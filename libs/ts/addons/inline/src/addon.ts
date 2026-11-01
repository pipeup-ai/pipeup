import type { AddonHost, Comment, PipeupAddon, Thread } from "pipeup";
import { pageSetting } from "@pipeup/kit";
import {
  AGREE,
  ASKED,
  askedAs,
  CHANGE,
  formatAnswer,
  latestIn,
  OTHER,
  readAsk,
  tally,
  type Ask,
} from "./asks";

const CSS = `*{box-sizing:border-box}
[hidden]{display:none!important}
:host{--ac:var(--pipeup-ask-accent,var(--pu-accent,#534AB7));--cf:var(--pipeup-ask-font,var(--pu-font,system-ui,sans-serif))}
.box{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:10px 0;padding:8px 12px;border-radius:var(--pipeup-ask-radius,8px);background:color-mix(in srgb,var(--ac) 7%,var(--pu-surface,#fff));font:13.5px/1.4 var(--cf);animation:in .26s var(--pu-ease)}
.inl{margin:6px 0 0}
.q{display:flex;align-items:center;gap:8px;margin:0;min-width:0;font:600 var(--inl-size,15px)/1.35 var(--pipeup-ask-font,var(--inl-font,var(--cf)));color:var(--pu-text)}
.q svg{flex:none;width:18px;height:18px;color:var(--ac)}
.ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:1 1 auto;min-width:0}
.ctl.open{flex-basis:240px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.words{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
button{appearance:none;font:inherit;color:inherit;min-height:28px;padding:2px 12px;border:1px solid color-mix(in srgb,var(--ac) 28%,var(--pu-line));border-radius:var(--pipeup-ask-radius,999px);background:var(--pu-surface,#fff);cursor:pointer;transition:background-color .2s var(--pu-ease),border-color .2s var(--pu-ease),color .2s var(--pu-ease),opacity .2s var(--pu-ease)}
button:hover{background:var(--pu-hover)}
button[aria-pressed=true],button.go{background:var(--ac);border-color:var(--ac);color:#fff}
button:disabled{opacity:.45;cursor:default}
button.link{min-height:0;padding:2px 0;border:0;border-radius:0;background:none;color:var(--ac)}
button.link:hover{text-decoration:underline;text-underline-offset:3px}
button:focus-visible,.fld:focus-within{outline:2px solid var(--ac);outline-offset:2px}
.fld{flex:1 1 220px;display:flex;align-items:center;gap:8px;min-width:0;padding:3px 3px 3px 10px;border:1px solid color-mix(in srgb,var(--ac) 22%,var(--pu-line));border-radius:var(--pipeup-ask-radius,6px);background:var(--pu-surface,#fff);box-shadow:inset 0 1px 2px rgb(0 0 0/.05);transition:border-color .2s var(--pu-ease)}
.fld:hover,.fld:focus-within{border-color:var(--ac)}
textarea{flex:1;display:block;min-width:0;height:24px;max-height:120px;margin:0;padding:3px 0;border:0;outline:0;background:none;color:inherit;font:inherit;line-height:18px;resize:none;overflow-y:hidden}
.fld button.go{flex:none;align-self:flex-end;min-height:24px;padding:0 10px;border-radius:var(--pipeup-ask-radius,4px);font-weight:600}
.mine{margin:0;color:var(--pu-muted)}
.mine b{color:var(--pu-text);font-weight:600}
.more{flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px 10px;padding-left:26px;color:var(--pu-muted);font-size:13px}
.inl .more{padding-left:0}
.note,.err{margin:0;color:var(--pu-muted)}
.err{flex-basis:100%;color:#B3261E}
.list{flex-basis:100%}
.list:empty{display:none}
.th{margin:6px 0 0;padding:8px 0 0;border-top:1px solid var(--pu-line);animation:in .26s var(--pu-ease)}
.c{margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere}
.c b{font-weight:600}
.c i{color:var(--pu-muted);font-style:normal}
.re{margin-left:16px}
.th .fld{margin-top:4px}
@keyframes in{from{opacity:0;transform:translateY(3px)}}
@media (pointer:coarse){button,.fld button.go{min-height:44px}button.link{min-height:44px}.fld{min-height:44px}}
@media (prefers-reduced-motion:reduce){.box,.th{animation:none}button,.fld{transition:none}}`;

/** A small element with text only: comment words never become markup. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

const SVG = "http://www.w3.org/2000/svg";
/** Pipeup's comment mark, before every question: whatever the page's look, an ask reads as something to answer. */
function mark(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const bubble = "M4 3.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z";
  for (const [d, attrs] of [
    [bubble, { fill: "currentColor", opacity: ".16" }],
    [bubble, { fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linejoin": "round" }],
    ["M6.5 9h7", { stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }],
  ] as const) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    for (const [k, v] of Object.entries(attrs)) path.setAttribute(k, v);
    svg.append(path);
  }
  return svg;
}

/** A field for words: one line to start, growing with what is written (up to five lines, then it scrolls). */
function field(label: string, ...after: HTMLElement[]): { fld: HTMLElement; area: HTMLTextAreaElement } {
  const area = el("textarea", { "aria-label": label, placeholder: label, rows: "1" });
  const grow = () => {
    area.style.height = "auto";
    const h = Math.min(area.scrollHeight, 120);
    area.style.height = `${Math.max(h, 24)}px`;
    area.style.overflowY = area.scrollHeight > 120 ? "auto" : "hidden";
  };
  area.addEventListener("input", grow);
  return { fld: el("div", { class: "fld" }, area, ...after), area };
}

const countReplies = (c: Comment): number =>
  c.replies.reduce((n, r) => n + (r.deleted ? 0 : 1) + countReplies(r), 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (c: Comment): string =>
  c.name ||
  (globalThis as { Pipeup?: { animalName?(k: string): string } }).Pipeup?.animalName?.(c.author) ||
  "Someone";
/** The agents the page lists: their threads on an ask are comments, never answers. */
const agents = (): string[] => (pageSetting("data-pipeup-agents") ?? "").split(/[\s,]+/).filter(Boolean);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where one marked element draws: an ask, or a block that shows its comments in place. */
interface Spot {
  el: Element;
  ask: Ask | null;
  render(): void;
  focus(): void;
}

export function createAddon(): PipeupAddon {
  return {
    id: "inline",
    api: 1,
    version: "0.9.0",
    needs: ["place", "post", "menu", "panel", "styles"],
    network: {
      when: "never",
      to: [],
      says: "Sends nothing: answers to asks are ordinary comments, kept and sent the way the page's other comments are.",
    },
    setup(host) {
      let shown = true;
      const spots: Spot[] = [];
      for (const at of host.root.querySelectorAll("[data-pipeup-ask],[data-pipeup-inline]")) {
        if (at.closest("[data-pipeup-placed]")) continue;
        const ask = at.hasAttribute("data-pipeup-ask") ? readAsk(at) : null;
        if (typeof ask === "string" || (!ask && !at.getAttribute("data-pipeup-id"))) {
          console.warn(
            `pipeup: ${typeof ask === "string" ? ask : `<${at.localName} data-pipeup-inline> needs a data-pipeup-id`}; the inline add-on leaves it as it is`,
          );
          continue;
        }
        spots.push(spot(host, at, ask, () => shown));
      }
      const needed = spots.filter((s) => s.ask?.needed);
      const offStyles = host.addStyles(
        ".inl-asks{display:flex;flex-direction:column;gap:6px;padding:12px}.inl-asks button{padding:10px 12px;border:1px solid var(--pu-line);border-radius:8px;text-align:left;transition:background-color .2s var(--pu-ease)}.inl-asks button:hover{background:var(--pu-hover)}",
      );
      const unanswered = () =>
        needed.filter((s) => !tally(s.ask!, host.document.threads(), host.document.me, agents()).mine);
      const row = needed.length
        ? host.addMenuItem({
            id: "asks",
            icon: ["M4 5h16v11H9l-5 4z", "M9.5 9a2.5 2.5 0 1 1 2.5 2.5V13", "M12 15.5v.01"],
            label: () => `${needed.length - unanswered().length} of ${plural(needed.length, "ask")} answered`,
            hint: () => "The asks the author needs answered, and where each one is",
            select: () => {
              const left = unanswered();
              const list = el("div", { class: "inl-asks" });
              if (!left.length) list.append(el("p", {}, "Every ask is answered. Thank you."));
              for (const s of left) {
                const go = el("button", { type: "button" }, s.ask!.question);
                go.addEventListener("click", () => {
                  panel.close();
                  s.el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
                  s.focus();
                });
                list.append(go);
              }
              const panel = host.openPanel(list, { label: "Asks to answer" });
            },
          })
        : null;
      const render = () => {
        for (const s of spots) s.render();
        row?.update();
      };
      const offChange = host.document.onChange(render);
      const offUi = host.onUi((ui) => {
        if (ui.shown === shown) return;
        shown = ui.shown;
        render();
      });
      render();
      return () => {
        offChange();
        offUi();
        row?.remove();
        offStyles();
      };
    },
  };
}

/** Draws one marked element: an ask's question and its buttons or box, the reviewer's answer, counts and threads. */
function spot(host: AddonHost, at: Element, ask: Ask | null, shown: () => boolean): Spot {
  const root = host.place(at);
  const Sheet = at.ownerDocument.defaultView?.CSSStyleSheet;
  if (Sheet && "adoptedStyleSheets" in root) {
    const sheet = new Sheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else root.append(el("style", {}, CSS));
  const me = host.document.me;
  // The question takes the page's own type; the author can still choose another with --pipeup-ask-font.
  const type = getComputedStyle(at);
  (root.host as HTMLElement).style.setProperty("--inl-font", type.fontFamily);
  (root.host as HTMLElement).style.setProperty("--inl-size", type.fontSize);
  const box = el("div", ask ? { class: "box", role: "group", "aria-label": ask.question } : { class: "inl" });
  const controls = el("div", { class: "ctl" });
  const summary = el("span", { class: "note" });
  const toggle = el("button", { type: "button", class: "link", "aria-expanded": "false" });
  const more = el("div", { class: "more" }, summary, toggle);
  const list = el("div", { class: "list" });
  const err = el("p", { class: "err", role: "alert", hidden: "" });
  if (ask) box.append(el("p", { class: "q" }, mark(), el("span", {}, ask.question)), controls);
  box.append(more, list, err);
  root.append(box);

  let open = false;
  /** The reviewer is changing their answer (or has none yet). */
  let changing = false;
  /** What the controls were last drawn for, so words being written are never redrawn away. */
  let drawn = "";
  /** Replies being written, by thread: kept while the list redraws. */
  const replies = new Map<string, HTMLTextAreaElement>();

  const fail = (e: unknown) => {
    err.textContent = `Couldn't send: ${e instanceof Error ? e.message.replace(/^pipeup: /, "") : String(e)}`;
    err.hidden = false;
  };

  async function answer(choice: string, words: string): Promise<boolean> {
    const text = formatAnswer(ask!, { choice, words });
    const mine = tally(ask!, host.document.threads(), me, agents()).mine;
    err.hidden = true;
    try {
      if (mine) await host.post({ edit: mine.root.id, text });
      else await host.post({ anchor: at, text, excerpt: ASKED + ask!.question });
      host.announce(mine ? "Answer changed" : "Answer sent");
      changing = false;
      drawn = "";
      render();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  /** A field for words, with Send inside it (and, for an open ask being changed, Cancel); Enter sends, Shift+Enter starts a line. */
  function wordsBox(label: string, need: boolean, send: (words: string) => Promise<boolean>): HTMLElement[] {
    const go = el("button", { type: "button", class: "go" }, "Send");
    const { fld, area } = field(label, go);
    const ready = () => (go.disabled = need && !area.value.trim());
    const submit = async () => {
      if (go.disabled) return;
      go.disabled = true;
      if (await send(area.value)) {
        area.value = "";
        area.dispatchEvent(new Event("input"));
      }
      ready();
    };
    area.addEventListener("input", ready);
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void submit();
      }
    });
    go.addEventListener("click", () => void submit());
    ready();
    // Choices and agree have their Cancel in the button row: one Cancel, never two.
    if (ask!.kind === "open" && changing && tally(ask!, host.document.threads(), me, agents()).mine)
      return [fld, cancelButton()];
    return [fld];
  }

  function cancelButton(): HTMLButtonElement {
    const b = el("button", { type: "button" }, "Cancel");
    b.addEventListener("click", () => {
      changing = false;
      drawn = "";
      render();
      (controls.querySelector("button") as HTMLElement | null)?.focus();
    });
    return b;
  }

  /** The question's buttons or box, for an ask the reviewer is answering. */
  function drawAnswering(): void {
    const k = ask!;
    const words = el("div", { class: "words" });
    controls.className = k.kind === "open" ? "ctl open" : "ctl";
    if (k.kind === "open") {
      controls.replaceChildren(...wordsBox("Type your answer", true, (w) => answer("", w)));
      return;
    }
    const choices = [...k.options, ...(k.other ? [OTHER] : [])];
    const buttons = choices.map((c) => {
      const b = el("button", { type: "button", "aria-pressed": "false" }, c);
      b.addEventListener("click", () => {
        // An option the author named is the answer itself; Agree, Needs change and Other ask for words first.
        if (k.kind === "choice" && c !== OTHER) return void answer(c, "");
        for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
        const label =
          c === AGREE
            ? "Anything to add? (optional)"
            : c === CHANGE
              ? "What needs to change?"
              : "Type your answer";
        words.replaceChildren(...wordsBox(label, c !== AGREE, (w) => answer(c, w)));
        words.querySelector("textarea")!.focus();
      });
      return b;
    });
    const row = el("div", { class: "row" }, ...buttons);
    if (changing && tally(k, host.document.threads(), me, agents()).mine) row.append(cancelButton());
    controls.replaceChildren(row, words);
  }

  function drawAnswered(mine: Thread): void {
    const change = el("button", { type: "button", class: "link" }, "Change");
    change.addEventListener("click", () => {
      changing = true;
      drawn = "";
      render();
      (controls.querySelector("button, textarea") as HTMLElement | null)?.focus();
    });
    const remove = el("button", { type: "button", class: "link" }, "Remove");
    // The answer as it is now: replies may have come since it was drawn.
    remove.addEventListener("click", () =>
      confirmRemove(tally(ask!, host.document.threads(), me, agents()).mine ?? mine),
    );
    controls.className = "ctl";
    controls.replaceChildren(
      el("p", { class: "mine" }, "You said ", el("b", {}, mine.root.text.split("\n")[0]!)),
      change,
      remove,
    );
  }

  /** Asks once more before removing the reviewer's answer; a press as quick as a double-click's second is ignored. */
  function confirmRemove(mine: Thread): void {
    const n = countReplies(mine.root);
    const asked = performance.now();
    const quick = () => performance.now() - asked < 500;
    const yes = el("button", { type: "button", class: "go" }, "Remove");
    const keep = el("button", { type: "button" }, "Keep");
    const row = el(
      "div",
      { class: "row confirm", role: "group", "aria-label": "Remove your answer" },
      yes,
      keep,
    );
    const back = () => {
      drawn = "";
      render();
      (controls.querySelector("button") as HTMLElement | null)?.focus();
    };
    yes.addEventListener("click", () => {
      if (quick()) return;
      err.hidden = true;
      yes.disabled = keep.disabled = true;
      host.post({ remove: mine.root.id, text: "" }).then(
        () => {
          host.announce("Answer removed");
          changing = false;
          drawn = "";
          render();
          (controls.querySelector("button, textarea") as HTMLElement | null)?.focus();
        },
        (e: unknown) => {
          yes.disabled = keep.disabled = false;
          fail(e);
        },
      );
    });
    keep.addEventListener("click", () => {
      if (!quick()) back();
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        back();
      }
    });
    controls.className = "ctl";
    controls.replaceChildren(
      el(
        "p",
        { class: "mine" },
        n ? `Remove your answer and its ${plural(n, "reply", "replies")}?` : "Remove your answer?",
      ),
      row,
    );
    keep.focus();
  }

  function threadView(t: Thread): HTMLElement {
    const item = el("div", { class: "th", "data-thread": t.id });
    const line = (c: Comment, cls = "c") =>
      el(
        "p",
        { class: cls },
        el("b", {}, c.author === me ? "You" : nameOf(c)),
        c.edited ? el("i", {}, " (edited)") : "",
        ": ",
        c.deleted ? el("i", {}, "deleted") : c.text,
      );
    item.append(line(t.root));
    const was = ask ? askedAs(ask, t) : null;
    if (was) item.append(el("p", { class: "note" }, `Asked as: ${was}`));
    const walk = (c: Comment) => {
      item.append(line(c, "c re"));
      c.replies.forEach(walk);
    };
    t.root.replies.forEach(walk);
    let area = replies.get(t.id);
    if (!area) {
      area = field(`Reply to ${nameOf(t.root)}`).area;
      const a = area;
      a.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.isComposing || !a.value.trim()) return;
        e.preventDefault();
        err.hidden = true;
        host.post({ replyTo: t.root.id, text: a.value }).then(() => {
          a.value = "";
          host.announce("Reply sent");
        }, fail);
      });
      replies.set(t.id, area);
    }
    item.append(area.parentElement ?? area);
    return item;
  }

  function render(): void {
    const threads = host.document.threads();
    const t = ask ? tally(ask, threads, me, agents()) : null;
    const mine = t?.mine ?? null;
    if (ask) {
      const mode = mine && !changing ? `answered:${mine.root.text}:${mine.root.edited}` : "answering";
      if (mode !== drawn) {
        drawn = mode;
        if (mine && !changing) drawAnswered(mine);
        else drawAnswering();
      }
    }
    const on = (
      t?.threads ?? threads.filter((x) => x.anchor.id === at.getAttribute("data-pipeup-id"))
    ).filter((x) => !x.root.deleted); // A deleted first comment takes its thread, as in the panel.
    // Others' answers and the threads show only once the reviewer has answered, and only while comments are open.
    const see = shown() && (!ask || !!mine);
    const others = t ? t.answers.length - 1 : 0;
    summary.hidden = !see || !t || others < 1;
    summary.textContent = "";
    if (t && !summary.hidden) {
      const parts = [...t.counts].filter(([, n]) => n > 0).map(([c, n]) => `${c}: ${n}`);
      summary.textContent = `${plural(t.answers.length, "person", "people")} answered${parts.length ? `. ${parts.join(", ")}` : ""}.`;
    }
    // Your own answer alone, with no replies, has nothing more to open.
    const onlyMine = !!mine && on.length === 1 && on[0]!.id === mine.id && countReplies(mine.root) === 0;
    toggle.hidden = !see || !on.length || onlyMine;
    toggle.textContent = "";
    if (!toggle.hidden) {
      const latest = on.map(latestIn).sort((a, b) => b.at - a.at)[0]!;
      toggle.textContent = `${plural(on.length, "comment")} · latest from ${latest.author === me ? "you" : nameOf(latest)}`;
    }
    more.hidden = summary.hidden && toggle.hidden;
    const opened = open && !toggle.hidden;
    toggle.setAttribute("aria-expanded", String(opened));
    const focused = root.activeElement;
    list.replaceChildren(...(opened ? on.map(threadView) : []));
    if (focused instanceof HTMLTextAreaElement && list.contains(focused)) focused.focus();
  }

  toggle.addEventListener("click", () => {
    open = !open;
    render();
  });
  return {
    el: at,
    ask,
    render,
    focus: () =>
      (root.querySelector("button, textarea") as HTMLElement | null)?.focus({ preventScroll: true }),
  };
}
