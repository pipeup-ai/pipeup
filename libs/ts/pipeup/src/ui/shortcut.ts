/** The comment-mode shortcut: change the key, or its labels, here and nowhere else. */
export const SHORTCUT = {
  /** The physical key (`KeyboardEvent.code`): Option changes the typed character on a Mac. */
  code: "KeyC",
  /** The modifiers that must be down, and only those (Shift, Alt/Option, Command, Ctrl). */
  mods: { shift: true, alt: true, meta: false, ctrl: false },
  mac: { label: "\u21e7\u2325C", aria: "Shift+Alt+C" },
  other: { label: "Shift+Alt+C", aria: "Shift+Alt+C" },
} as const;

/** Decided once. */
const APPLE = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);
export const SHORTCUT_LABEL: string = (APPLE ? SHORTCUT.mac : SHORTCUT.other).label;
export const SHORTCUT_ARIA: string = (APPLE ? SHORTCUT.mac : SHORTCUT.other).aria;

/**
 * Shift+Option+C (Shift+Alt+C): never a key repeat, Command or Ctrl, or AltGr (which types characters).
 * Callers must not claim it inside text fields: on a Mac it types a character there.
 */
export function isShortcut(e: KeyboardEvent): boolean {
  return (
    e.code === SHORTCUT.code &&
    e.shiftKey === SHORTCUT.mods.shift &&
    e.altKey === SHORTCUT.mods.alt &&
    e.metaKey === SHORTCUT.mods.meta &&
    e.ctrlKey === SHORTCUT.mods.ctrl &&
    !e.repeat &&
    !e.getModifierState("AltGraph")
  );
}
