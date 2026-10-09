import { viewName } from "../anchor/locate";
import type { ExportItem } from "../export/format";
import { animalName } from "../model/animals";
import type { Thread } from "../model/types";
import { avatar, faceOf } from "./animals";
import { lost as lostIn } from "./column";
import type { Ctx, View } from "./context";
import { clip, h, inert } from "./dom";
import { popoverAnchor, quoteRects } from "./geometry";
import { SHORTCUT_ARIA, SHORTCUT_LABEL } from "./shortcut";
import type { MenuItem } from "./addons";
import { draw, icon } from "./icons";
import { narrow, PANEL } from "./layout";
import { threadView, type ThreadView } from "./thread-view";

/** How long the pointer may be away from the open menu (and its button) before the menu closes. */
const AWAY_MS = 3000;
/** Where threads on content the page hides are listed, with no view of their own to name. */
const HIDDEN = "Hidden on the page";

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
    // Open threads on other slides or views: a small dot.
    h("span", { class: "dot" }),
  );
  const tipWords = document.createTextNode("Comment");
  const tip = h("span", { class: "ttip", "aria-hidden": "true" }, tipWords, h("small", {}, SHORTCUT_LABEL));
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
  // The line from an open thread in the panel to its place on the page.
  const wire = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wire.setAttribute("class", "cx");
  wire.setAttribute("aria-hidden", "true");
  const wirePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const wireDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  wireDot.setAttribute("r", "4");
  wire.append(wirePath, wireDot);
  // Closed, the menu and panels are out of the keyboard's reach.
  menu.inert = all.inert = true;
  // The panel comes last: open, it covers the control (its own close button and Esc take its place).
  ctx.layer.append(menu, launch, wire, all);
  let menuOpen = false;
  /** Ends editing your name in place (saving, or not), when it is being edited. */
  let endEdit: ((save: boolean) => void) | null = null;
  /** The pointer has been away from the menu and the button since this timer started; it closes the menu. */
  let away = 0;
  let latest: readonly Thread[] = [];
  let shown = 0;
  /** The thread open in the panel, if any: its row opens out into the thread itself. */
  let openId: string | null = null;
  let railView: ThreadView | null = null;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const setMenu = (on: boolean) => {
    menuOpen = ctx.state.menu = on;
    if (on) ctx.addons.flush();
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
  /** Open threads: here (the control's number), elsewhere (its dot), and all of them (All comments). */
  const tally = (where?: boolean) =>
    latest.filter((t) => !t.resolved && (where === undefined || ctx.elsewhere(t) === where)).length;
  const open = () => tally(false);
  const others = () => tally(true);
  const allOpen = () => tally();

  /** Where a thread that can't be shown lives: "On slide 3", "In Pricing tab", or hidden on the page. */
  const placeOf = (t: Thread) => {
    const s = t.anchor.view?.slide;
    const name = ctx.here.holds(t.anchor.view) ? "" : viewName(t.anchor.view);
    return s && ctx.here.slide() !== null ? `On slide ${s}` : name ? `In ${name}` : HIDDEN;
  };

  /** A titled group of rows; `mark` ("This slide") follows the title. */
  const group = (title: string, rows: Node[], mark = "") =>
    h(
      "div",
      { role: "group", "aria-label": mark ? `${title} · ${mark}` : title },
      h("div", { class: "sec", "aria-hidden": "true" }, title, mark && h("b", {}, mark)),
      ...rows,
    );

  /**
   * On a deck, threads by slide in deck order ("Slide 3 · 2 open"), this slide's group marked; threads with no
   * slide join this slide's. On other pages, the threads here first, then each other view's under its name.
   */
  function groups(items: ExportItem[], row: (i: ExportItem) => HTMLElement): Node[] {
    const now = ctx.here.slide();
    const by = new Map<string | null, ExportItem[]>();
    for (const i of items) {
      const t = i.thread;
      const k =
        now !== null
          ? (t.anchor.view?.slide ?? now)
          : ctx.elsewhere(t)
            ? ctx.here.holds(t.anchor.view)
              ? ""
              : viewName(t.anchor.view)
            : null;
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    if (now === null) {
      const mine = by.get(null) ?? [];
      by.delete(null);
      return [...mine.map(row), ...[...by].map(([k, l]) => group(k || HIDDEN, l.map(row)))];
    }
    return [...by]
      .sort(([a], [b]) => Number(a) - Number(b) || 0)
      .map(([k, l]) =>
        group(
          `Slide ${k} · ${l.filter((i) => !i.thread.resolved).length} open`,
          l.map(row),
          k === now ? "This slide" : "",
        ),
      );
  }

  /** Every thread, in page order; the ones whose content is gone last, under their own heading. */
  function buildAll(): void {
    const at = focused() as HTMLElement | null;
    const before = at?.dataset.thread;
    const inReply = railView !== null && railView.element.contains(at);
    const shownItems = ctx.menu
      .all()
      .filter((i) => !i.thread.resolved || ctx.state.showResolved || i.thread.id === openId);
    const row = (i: ExportItem) => {
      const t = i.thread;
      const open = t.id === openId;
      const av = avatar(t.root.author, t.root.name);
      av.classList.add("in");
      const b = h(
        "button",
        {
          class: `mi${t.resolved ? " done" : ""}${open ? " open" : ""}`,
          type: "button",
          role: "menuitem",
          "aria-expanded": String(open),
          "data-thread": t.id,
        },
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
        toggle(t.id);
      });
      const f = document.createDocumentFragment();
      f.append(b);
      if (open && railView) {
        railView.update(t, threadOptions(t));
        f.append(h("div", { class: "xr", role: "region", "aria-label": "Comment thread" }, railView.element));
      }
      return f as unknown as HTMLElement;
    };
    const gone = shownItems.filter((i) => lost(i.thread));
    total.textContent = String(allOpen());
    showResolved.setAttribute("aria-checked", String(ctx.state.showResolved));
    list.replaceChildren(
      shownItems.length ? "" : h("div", { class: "sec", role: "presentation" }, "No open comments"),
      ...groups(
        shownItems.filter((i) => !lost(i.thread)),
        row,
      ),
      gone.length ? group("No longer on the page", gone.map(row)) : "",
    );
    if (inReply) railView!.element.querySelector("textarea")?.focus({ preventScroll: true });
    else if (before)
      items(list)
        .find((b) => b.dataset.thread === before)
        ?.focus({ preventScroll: true });
  }

  /** What a thread shows about where it is (its quote, or where its content has gone). */
  function threadOptions(t: Thread) {
    const away = !lost(t) && ctx.elsewhere(t);
    return {
      variant: "popover" as const,
      quote: t.anchor.quote?.exact ?? null,
      lost: lost(t) || away ? t.anchor.snapshot : null,
      place: away ? placeOf(t) : null,
    };
  }

  /** Opens a thread out in the panel (or closes it): the page scrolls to its place, and a line joins the two. */
  let going = "";
  function toggle(id: string): void {
    if (openId === id) return closeRow(true);
    const t = latest.find((x) => x.id === id);
    if (!t) return;
    openId = going = id;
    railView = threadView(t, { ...ctx.actions, close: () => closeRow(true) }, threadOptions(t));
    buildAll();
    railView.element.querySelector("textarea")?.focus({ preventScroll: true });
    if (!ctx.elsewhere(t)) return reveal(t);
    // Like opening, going somewhere else leaves a draft with words where it is: the thread shows here, with its place.
    if (ctx.state.draft && !ctx.draftEmpty()) return;
    // On another slide or view: go there first, then show it (unless the row was closed or changed meanwhile).
    void ctx.here.navigate(t.anchor.view ?? {}).then(() => {
      ctx.recheck();
      const now = latest.find((x) => x.id === id);
      if (now && going === id && openId === id) reveal(now);
    });
  }

  function closeRow(back = false): void {
    if (!openId) return;
    const id = openId;
    openId = railView = null;
    ctx.hot(null);
    buildAll();
    if (back)
      items(list)
        .find((b) => b.dataset.thread === id)
        ?.focus({ preventScroll: true });
  }

  /** Scrolls a thread's place into view and marks it (it pulses once, and stays marked while the row is open). */
  function reveal(t: Thread): void {
    const r = ctx.resolved.get(t.id);
    const el = r && !lost(t) ? (r.element ?? r.range?.startContainer.parentElement ?? null) : null;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    if (el) ctx.hot(t.id);
  }

  /**
   * Where on the page the open thread's place is, if it can be pointed at, and which way the line arrives: at the
   * far right of the marked words' row (from the panel, on the right), or at the top middle of a block or picture.
   */
  function target(t: Thread): { x: number; y: number; from: "right" | "top" } | null {
    const r = ctx.resolved.get(t.id);
    const el = r?.element ?? r?.range?.startContainer.parentElement;
    if (
      !r ||
      narrow() ||
      lost(t) ||
      ctx.elsewhere(t) ||
      el?.checkVisibility?.({ visibilityProperty: true }) === false
    )
      return null;
    const words = r.range ? quoteRects(r).at(-1) : undefined;
    // The line meets the marked row at the far right of its block, so it never crosses the text.
    const edge = el?.closest("p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,figcaption,div")?.getBoundingClientRect().right;
    const box = r.element?.getBoundingClientRect();
    const pin = popoverAnchor(t.anchor, r);
    const p = words
      ? { x: Math.max(words.right, edge ?? 0) + 4, y: (words.top + words.bottom) / 2, from: "right" as const }
      : box
        ? { x: box.left + box.width / 2, y: box.top, from: "top" as const }
        : pin && { x: pin.x, y: pin.y, from: "right" as const };
    const inView = p && p.x >= 0 && p.x <= window.innerWidth - PANEL && p.y >= 0 && p.y <= window.innerHeight;
    return inView ? p : null;
  }

  /** Draws the line from the open thread's header to its place, or lets it fade when there is none to point at. */
  function drawWire(): void {
    const t = openId ? latest.find((x) => x.id === openId) : null;
    const head = openId ? list.querySelector<HTMLElement>(`.mi.open`) : null;
    const to = t && target(t);
    const box = head?.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    if (!to || !box || box.top + 12 < view.top || box.top + 12 > view.bottom) {
      wire.classList.remove("show");
      return;
    }
    const x = box.left;
    const y = box.top + 14;
    let d: string;
    if (to.from === "right" && x - to.x > 60) {
      // Down the right-hand margin, close to the page, then a tight turn in to the words.
      const gx = to.x + 28;
      const dir = to.y >= y ? 1 : -1;
      const r = Math.min(24, Math.abs(to.y - y) / 2);
      d = `M${x} ${y}C${x - 24} ${y} ${gx} ${y} ${gx} ${y + dir * r}L${gx} ${to.y - dir * r}C${gx} ${to.y} ${gx} ${to.y} ${to.x} ${to.y}`;
    } else {
      // Down the margin beside the panel, along the gap above the block, then a tight turn down onto it.
      const lane = to.y - 8;
      const gx = x - 40;
      const dir = lane >= y ? 1 : -1;
      const r = Math.min(20, Math.abs(lane - y) / 2);
      d = `M${x} ${y}C${x - 20} ${y} ${gx} ${y} ${gx} ${y + dir * r}L${gx} ${lane - dir * r}C${gx} ${lane} ${gx} ${lane} ${gx - r} ${lane}L${to.x + 8} ${lane}C${to.x} ${lane} ${to.x} ${lane} ${to.x} ${to.y}`;
    }
    wirePath.setAttribute("d", d);
    wireDot.setAttribute("cx", String(to.x));
    wireDot.setAttribute("cy", String(to.y));
    wire.classList.add("show");
  }

  /**
   * One menu row: an icon, one line of words, and whatever sits at its end. Its explanation is a tooltip that
   * eases in on hover and keyboard focus, and is the row's description for screen readers. A switch row shows
   * its state with a switch.
   */
  function row(lead: Node, run: (e: MouseEvent) => void, sw = false, ...end: Node[]): HTMLButtonElement {
    const b = h(
      "button",
      // A switch row is a menu's own checkbox item (valid inside role="menu"), drawn as a switch.
      { class: "mi", type: "button", role: sw ? "menuitemcheckbox" : "menuitem" },
      lead,
      h("span", { class: "lb" }),
      ...end,
      sw && h("span", { class: "sw", "aria-hidden": "true" }),
      h("span", { class: "tt", "aria-hidden": "true" }),
    );
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      run(e);
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
  const idRow = row(face, editName, false, nameEnd);
  idRow.dataset.item = "name";
  const copyRow = row(icon("copy"), () => {
    closeToControl();
    void ctx.menu.copyAll("ai");
  });
  const textRow = row(icon("lines"), () => {
    closeToControl();
    void ctx.menu.copyAll("text");
  });
  const count = h("span", { class: "kc" });
  const allRow = row(
    icon("list"),
    () => {
      setMenu(false);
      setList(true);
    },
    false,
    count,
  );
  // Nearest the button: comment mode, with its shortcut and a switch that shows it is on. The menu stays open
  // so the switch is seen to move, except that turning it on from the keyboard (no pointer, so detail is 0)
  // closes the menu as the switch moves and puts the block cursor on the page: the cursor takes focus first,
  // so closing the menu never takes it back.
  const startRow = row(
    icon("comment"),
    (e) => {
      const keys = !ctx.state.commenting && e.detail === 0;
      ctx.setCommenting(!ctx.state.commenting, keys);
      if (keys) setMenu(false);
    },
    true,
    h("span", { class: "kc", "aria-hidden": "true" }, SHORTCUT_LABEL),
  );
  startRow.dataset.item = "comment";
  startRow.setAttribute("aria-keyshortcuts", SHORTCUT_ARIA);
  /** Add-ons' status, one quiet line at the top of the menu. */
  const statusRow = h("div", { class: "sec", role: "presentation" });
  const sepA = sep();
  const sepB = sep();
  /** Rows add-ons added, kept by item so a rebuilt menu reuses them. */
  const extra = new Map<MenuItem, HTMLButtonElement>();
  const extraRow = (item: MenuItem) => {
    let b = extra.get(item);
    if (!b) {
      b = row(
        draw(item.icon, 15),
        () => {
          // An action closes the menu; a switch stays, so it is seen to move.
          if (!item.checked) closeToControl();
          void Promise.resolve()
            .then(() => item.select())
            .catch((e: unknown) => ctx.report(e))
            .finally(() => menuOpen && sync());
        },
        Boolean(item.checked),
        h("span", { class: "kc" }),
      );
      extra.set(item, b);
    }
    return b;
  };
  /** The menu rises above the button, so it is built top down: who you are first, Start commenting last. */
  const rows = (): Node[] => [
    idRow,
    sepA,
    copyRow,
    textRow,
    allRow,
    ...ctx.addons.menuRows.map(extraRow),
    sepB,
    startRow,
  ];
  let built = -1;
  /** An add-on's own getters can fail; its row then shows nothing rather than breaking the menu. */
  const word = (fn: () => string): string => {
    try {
      return fn();
    } catch (e) {
      globalThis.reportError?.(e);
      return "";
    }
  };

  /** Brings every row up to date in place. */
  function sync(): void {
    const n = allOpen();
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
    const status = ctx.addons.statusText();
    statusRow.textContent = status;
    if (!status) statusRow.remove();
    else if (!statusRow.isConnected && menu.contains(idRow)) menu.prepend(statusRow);
    for (const item of ctx.addons.menuRows) {
      const b = extra.get(item);
      if (!b) continue;
      let on: boolean | undefined;
      try {
        on = item.checked?.();
      } catch (e) {
        globalThis.reportError?.(e);
      }
      set(b, word(item.label), word(item.hint), on);
      (b.querySelector(".kc") as HTMLElement).textContent = item.count ? word(item.count) : "";
    }
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
    if (built !== ctx.addons.rev || !menu.contains(idRow)) {
      menu.replaceChildren(...rows());
      built = ctx.addons.rev;
      sync();
    }
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
  /** The control's label and tooltip: its counts, then what add-ons say ("Live with 2 others"). */
  let words = { n: 0, label: "" };
  const paintLabel = () => {
    const { n, label } = words;
    const status = ctx.addons.statusText();
    const aria = `Comment${ctx.state.commenting ? ", comment mode on" : ""}${label ? `, ${label}` : n ? `, ${n} open` : ""}${status ? `, ${status}` : ""}`;
    if (btn.getAttribute("aria-label") !== aria) btn.setAttribute("aria-label", aria);
    const tipText = (label || "Comment") + (status ? ` · ${status}` : "");
    if (tipWords.data !== tipText) tipWords.data = tipText;
  };
  // An add-on adding or removing a row rebuilds the menu while it is open (never while a name is being edited).
  const offAddons = ctx.addons.subscribe((structure) => {
    paintLabel();
    if (!menuOpen || endEdit) return;
    if (structure) build();
    else sync();
  });
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("click", onAnyClick, true);
  // Over: the pointer arrived somewhere. Out with nowhere to go: it left the window.
  window.addEventListener("pointerover", onPointer, true);
  window.addEventListener("pointerout", onPointer, true);
  // Capture phase + stopPropagation: Escape closes the menu, then the thread open in the panel, then the panel,
  // one at a time, and never also an open thread on the page. A reply line outside the panel keeps its own Escape.
  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || endEdit) return;
    const at = e.composedPath()[0];
    if (menuOpen) closeToControl();
    else if (ctx.state.listing && !(at instanceof HTMLTextAreaElement && !all.contains(at))) {
      if (openId) closeRow(true);
      else setList(false, true);
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
        shown = n;
      }
      const m = others();
      const label = m
        ? `${n} here · ${m} ${ctx.here.slide() !== null ? "on other slides" : "in other views"}`
        : "";
      btn.classList.toggle("else", m > 0);
      words = { n, label };
      paintLabel();
      btn.classList.toggle("on", ctx.state.commenting);
      // Closed from elsewhere (Tab in comment mode moves to the page's blocks).
      if (menuOpen && !ctx.state.menu) setMenu(false);
      if (menuOpen) sync();
      const listing = ctx.state.listing;
      // On a narrow screen the panel is the whole width, so a chosen thread needs it out of the way.
      all.classList.toggle("full", narrow());
      if (all.classList.contains("show") !== listing) {
        all.classList.toggle("show", listing);
        inert(all, !listing);
      }
      // The thread open in the panel goes with the panel, or when it is gone.
      if (openId && (!listing || !threads.some((x) => x.id === openId))) {
        openId = railView = null;
        ctx.state.hot = null;
      }
      if (listing) buildAll();
    },
    frame: drawWire,
    destroy() {
      offAddons();
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("click", onAnyClick, true);
      window.removeEventListener("pointerover", onPointer, true);
      window.removeEventListener("pointerout", onPointer, true);
      window.clearTimeout(away);
      window.removeEventListener("keydown", onEscape, true);
      menu.remove();
      all.remove();
      wire.remove();
      launch.remove();
    },
  };
}
