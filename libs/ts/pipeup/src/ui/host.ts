import { PANEL, POPOVER } from "./layout";
import { STYLES } from "./styles";
import { applyTheme, type Theme } from "./theme";

export interface Host {
  element: HTMLElement;
  shadow: ShadowRoot;
  layer: HTMLElement;
  destroy(): void;
}

/**
 * Pipeup's only element in the page: a fixed, click-through <pipeup-root> under <html> with an open shadow
 * root (open so tools like `pipeup check` can measure it). It never changes the page's layout.
 */
export function createHost(theme: Theme, doc: Document = document): Host {
  const element = doc.createElement("pipeup-root");
  element.setAttribute("data-pipeup-ignore", "");
  element.style.cssText =
    "position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483000!important;display:block!important;margin:0!important;visibility:visible!important;opacity:1!important;transform:none!important;filter:none!important;";
  const shadow = element.attachShadow({ mode: "open" });
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && "replaceSync" in Sheet.prototype && "adoptedStyleSheets" in shadow) {
    const sheet = new Sheet();
    sheet.replaceSync(STYLES);
    shadow.adoptedStyleSheets = [sheet];
  } else {
    const style = doc.createElement("style");
    style.textContent = STYLES;
    shadow.append(style);
  }
  const layer = doc.createElement("div");
  layer.className = "layer";
  // Sizes the code also places things by, so the stylesheet and the code can never disagree.
  layer.style.setProperty("--pu-panel", `${PANEL}px`);
  layer.style.setProperty("--pu-pop", `${POPOVER}px`);
  applyTheme(layer, theme);
  shadow.append(layer);
  doc.documentElement.append(element);
  return { element, shadow, layer, destroy: () => element.remove() };
}
