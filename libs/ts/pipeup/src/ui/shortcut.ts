import { icon } from "./icons";

/** The comment-mode shortcut: change the key, or its labels, here and nowhere else. */
export const SHORTCUT = {
  /** The physical key (`KeyboardEvent.code`): Option changes the typed character on a Mac. */
  code: "KeyC",
} as const;

const MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);
/** The key's label: symbols on Apple platforms, words elsewhere. */
export const SHORTCUT_LABEL: string = MAC ? "⇧⌥C" : "Shift+Alt+C";
/**
 * The key held to pause comment mode (`KeyboardEvent.key`), and its label: Space, the one key that changes nothing about
 * a click (Command, Ctrl, Shift and Option all make a click on a link do something else).
 */
export const HOLD = " ";
export const HOLD_LABEL = "Space";
export const SHORTCUT_ARIA = "Shift+Alt+C";

/**
 * The shortcut as shown: on Apple platforms the Shift and Option keys as Pipeup's own glyphs (the fonts browsers fall
 * back to draw ⇧ and ⌥ each their own way) and the letter; elsewhere the words. Decorative: callers set the ARIA.
 */
export function shortcutKeys(letter = "C"): HTMLElement {
  const keys = document.createElement("span");
  keys.className = "keys";
  if (MAC) keys.append(icon("shift", 13, 1.9), icon("option", 13, 1.9), letter);
  else keys.textContent = `Shift+Alt+${letter}`;
  return keys;
}

/**
 * Shift+Option+C (Shift+Alt+C): never a key repeat, Command or Ctrl, or AltGr (which types characters).
 * Callers must not claim it inside text fields: on a Mac it types a character there.
 */
export function isShortcut(e: KeyboardEvent): boolean {
  return (
    e.code === SHORTCUT.code &&
    e.shiftKey &&
    e.altKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.repeat &&
    !e.getModifierState("AltGraph")
  );
}
