/** Copies on the user's action; falls back to a hidden field inside Pipeup's own layer. */
export async function copyText(text: string, container: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older browsers or blocked permission: fall back below.
  }
  // Selecting the hidden copy moves focus; it goes back where it was.
  const was = (container.getRootNode() as ShadowRoot).activeElement ?? document.activeElement;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  container.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (was instanceof HTMLElement) was.focus({ preventScroll: true });
  if (!ok) throw new Error("pipeup: your browser blocked copying");
}
