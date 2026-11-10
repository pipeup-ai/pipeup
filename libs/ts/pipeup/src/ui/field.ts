/**
 * A host's own stand-in for Pipeup's text fields (the browser extension's frame, `mount({ field })`): what the reviewer
 * types there is typed in another document, so the page never hears it. Pipeup's field stays in the DOM, hidden, as
 * the model the rest of Pipeup reads and writes; the host keeps the two in step and passes the reviewer's keys in with
 * `pass`, as events that stay inside Pipeup's shadow root.
 */
export type Field = HTMLTextAreaElement | HTMLInputElement;

/** Given one of Pipeup's fields and a way to pass events into it, the element to show in its place (or null: keep it). */
export type FieldHost = (field: Field, pass: (event: Event) => void) => HTMLElement | null;

let host: FieldHost | null = null;
let root: ShadowRoot | null = null;
const standIns = new WeakMap<Element, Field>();
const passed = new WeakSet<Event>();

/** Set as Pipeup starts (null: the fields are Pipeup's own); `shadow` is where passed keys are heard. */
export function setFieldHost(h: FieldHost | null, shadow: ShadowRoot | null): void {
  host = h;
  root = shadow;
}

/** Offers a field Pipeup just made, already in its place, to the host, which may show its own in its place. */
export function offerField(field: Field): void {
  if (!host) return;
  const pass = (e: Event) => {
    passed.add(e);
    field.dispatchEvent(e);
  };
  const shown = host(field, pass);
  if (!shown) return;
  standIns.set(shown, field);
  field.before(shown);
}

/** The field behind what has focus: a field of Pipeup's, or the field a host's stand-in shows. */
export function fieldOf(a: Element | null | undefined): Field | null {
  if (a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement) return a;
  return (a && standIns.get(a)) ?? null;
}

/** As `fieldOf`, a comment or reply box only. */
export function boxOf(a: Element | null | undefined): HTMLTextAreaElement | null {
  const f = fieldOf(a);
  return f instanceof HTMLTextAreaElement ? f : null;
}

/**
 * Listens for keys on the window, as the page's own keys are heard, and also for the keys a host passes into a field
 * (they never reach the window, so the page doesn't hear them). Returns how to stop.
 */
export function onWindowKey(
  type: "keydown" | "keyup",
  fn: (e: KeyboardEvent) => void,
  capture: boolean,
): () => void {
  window.addEventListener(type, fn, capture);
  const at = root;
  const relay = (e: Event) => {
    if (passed.has(e)) fn(e as KeyboardEvent);
  };
  at?.addEventListener(type, relay, capture);
  return () => {
    window.removeEventListener(type, fn, capture);
    at?.removeEventListener(type, relay, capture);
  };
}
