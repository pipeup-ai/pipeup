/**
 * The page's settings (`data-pipeup-*`), wherever the page could put them: given when it started Pipeup, on a line
 * that loads Pipeup or an add-on, or on `<html>`, in that order. Hosts that write their own `<html>` (claude.ai
 * Artifacts) leave only the script line.
 */
const given = new Map<string, string>();

/** What the page gave when it started Pipeup; null forgets them (unmount). */
export function setGiven(values: Record<string, string | undefined> | null): void {
  given.clear();
  for (const [k, v] of Object.entries(values ?? {})) if (v !== undefined) given.set(k, v);
}

/** A setting's value (`name` is the full attribute, `data-pipeup-…`), or null when the page doesn't set it. */
export function setting(name: string): string | null {
  if (given.has(name)) return given.get(name)!;
  if (typeof document === "undefined") return null;
  // The first loading line that carries it; any `<script>` will do, as `<html>` would.
  const line = document.querySelector(`script[${name}]`);
  return line?.getAttribute(name) ?? document.documentElement.getAttribute(name);
}

/** The page sets it at all (an attribute with no value counts). */
export const hasSetting = (name: string): boolean => setting(name) !== null;
