import type { AddonHost, Comment, PipeupAddon, Thread } from "pipeup";
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
.box{margin:14px 0 4px;padding:14px 16px;border:1px solid var(--pu-line);border-radius:12px;background:var(--pu-surface);animation:in .26s var(--pu-ease)}
.inl{margin:6px 0 0}
.q{margin:0 0 10px;font-weight:600;font-size:15px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{appearance:none;font:inherit;color:inherit;min-height:36px;padding:6px 14px;border:1px solid var(--pu-line);border-radius:999px;background:var(--pu-soft);cursor:pointer;transition:background-color .2s var(--pu-ease),border-color .2s var(--pu-ease),color .2s var(--pu-ease)}
button:hover{background:var(--pu-hover)}
button[aria-pressed=true],button.go{background:var(--pu-accent,#534AB7);border-color:var(--pu-accent,#534AB7);color:#fff}
button:disabled{opacity:.5;cursor:default}
button.link{min-height:0;padding:2px 0;border:0;background:none;color:var(--pu-muted);text-decoration:underline;text-underline-offset:3px}
button:focus-visible,textarea:focus-visible{outline:2px solid var(--pu-accent,#534AB7);outline-offset:2px}
textarea{display:block;width:100%;min-height:64px;margin:10px 0 8px;padding:8px 10px;border:1px solid var(--pu-line);border-radius:8px;background:var(--pu-soft);color:inherit;font:inherit;resize:vertical}
.mine{margin:0 0 6px}
.note,.err{margin:6px 0 0;color:var(--pu-muted)}
.err{color:#B3261E}
.th{margin:10px 0 0;padding:10px 0 0;border-top:1px solid var(--pu-line);animation:in .26s var(--pu-ease)}
.c{margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere}
.c b{font-weight:600}
.c i{color:var(--pu-muted);font-style:normal}
.re{margin-left:16px}
.th textarea{min-height:40px;margin-top:4px}
@keyframes in{from{opacity:0;transform:translateY(3px)}}
@media (pointer:coarse){button{min-height:44px}button.link{min-height:44px}}
@media (prefers-reduced-motion:reduce){.box,.th{animation:none}button{transition:none}}`;

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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (c: Comment): string =>
  c.name ||
  (globalThis as { Pipeup?: { animalName?(k: string): string } }).Pipeup?.animalName?.(c.author) ||
  "Someone";
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
    version: "0.8.2",
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
        needed.filter((s) => !tally(s.ask!, host.document.threads(), host.document.me).mine);
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
  const box = el("div", ask ? { class: "box", role: "group", "aria-label": ask.question } : { class: "inl" });
  const controls = el("div");
  const summary = el("p", { class: "note" });
  const toggle = el("button", { type: "button", class: "link", "aria-expanded": "false" });
  const list = el("div");
  const err = el("p", { class: "err", role: "alert", hidden: "" });
  if (ask) box.append(el("p", { class: "q" }, ask.question), controls, summary);
  box.append(toggle, list, err);
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
    const mine = tally(ask!, host.document.threads(), me).mine;
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

  /** A box for words, with Send (and Cancel while changing an answer); Enter sends, Shift+Enter starts a line. */
  function wordsBox(label: string, need: boolean, send: (words: string) => Promise<boolean>): HTMLElement {
    const area = el("textarea", { "aria-label": label, placeholder: label });
    const go = el("button", { type: "button", class: "go" }, "Send");
    const ready = () => (go.disabled = need && !area.value.trim());
    const submit = async () => {
      if (go.disabled) return;
      go.disabled = true;
      if (await send(area.value)) area.value = "";
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
    const row = el("div", { class: "row" }, go);
    if (changing && tally(ask!, host.document.threads(), me).mine) row.append(cancelButton());
    return el("div", {}, area, row);
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
    const words = el("div");
    if (k.kind === "open") {
      controls.replaceChildren(wordsBox("Your answer", true, (w) => answer("", w)));
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
              : "Your answer";
        words.replaceChildren(wordsBox(label, c !== AGREE, (w) => answer(c, w)));
        words.querySelector("textarea")!.focus();
      });
      return b;
    });
    const row = el("div", { class: "row" }, ...buttons);
    if (k.kind === "choice" && changing && tally(k, host.document.threads(), me).mine)
      row.append(cancelButton());
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
    controls.replaceChildren(
      el("p", { class: "mine" }, "Your answer: ", el("b", {}, mine.root.text.split("\n")[0]!)),
      el("div", { class: "row" }, change),
    );
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
      area = el("textarea", { "aria-label": `Reply to ${nameOf(t.root)}`, placeholder: "Reply" });
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
    item.append(area);
    return item;
  }

  function render(): void {
    const threads = host.document.threads();
    const t = ask ? tally(ask, threads, me) : null;
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
    ).filter((x) => !x.root.deleted || x.root.replies.length);
    // Others' answers and the threads show only once the reviewer has answered, and only while comments are open.
    const see = shown() && (!ask || !!mine);
    const others = t ? t.answers.length - 1 : 0;
    summary.hidden = !see || !t || others < 1;
    summary.textContent = "";
    if (t && !summary.hidden) {
      const parts = [...t.counts].filter(([, n]) => n > 0).map(([c, n]) => `${c}: ${n}`);
      summary.textContent = `${plural(t.answers.length, "person", "people")} answered${parts.length ? `. ${parts.join(", ")}` : ""}.`;
    }
    toggle.hidden = !see || !on.length;
    toggle.textContent = "";
    if (!toggle.hidden) {
      const latest = on.map(latestIn).sort((a, b) => b.at - a.at)[0]!;
      toggle.textContent = `${plural(on.length, "comment")} · latest from ${latest.author === me ? "you" : nameOf(latest)}`;
    }
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
