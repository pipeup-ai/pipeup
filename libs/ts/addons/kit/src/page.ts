/**
 * A page setting (`data-pipeup-…`): from the first line that loads Pipeup or an add-on and carries it, else from
 * `<html>`. Hosts that write their own `<html>` (claude.ai Artifacts) leave only the loading line. `from`, when
 * given, is read alone (tests, and callers that already hold the element).
 */
export function pageSetting(name: string, from?: Element): string | null {
  if (from) return from.getAttribute(name);
  if (typeof document === "undefined") return null;
  return (
    document.querySelector(`script[${name}]`)?.getAttribute(name) ??
    document.documentElement.getAttribute(name)
  );
}
