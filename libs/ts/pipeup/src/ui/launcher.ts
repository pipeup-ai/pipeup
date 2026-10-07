import type { ExportItem } from "../export/format";
import { animalName } from "../model/animals";
import type { Thread } from "../model/types";
import { avatar, faceOf } from "./animals";
import { lost as lostIn } from "./column";
import type { Ctx, View } from "./context";
import { clip, h, inert } from "./dom";
import { popoverAnchor } from "./geometry";
import { SHORTCUT_ARIA, SHORTCUT_LABEL } from "./shortcut";
import { icon } from "./icons";
import { narrow, placePopover, POPOVER, room } from "./layout";
import { threadView, type ThreadView } from "./thread-view";

/** How long the pointer may be away from the open menu (and its button) before the menu closes. */
const AWAY_MS = 3000;

/**
 * The comment control: one round button in the corner (the comment icon, or the open count inside a comment
 * bubble) that opens a menu, Comment nearest it. All comments is a panel on the right that stays open while
 * choosing threads reveals them, so every counted thread can be reached.
 */
export function createLauncher(ctx: Ctx): View {
  // Two numbers in one place: a change cross-fades from one to the other.
  const nums = [h("span", { class: "n" }), h("span", { class: "n" })] as const;
  // Pipeup's mark: the comment bubble in a thin line; its plus a touch heavier so it holds at this size.
  const mark = icon("comment", 20, 1.4);
  mark.lastElementChild!.setAttribute("stroke-width", "1.6");
  const btn = h(
    "button",
    {
      class: "mode",
      type: "button",
      "aria-label": "Comment",
      "aria-keyshortcuts": SHORTCUT_ARIA,
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    },
    h("span", { class: "plus" }, mark),
    h("span", { class: "cnt" }, icon("bubble", 34, 1.4), ...nums),
  );
  const tip = h("span", { class: "ttip", "aria-hidden": "true" }, "Comment", h("small", {}, SHORTCUT_LABEL));
  const launch = h("div", { class: "launch" }, btn, tip);
  const menu = h("div", { class: "menu", role: "menu", "aria-label": "Comments" });
  const list = h("div", { class: "list", role: "menu", "aria-label": "All comments" });
  const total = h("span", { class: "pn" });
  const close = h("button", { class: "ib", type: "button", "aria-label": "Close" }, icon("close"));
  // Show resolved: a small switch in the panel's header that brings resolved threads back, muted.
  const showResolved = h(
    "button",
    { class: "hs", type: "button", role: "switch", "aria-checked": "false" },
    "Show resolved",
    h("span", { class: "sw", "aria-hidden": "true" }),
  );
  showResolved.addEventListener("click", (e) => {
    e.stopPropagation();
    ctx.menu.toggleResolved();
  });
  const all = h(
    "div",
    { class: "all", role: "dialog", "aria-label": "All comments" },
    h("div", { class: "hd" }, h("span", {}, "All comments"), total, showResolved, close),
    list,
  );
  /** A thread chosen from All comments that has no place on the page: it opens beside the panel. */
  const side = h("div", { class: "pop side", role: "dialog", "aria-label": "Comment thread" });
  // Closed, the menu and panels are out of the keyboard's reach.
  menu.inert = all.inert = side.inert = true;
  // The side popover joins the layer the first time it is needed.
  // The panel comes last: open, it covers the control (its own close button and Esc take its place).
  ctx.layer.append(menu, launch, all);
  let menuOpen = false;
  /** Ends editing your name in place (saving, or not), when it is being edited. */
  let endEdit: ((save: boolean) => void) | null = null;
  /** The pointer has been away from the menu and the button since this timer started; it closes the menu. */
  let away = 0;
  let latest: readonly Thread[] = [];
  let shown = 0;
  let sideView: { id: string; view: ThreadView } | null = null;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const setMenu = (on: boolean) => {
    menuOpen = ctx.state.menu = on;
    window.clearTimeout(away);
    away = 0;
    if (!on) endEdit?.(true);
    menu.classList.toggle("show", on);
    inert(menu, !on);
    btn.setAttribute("aria-expanded", String(on));
  };
  /** Opens or closes All comments; focus moves in on open, and back to the button when asked. */
  const setList = (on: boolean, back = false) => {
    if (ctx.state.listing === on) return;
    ctx.state.listing = on;
    ctx.render();
    if (on) (items(list)[0] ?? close).focus({ preventScroll: true });
    else if (back) btn.focus({ preventScroll: true });
  };

  const items = (p: HTMLElement = menu) => [...p.querySelectorAll<HTMLElement>(".mi")];
  const focused = () => (menu.getRootNode() as Document | ShadowRoot).activeElement;
  /** Closing from inside the menu (an item, Escape) gives focus back to the button. */
  const closeToControl = () => {
    setMenu(false);
    btn.focus({ preventScroll: true });
  };
  // Arrow keys, Home and End move between items, as in any menu.
  const nav = (e: KeyboardEvent) => {
    const l = items(e.currentTarget as HTMLElement);
    if (l.length === 0) return;
    const at = focused();
    const i = l.indexOf(at as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      l[(n + l.length) % l.length]?.focus({ preventScroll: true });
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i < 0 ? l.length - 1 : i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(l.length - 1);
  };
  menu.addEventListener("keydown", nav);
  list.addEventListener("keydown", nav);
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    setList(false, true);
  });

  const lost = (t: Thread) => lostIn(ctx, t);
  const open = () => latest.filter((t) => !t.resolved).length;

  /** Every thread, in page order; the ones whose content is gone last, under their own heading. */
  function buildAll(): void {
    const before = items(list).indexOf(focused() as HTMLElement);
    const shownItems = ctx.menu.all().filter((i) => !i.thread.resolved || ctx.state.showResolved);
    const row = (i: ExportItem) => {
      const t = i.thread;
      const av = avatar(t.root.author, t.root.name);
      av.classList.add("in");
      const b = h(
        "button",
        { class: t.resolved ? "mi done" : "mi", type: "button", role: "menuitem", "data-thread": t.id },
        av,
        h(
          "span",
          {},
          h("span", { class: "clamp" }, t.root.deleted ? "Deleted" : t.root.text),
          h("small", {}, lost(t) ? `“${clip(t.anchor.snapshot, 80)}”` : i.location.where),
        ),
      );
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        choose(t.id, b.getBoundingClientRect().top);
      });
      return b;
    };
    const gone = shownItems.filter((i) => lost(i.thread));
    const heading = "No longer on the page";
    total.textContent = String(open());
    showResolved.setAttribute("aria-checked", String(ctx.state.showResolved));
    list.replaceChildren(
      shownItems.length ? "" : h("div", { class: "sec", role: "presentation" }, "No open comments"),
      ...shownItems.filter((i) => !lost(i.thread)).map(row),
      gone.length
        ? h(
            "div",
            { role: "group", "aria-label": heading },
            h("div", { class: "sec", "aria-hidden": "true" }, heading),
            ...gone.map(row),
          )
        : "",
    );
    const now = items(list);
    if (before >= 0) now[Math.min(before, now.length - 1)]?.focus({ preventScroll: true });
  }

  /**
   * Goes to a thread: its content scrolls into view and the thread opens there, while the panel stays open.
   * A thread with nowhere to show (its content gone, hidden or of no size) opens beside the panel instead.
   */
  function choose(id: string, y: number): void {
    // On a narrow screen the panel steps aside; the chosen thread keeps the comments shown until it closes.
    if (narrow()) {
      ctx.state.reading = true;
      setList(false);
    }
    go(id, y);
  }

  function go(id: string, y: number): void {
    const t = latest.find((x) => x.id === id);
    const r = ctx.resolved.get(id);
    if (!t) return;
    const el = r && !lost(t) ? (r.element ?? r.range?.startContainer.parentElement ?? null) : null;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    if (
      el &&
      r &&
      popoverAnchor(t.anchor, r) &&
      el.checkVisibility?.({ visibilityProperty: true }) !== false
    ) {
      closeSide();
      ctx.open(id);
      return;
    }
    ctx.open(null);
    if (narrow()) {
      ctx.state.reading = true;
      ctx.render();
    }
    showSide(t, y);
  }

  /** Shows thread `t` beside the panel, level with the row chosen (at `y`); with no `y`, only updates it. */
  function showSide(t: Thread, y?: number): void {
    const o = { quote: t.anchor.quote?.exact ?? null, lost: lost(t) ? t.anchor.snapshot : null };
    if (sideView?.id === t.id) sideView.view.update(t, o);
    else {
      sideView = { id: t.id, view: threadView(t, ctx.actions, { variant: "popover", ...o }) };
      side.replaceChildren(sideView.view.element);
    }
    if (y === undefined) return;
    if (!side.isConnected) {
      ctx.layer.insertBefore(side, all);
      // Laid out once hidden, so it eases in.
      void side.offsetWidth;
    }
    const vp = room(ctx.state.listing);
    const { left, top } = placePopover(
      { x: vp.width, y, below: false },
      { width: POPOVER, height: side.offsetHeight },
      vp,
    );
    side.style.left = `${left}px`;
    side.style.top = `${top}px`;
    side.classList.add("show");
    side.inert = false;
    ctx.focusReply(t.id);
  }

  /** Closes the side thread; `done` when the reader closed it, so a thread read on a narrow screen lets go. */
  function closeSide(done = false): void {
    if (!sideView) return;
    sideView = null;
    side.classList.remove("show");
    inert(side, true);
    if (done && ctx.state.reading) {
      ctx.state.reading = false;
      ctx.render();
    }
  }

  /**
   * One menu row: an icon, one line of words, and whatever sits at its end. Its explanation is a tooltip that
   * eases in on hover and keyboard focus, and is the row's description for screen readers. A switch row shows
   * its state with a switch.
   */
  function row(lead: Node, label: string, run: () => void, sw = false, ...end: Node[]): HTMLButtonElement {
    const b = h(
      "button",
      // A switch row is a menu's own checkbox item (valid inside role="menu"), drawn as a switch.
      { class: "mi", type: "button", role: sw ? "menuitemcheckbox" : "menuitem" },
      lead,
      h("span", { class: "lb" }, label),
      ...end,
      sw && h("span", { class: "sw", "aria-hidden": "true" }),
      h("span", { class: "tt", "aria-hidden": "true" }),
    );
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });
    return b;
  }
  /** Sets a row's words, tooltip and (for a switch) state, touching only what changed so switches can ease. */
  const set = (b: HTMLElement, label: string, tip: string, on?: boolean) => {
    const lb = b.querySelector(".lb")!;
    if (lb.textContent !== label) lb.textContent = label;
    b.querySelector(".tt")!.textContent = tip;
    b.setAttribute("aria-description", tip);
    if (on !== undefined) b.setAttribute("aria-checked", String(on));
  };
  const sep = () => h("div", { class: "sep", role: "separator" });

  // Who you are: your avatar and name (your animal until you add one), then Add name or an edit mark.
  const face = h("span", { class: "ma" });
  const nameEnd = h("span", { class: "kc" });
  let faceKey = "";
  const idRow = row(face, "", editName, false, nameEnd);
  idRow.dataset.item = "name";
  const copyRow = row(icon("copy"), "Copy as Markdown", () => {
    closeToControl();
    void ctx.menu.copyAll("ai");
  });
  const textRow = row(icon("lines"), "Copy as Text", () => {
    closeToControl();
    void ctx.menu.copyAll("text");
  });
  const count = h("span", { class: "kc" });
  const allRow = row(
    icon("list"),
    "All comments",
    () => {
      setMenu(false);
      setList(true);
    },
    false,
    count,
  );
  // Nearest the button: comment mode, with its shortcut and a switch that shows it is on. The menu stays open
  // so the switch is seen to move.
  const startRow = row(
    icon("comment"),
    "Start commenting",
    () => ctx.setCommenting(!ctx.state.commenting),
    true,
    h("span", { class: "kc", "aria-hidden": "true" }, SHORTCUT_LABEL),
  );
  startRow.dataset.item = "comment";
  startRow.setAttribute("aria-keyshortcuts", SHORTCUT_ARIA);
  /** The menu rises above the button, so it is built top down: who you are first, Start commenting last. */
  const rows = [idRow, sep(), copyRow, textRow, allRow, sep(), startRow];

  /** Brings every row up to date in place. */
  function sync(): void {
    const n = open();
    const name = ctx.menu.name();
    const shown = name || animalName(ctx.doc.me);
    set(idRow, shown, name ? "The name on your comments" : "Add a name to show on your comments");
    idRow.setAttribute("aria-label", `${shown}, ${name ? "edit" : "add"} your name`);
    nameEnd.replaceChildren(name ? icon("edit", 13) : "Add name");
    if (faceOf(ctx.doc.me, name) !== faceKey) {
      faceKey = faceOf(ctx.doc.me, name);
      const av = avatar(ctx.doc.me, name);
      av.classList.add("in");
      face.replaceChildren(av);
    }
    set(copyRow, "Copy as Markdown", "Markdown, with where each thread is");
    set(textRow, "Copy as Text", "Just the words");
    set(allRow, "All comments", "Every thread, and where it is");
    count.textContent = n ? String(n) : "";
    set(
      startRow,
      "Start commenting",
      ctx.state.commenting
        ? "Turn off to hide the comments again"
        : "Shows the comments; choose any part of the page to comment on it",
      ctx.state.commenting,
    );
  }

  /** Brings the rows up to date and puts them in the menu. */
  function build(): void {
    sync();
    if (menu.firstChild !== idRow) menu.replaceChildren(...rows);
  }

  /**
   * Your name, edited in its own row: a field takes the row's place. Enter or leaving the field saves (an empty
   * one keeps the name), Escape cancels; either way the row comes back and the menu stays open.
   */
  function editName(): void {
    const input = h("input", { class: "input", type: "text", maxlength: "80", "aria-label": "Your name" });
    input.value = ctx.menu.name();
    const ed = h("div", { class: "ed" }, face.cloneNode(true), input);
    const end = (save: boolean, back = false) => {
      if (endEdit !== end) return;
      endEdit = null;
      const value = input.value.trim();
      if (save && value && value !== ctx.menu.name()) void ctx.menu.rename(value).then(sync);
      ed.replaceWith(idRow);
      if (back) idRow.focus({ preventScroll: true });
    };
    endEdit = end;
    input.addEventListener("keydown", (e) => {
      // The field's keys are its own: never the menu's arrows, nor Escape for the menu or the page.
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        end(e.key === "Enter", true);
      }
    });
    input.addEventListener("blur", () => end(true));
    idRow.replaceWith(ed);
    // At once, not on a timer: keys typed right after choosing your name belong to the field.
    input.focus({ preventScroll: true });
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenu(false);
      return;
    }
    build();
    setMenu(true);
    // Opened from the keyboard (no pointer, so detail is 0): focus moves to Start commenting, nearest the button.
    if (e.detail === 0) items().at(-1)?.focus({ preventScroll: true });
  });
  /** Where focus was when the pointer went down: a press on the page has already moved it by the click. */
  let wasInPanel = false;
  const onDown = () => {
    wasInPanel = all.contains(focused());
  };
  const onAnyClick = (e: Event) => {
    const path = e.composedPath();
    if (menuOpen && !path.includes(menu) && !path.includes(btn)) {
      setMenu(false);
      // In comment mode that click only closes the menu: it picks nothing and the page never hears it.
      if (ctx.state.commenting && !ctx.owns(e)) {
        ctx.claim(e);
        e.preventDefault();
        e.stopPropagation();
      }
    }
    // Only a click on the page itself closes the panel: Pipeup's own threads and bubbles leave it open.
    // Focus that was in the panel and went nowhere (empty page) comes back to the button; a page field keeps it.
    if (ctx.state.listing && !ctx.owns(e))
      setList(false, wasInPanel && (!document.activeElement || document.activeElement === document.body));
    if (!path.includes(side) && !path.includes(all)) closeSide(true);
  };
  /**
   * A pointer away from the menu and the button for 3 s closes the menu; coming back sooner keeps it open. Never
   * while your name is being edited, and not for touch, which has no hover (a tap outside closes it instead).
   */
  const onPointer = (e: PointerEvent) => {
    if (!menuOpen || e.pointerType === "touch" || (e.type === "pointerout" && e.relatedTarget)) return;
    const path = e.composedPath();
    if (e.type === "pointerover" && (path.includes(menu) || path.includes(btn))) {
      window.clearTimeout(away);
      away = 0;
    } else if (!away)
      away = window.setTimeout(() => {
        away = 0;
        if (!endEdit) setMenu(false);
      }, AWAY_MS);
  };
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("click", onAnyClick, true);
  // Over: the pointer arrived somewhere. Out with nowhere to go: it left the window.
  window.addEventListener("pointerover", onPointer, true);
  window.addEventListener("pointerout", onPointer, true);
  // Capture phase + stopPropagation: Escape closes the menu, then the panel, then the side thread, one at a
  // time, and never also an open thread. A reply line outside the panel keeps its own Escape.
  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || endEdit) return;
    const at = e.composedPath()[0];
    if (menuOpen) closeToControl();
    else if (ctx.state.listing && !(at instanceof HTMLTextAreaElement && !all.contains(at)))
      setList(false, true);
    else if (sideView) {
      closeSide(true);
      ctx.actions.close();
    } else return;
    e.stopPropagation();
  };
  window.addEventListener("keydown", onEscape, true);

  return {
    render(threads) {
      latest = threads;
      const n = open();
      if (n !== shown) {
        // At zero the bubble fades back to the comment icon, keeping its last number while it goes.
        if (n) {
          const [was, next] = nums[0].classList.contains("on") ? nums : [nums[1], nums[0]];
          next.textContent = n > 99 ? "99+" : String(n);
          next.classList.toggle("s", n > 99);
          was.classList.remove("on");
          next.classList.add("on");
        }
        btn.classList.toggle("has", n > 0);
        btn.setAttribute("aria-label", n ? `Comment, ${n} open` : "Comment");
        shown = n;
      }
      btn.classList.toggle("on", ctx.state.commenting);
      if (menuOpen) sync();
      const listing = ctx.state.listing;
      // On a narrow screen the panel is the whole width, so a chosen thread needs it out of the way.
      all.classList.toggle("full", narrow());
      if (all.classList.contains("show") !== listing) {
        all.classList.toggle("show", listing);
        inert(all, !listing);
      }
      if (listing) buildAll();
      if (sideView) {
        const t = threads.find((x) => x.id === sideView?.id);
        if (!t || ctx.state.active || (t.resolved && !ctx.state.showResolved)) closeSide();
        else showSide(t);
      }
    },
    frame() {},
    destroy() {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("click", onAnyClick, true);
      window.removeEventListener("pointerover", onPointer, true);
      window.removeEventListener("pointerout", onPointer, true);
      window.clearTimeout(away);
      window.removeEventListener("keydown", onEscape, true);
      menu.remove();
      all.remove();
      side.remove();
      launch.remove();
    },
  };
}
