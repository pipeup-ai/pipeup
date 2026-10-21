/**
 * A page setting (`data-pipeup-…`): the core reads it wherever the page put it (given when it started Pipeup, a
 * line that loads Pipeup or an add-on, or `<html>`); a core too old to know settings reads `<html>`. `from`, when
 * given, is read alone (tests, and callers that already hold the element).
 */
export const pageSetting = (name: string, from?: Element): string | null =>
  from
    ? from.getAttribute(name)
    : ((globalThis as { Pipeup?: { setting?(n: string): string | null } }).Pipeup?.setting?.(name) ??
      globalThis.document?.documentElement.getAttribute(name) ??
      null);
