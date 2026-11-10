import { PANEL, popover } from "./layout";
import { applyTheme, type Theme } from "./theme";

export interface Host {
  element: HTMLElement;
  shadow: ShadowRoot;
  layer: HTMLElement;
  destroy(): void;
}

/**
 * Pipeup's only element in the page: a fixed, click-through <pipeup-root> under <html> with an open shadow
 * root (open so tools like `pipeup check` can measure it). It never changes the page's layout. It has the highest
 * z-index there is and comes after <body>, so a page's own bar at that z-index (a consent banner, say) still sits under
 * it: of two equals, the later one is drawn on top.
 */
export function createHost(theme: Theme, styles: string, doc: Document = document): Host {
  const element = doc.createElement("pipeup-root");
  element.setAttribute("data-pipeup-ignore", "");
  element.style.cssText =
    "position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;display:block!important;margin:0!important;visibility:visible!important;opacity:1!important;transform:none!important;translate:none!important;scale:none!important;rotate:none!important;filter:none!important;clip-path:none!important;mask:none!important;zoom:1!important;";
  const shadow = element.attachShadow({ mode: "open" });
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && "replaceSync" in Sheet.prototype && "adoptedStyleSheets" in shadow) {
    const sheet = new Sheet();
    sheet.replaceSync(styles);
    shadow.adoptedStyleSheets = [sheet];
  } else {
    const style = doc.createElement("style");
    style.textContent = styles;
    shadow.append(style);
  }
  const layer = doc.createElement("div");
  layer.className = "layer";
  // Sizes the code also places things by, so the stylesheet and the code can never disagree.
  layer.style.setProperty("--pu-panel", `${PANEL}px`);
  layer.style.setProperty("--pu-pop", `${popover()}px`);
  applyTheme(layer, theme);
  shadow.append(layer);
  // Safari doesn't focus a button that is pressed, as every other browser does and Pipeup's menus, cards and keys count
  // on: once the press has had its say, a button that never had the focus since (and that nothing else took focus
  // from) gets it.
  shadow.addEventListener("mousedown", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("button:not(:disabled),[tabindex]");
    if (!b || e.defaultPrevented) return;
    const before = shadow.activeElement;
    let had = false;
    const took = () => (had = true);
    b.addEventListener("focus", took, { once: true });
    setTimeout(() => {
      b.removeEventListener("focus", took);
      const a = shadow.activeElement;
      if (!had && b.isConnected && a !== b && (!a || a === before)) b.focus({ preventScroll: true });
    });
  });
  doc.documentElement.append(element);
  return { element, shadow, layer, destroy: () => element.remove() };
}
