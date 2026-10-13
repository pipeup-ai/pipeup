import { EMOJI, GROUPS } from "./data";

export interface Entry {
  emoji: string;
  name: string;
  words: string;
  /** A skin tone applies (a hand, a person). */
  tone: boolean;
  group: number;
}

/** Every emoji, in the order phones show them. */
export const ALL: readonly Entry[] = EMOJI.flatMap((list, group) =>
  list.map(([emoji, name, words, tone]) => ({ emoji, name, words, tone: tone === 1, group })),
);

export const GROUP_NAMES = GROUPS;
/** Light to dark: the five skin-tone modifiers, then none. */
export const TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"] as const;
const TONE_NAMES = [
  "",
  "light skin tone",
  "medium-light skin tone",
  "medium skin tone",
  "medium-dark skin tone",
  "dark skin tone",
];
const MODIFIER = /[\u{1F3FB}-\u{1F3FF}]/u;
const byEmoji = new Map(ALL.map((e) => [e.emoji, e]));

/** The emoji with a skin tone (0 for none): the modifier goes right after the pictograph. */
export function withTone(e: Entry, tone: number): string {
  if (!e.tone || tone <= 0) return e.emoji;
  const [first] = [...e.emoji];
  return `${first}${TONES[tone]}`;
}

/** What an emoji is called, for screen readers: its name, and its skin tone when it has one. */
export function nameOf(emoji: string): string | undefined {
  const tone = emoji.match(MODIFIER)?.[0];
  const base = tone ? emoji.replace(MODIFIER, "") : emoji;
  const found = byEmoji.get(base) ?? byEmoji.get(`${base}️`) ?? byEmoji.get(base.replace(/️/g, ""));
  if (!found) return undefined;
  const t = tone ? TONES.indexOf(tone as (typeof TONES)[number]) : 0;
  return t > 0 ? `${found.name}, ${TONE_NAMES[t]}` : found.name;
}

/** The emoji whose name or search words contain every word typed. */
export function search(query: string, list: readonly Entry[] = ALL): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list.filter((e) => {
    const hay = `${e.name} ${e.words}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

let measure: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
const widthOf = (s: string): number => {
  let w = widths.get(s);
  if (w === undefined) {
    w = measure!.measureText(s).width;
    widths.set(s, w);
  }
  return w;
};
/**
 * Whether this device draws the emoji as one picture. A sequence it doesn't know is drawn as its parts side by side,
 * which makes it much wider than one emoji. With no canvas to measure with, everything is offered.
 */
export function drawn(emoji: string): boolean {
  if (![...emoji].some((c) => c === "‍" || MODIFIER.test(c))) return true;
  if (measure === undefined) {
    try {
      measure = document.createElement("canvas").getContext("2d");
      if (measure) measure.font = "32px system-ui, sans-serif";
    } catch {
      measure = null;
    }
  }
  if (!measure) return true;
  return widthOf(emoji) <= widthOf("\u{1F600}") * 1.4;
}
