import { nameOf } from "../model/animals";
import type { Comment } from "../model/types";
import { h } from "./dom";

/** The quick row: what a reviewer can react with at a tap. (The full set of emoji is the emoji add-on's.) */
export const QUICK = ["👍", "❤️", "😂", "🎉", "😮", "🙏"] as const;
const NAMES: Record<string, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "😂": "Laughing",
  "🎉": "Party popper",
  "😮": "Surprised",
  "🙏": "Thanks",
};

/** The full emoji picker, when an add-on provides one: Pipeup draws the popover, the add-on fills it. */
export interface ReactionPicker {
  /** Fills the popover; `pick` hears the chosen emoji. May return a function that tears the picker down. */
  fill(into: HTMLElement, pick: (emoji: string) => void): void | (() => void);
  /** The emoji's name, for screen readers. */
  name(emoji: string): string | undefined;
}

const PICKER = { width: 320, height: 340 };

/** Opens the picker in a popover beside `anchor`; it closes on a choice, Escape, a click elsewhere or when asked. */
export function openPicker(anchor: HTMLElement, picker: ReactionPicker, pick: (emoji: string) => void): void {
  const layer = anchor.closest<HTMLElement>(".layer");
  if (!layer) return;
  layer.querySelector(".rxp")?.remove();
  const box = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(box.left, window.innerWidth - PICKER.width - 8));
  const below = box.bottom + 6 + PICKER.height <= window.innerHeight - 8;
  const top = below ? box.bottom + 6 : Math.max(8, box.top - PICKER.height - 6);
  const pop = h("div", { class: "rxp", role: "dialog", "aria-label": "Choose a reaction" });
  pop.style.cssText = `left:${left}px;top:${top}px`;
  let closed = false;
  const picked: { off?: void | (() => void) } = {};
  const away = (e: Event) => {
    if (!e.composedPath().includes(pop)) close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("pointerdown", away, true);
    picked.off?.();
    pop.classList.remove("show");
    pop.inert = true;
    window.setTimeout(() => pop.remove(), 260);
    anchor.focus({ preventScroll: true });
  };
  pop.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    close();
  });
  picked.off = picker.fill(pop, (emoji) => {
    close();
    pick(emoji);
  });
  window.addEventListener("pointerdown", away, true);
  layer.append(pop);
  void pop.offsetWidth;
  pop.classList.add("show");
  pop.querySelector<HTMLElement>("input,button")?.focus({ preventScroll: true });
}

export interface ReactionOptions {
  /** The full picker, when an add-on has one: the quick row then ends with a button that opens it. */
  picker?: ReactionPicker | null;
  /** This reviewer's key, to mark their own reactions. */
  me: string;
  /** Reactions can't be added or taken back on a resolved thread; they still show. */
  resolved: boolean;
  /** The quick row is open under this comment. */
  quick: boolean;
  /** Only the quick row, never the chips (a closed card in All comments counts reactions in its last line). */
  bare?: boolean;
  /** Gives or takes back a reaction. */
  react(emoji: string, on: boolean): void;
  /** Chips and quick buttons already on the page once, so only new ones ease in. */
  seen: Set<string>;
}

/**
 * What people reacted to a comment with, quietly beneath its words: each emoji with how many gave it (yours marked;
 * pointing at one says who), and, when asked for, the quick row. Nothing for a comment nobody reacted to.
 */
export function reactionRow(c: Comment, o: ReactionOptions): HTMLElement | null {
  if (c.deleted || ((o.bare || !c.reactions.length) && !o.quick)) return null;
  const has = (emoji: string) =>
    c.reactions.find((r) => r.emoji === emoji)?.by.some((b) => b.author === o.me) ?? false;
  const chips = (o.bare ? [] : c.reactions).map((r) => {
    const mine = has(r.emoji);
    const n = r.by.length;
    const names = [...(mine ? ["You"] : []), ...r.by.filter((b) => b.author !== o.me).map((b) => nameOf(b))];
    const key = `${c.id}|${r.emoji}`;
    const b = h(
      "button",
      {
        class: `ref rx${mine ? " mine" : ""}${o.seen.has(key) ? "" : " new"}`,
        type: "button",
        "aria-pressed": String(mine),
        "aria-label": `${o.picker?.name(r.emoji) ?? NAMES[r.emoji] ?? "Reaction"}, ${n} ${n === 1 ? "person" : "people"}${mine ? ", including you" : ""}`,
        "data-k": `x${c.id}${r.emoji}`,
      },
      h("span", {}, r.emoji),
      h("span", { class: "n" }, String(n)),
      h("span", { class: "rc" }, names.join(", ")),
    );
    o.seen.add(key);
    b.disabled = o.resolved;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      o.react(r.emoji, !mine);
    });
    return b;
  });
  const quick =
    o.quick && !o.resolved
      ? h(
          "div",
          {
            class: `rxq${o.seen.has(`${c.id}|quick`) ? "" : " new"}`,
            role: "group",
            "aria-label": "React",
            "data-q": c.id,
          },
          ...QUICK.map((emoji) => {
            const b = h(
              "button",
              {
                class: "rxo",
                type: "button",
                "aria-label": NAMES[emoji],
                "aria-pressed": String(has(emoji)),
                "data-k": `q${c.id}${emoji}`,
              },
              emoji,
            );
            b.addEventListener("click", (e) => {
              e.stopPropagation();
              o.react(emoji, !has(emoji));
            });
            return b;
          }),
          o.picker ? moreButton(o.picker, (emoji) => o.react(emoji, !has(emoji))) : null,
        )
      : null;
  if (quick) o.seen.add(`${c.id}|quick`);
  else o.seen.delete(`${c.id}|quick`);
  return h("div", { class: "refs rxs" }, ...chips, quick);
}

/** The last button of the quick row when an add-on brings the full set of emoji. */
function moreButton(picker: ReactionPicker, pick: (emoji: string) => void): HTMLButtonElement {
  const b = h(
    "button",
    { class: "rxo", type: "button", "aria-label": "More reactions", "aria-haspopup": "dialog" },
    "…",
  );
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    openPicker(b, picker, pick);
  });
  return b;
}
