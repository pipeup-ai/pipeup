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

export interface ReactionOptions {
  /** This reviewer's key, to mark their own reactions. */
  me: string;
  /** Reactions can't be added or taken back on a resolved thread; they still show. */
  resolved: boolean;
  /** The quick row is open under this comment. */
  quick: boolean;
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
  if (c.deleted || (!c.reactions.length && !o.quick)) return null;
  const has = (emoji: string) =>
    c.reactions.find((r) => r.emoji === emoji)?.by.some((b) => b.author === o.me) ?? false;
  const chips = c.reactions.map((r) => {
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
        "aria-label": `${NAMES[r.emoji] ?? "Reaction"}, ${n} ${n === 1 ? "person" : "people"}${mine ? ", including you" : ""}`,
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
          { class: `rxq${o.seen.has(`${c.id}|quick`) ? "" : " new"}`, role: "group", "aria-label": "React" },
          ...QUICK.map((emoji) => {
            const b = h(
              "button",
              {
                class: "rxo",
                type: "button",
                "aria-label": NAMES[emoji],
                "aria-pressed": String(has(emoji)),
              },
              emoji,
            );
            b.addEventListener("click", (e) => {
              e.stopPropagation();
              o.react(emoji, !has(emoji));
            });
            return b;
          }),
        )
      : null;
  if (quick) o.seen.add(`${c.id}|quick`);
  else o.seen.delete(`${c.id}|quick`);
  return h("div", { class: "refs rxs" }, ...chips, quick);
}
