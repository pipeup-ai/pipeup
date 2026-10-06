import { describeRange } from "../anchor/describe";
import type { Ctx, View } from "./context";
import { clip, h } from "./dom";
import { icon } from "./icons";
import { placeBar } from "./layout";

const NOT_HERE = "[data-pipeup-ignore],input,textarea,select,[contenteditable]:not([contenteditable=false])";

/** In comment mode, selecting text offers commenting: one comment icon, centred above the selection, never over it. */
export function createSelection(ctx: Ctx): View {
  const button = h(
    "button",
    { type: "button", "aria-label": "Comment", title: "Comment" },
    icon("comment", 17),
  );
  const bar = h("div", { class: "selbar" }, button);
  // Hidden, it is out of the Tab order and the accessibility tree.
  bar.inert = true;
  ctx.layer.append(bar);
  let range: Range | null = null;

  const allowed = (node: Node | null) => {
    const el = node && (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);
    return !!el && ctx.root.contains(el) && !el.closest(NOT_HERE);
  };

  function position(): void {
    if (!range) return;
    const r = range.getBoundingClientRect();
    const { left, top } = placeBar(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: bar.offsetWidth || 36, height: bar.offsetHeight || 34 },
      { width: window.innerWidth, height: window.innerHeight },
    );
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  function hide(): void {
    range = null;
    bar.inert = true;
    bar.classList.remove("show");
  }

  function check(): void {
    const sel = window.getSelection();
    if (
      !ctx.state.commenting ||
      !sel ||
      sel.isCollapsed ||
      sel.rangeCount === 0 ||
      !sel.toString().trim() ||
      !allowed(sel.anchorNode) ||
      !allowed(sel.focusNode)
    ) {
      hide();
      return;
    }
    range = sel.getRangeAt(0).cloneRange();
    position();
    bar.inert = false;
    bar.classList.add("show");
  }

  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const r = range;
    if (!r) return;
    let anchor;
    try {
      anchor = describeRange(r, ctx.root);
    } catch (err) {
      ctx.report(err);
      hide();
      return;
    }
    const words = clip(r.toString().replace(/\s+/g, " ").trim(), 60);
    window.getSelection()?.removeAllRanges();
    hide();
    ctx.startDraft({
      anchor,
      label: `“${words}”`,
      ranges: [r],
      resolved: { state: "attached", element: null, range: r },
    });
  });

  // The icon goes as soon as the selection does: a click elsewhere, Escape, or the page clearing it.
  const onSelectionChange = () => {
    if (!range) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) hide();
  };
  document.addEventListener("selectionchange", onSelectionChange);

  const onUp = (e: Event) => {
    if (ctx.owns(e)) return;
    window.setTimeout(check, 0);
  };
  window.addEventListener("mouseup", onUp, true);
  window.addEventListener("keyup", onUp, true);

  return {
    render() {
      if (!ctx.state.commenting && range) hide();
    },
    frame() {
      if (range) position();
    },
    destroy() {
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("keyup", onUp, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      bar.remove();
    },
  };
}
