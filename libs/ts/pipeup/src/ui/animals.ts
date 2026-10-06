import { ANIMALS, animalName, animalOf, colourOf, type Animal } from "../model/animals";
import { h } from "./dom";
import { draw } from "./icons";

/**
 * Each animal's line drawing: 24×24, stroked like the other icons, drawn for Pipeup (no icon library, no
 * emoji). Keyed by name, so every animal in ANIMALS must have one.
 */
/** A circle as two arcs, from its leftmost point (x, y) with radius r. */
const o = (x: number, y: number, r: number) =>
  `M${x} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0`;

export const ANIMAL_ICONS: Record<Animal, string> = {
  Otter:
    "M4 13.2C4 9.2 7.6 6.5 12 6.5s8 2.7 8 6.7-3.6 6.3-8 6.3-8-2.3-8-6.3zM5.6 9.6a1.8 1.8 0 1 1 2.7-2.3M18.4 9.6a1.8 1.8 0 1 0-2.7-2.3M9.2 11.6h.01M14.8 11.6h.01M11 14h2l-1 1zM9.8 15.8l-3.2.4M9.9 17l-2.7 1.1M14.2 15.8l3.2.4M14.1 17l2.7 1.1",
  Fox: "M3.5 4l5 3.5h7l5-3.5-1.5 8.5L12 20l-7-7.5zM9 12h.01M15 12h.01M12 17h.01",
  Owl: `M5 4.5l3 2.5h8l3-2.5V14a7 7 0 0 1-14 0z${o(7.4, 11.5, 1.9)}${o(12.8, 11.5, 1.9)}M11.3 14.6l.7 1 .7-1`,
  Bear: `${o(5, 13.5, 7)}M8.9 7.22A2.8 2.8 0 1 0 5.89 10.09M18.11 10.09A2.8 2.8 0 1 0 15.1 7.22M9.4 12.6h.01M14.6 12.6h.01M10.3 16.4c0-1 .8-1.6 1.7-1.6s1.7.6 1.7 1.6-.8 1.6-1.7 1.6-1.7-.6-1.7-1.6z`,
  Rabbit: `${o(6.5, 15.5, 5.5)}M9.6 10.5C8.2 6.5 8.4 2.5 9.8 2.5s2.4 3.5 1.6 7.5M14.4 10.5c1.4-4 1.2-8-.2-8s-2.4 3.5-1.6 7.5M10 15h.01M14 15h.01M11.3 17.3l.7.5.7-.5`,
};

/**
 * The first letter or digit of a name, as a capital, always one character and the same in every locale
 * ("ß" stays "ß"); "" when it has none (it might be all symbols or emoji).
 */
export function initial(name: string): string {
  const m = /[\p{L}\p{N}]/u.exec(name);
  if (!m) return "";
  const up = m[0].toUpperCase();
  return [...up].length === 1 ? up : m[0];
}

/** What an avatar shows: the same key means the same picture. */
export const faceOf = (author: string, name: string): string => initial(name) || animalName(author);

/**
 * A squircle avatar: the writer's animal drawn in its colour on a tint of it, or their initial in the same colours once they have a
 * name. Decorative: the name is always written beside it, so screen readers skip it.
 */
export function avatar(author: string, name: string): HTMLElement {
  return h(
    "span",
    { class: `av c${colourOf(author)}`, "aria-hidden": "true", "data-animal": animalName(author) },
    initial(name) || draw([ANIMAL_ICONS[ANIMALS[animalOf(author)]!]], 24),
  );
}

/** How long a replaced avatar stays beneath its successor: until the successor has eased in (0.26 s). */
const RETIRE_MS = 320;

/** Removes an avatar that a new one is easing in over, once it is covered; never leaves its spot empty. */
export function retire(el: HTMLElement, done?: () => void): void {
  setTimeout(() => {
    el.remove();
    done?.();
  }, RETIRE_MS);
}

/** Eases a new avatar in once it is on the page (it starts faded and slightly small; .in brings it to rest). */
export function easeIn(el: HTMLElement): HTMLElement {
  requestAnimationFrame(() => {
    void el.offsetWidth;
    el.classList.add("in");
  });
  return el;
}
