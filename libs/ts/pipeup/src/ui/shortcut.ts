/** The comment-mode shortcut: change the key, or its labels, here and nowhere else. */
export const SHORTCUT = {
  /** The physical key (`KeyboardEvent.code`): Option changes the typed character on a Mac. */
  code: "KeyC",
} as const;

/** The key's label: symbols on Apple platforms, words elsewhere. */
export const SHORTCUT_LABEL: string =
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform) ? "⇧⌥C" : "Shift+Alt+C";
export const SHORTCUT_ARIA = "Shift+Alt+C";

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
