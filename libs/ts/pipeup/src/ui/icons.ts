const NS = "http://www.w3.org/2000/svg";
const PATHS = {
  comment: ["M20.5 11.5a8 8 0 0 1-11.7 7.1L4 19.8l1.2-4.4A8 8 0 1 1 20.5 11.5z", "M12.3 8.2v6.6M9 11.5h6.6"],
  // The same mark as the website's Copy prompt button: two overlapping rounded squares.
  copy: [
    "M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
    "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2",
  ],
  resolve: ["M5 12.5l4.5 4.5L19 7.5"],
  reopen: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  lines: ["M4 7h16M4 12h10M4 17h7"],
  // A list of threads, each with its writer: All comments.
  list: [
    "M3 6.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M3 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M3 17.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M9 6.5h11M9 12h11M9 17.5h7",
  ],
  expand: ["M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6"],
  // A pin as the page shows one: round, its point at the bottom left; as tall as the arrows beside it.
  pin: ["M4 20v-8a8 8 0 1 1 8 8z"],
  // For you: an @ drawn as small as the resolve tick, so the two filters' icons stand the same height.
  at: [
    "M9.1 12a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0-5.8 0",
    "M14.9 12v1.1a1.8 1.8 0 0 0 3.6 0V12a6.5 6.5 0 1 0-3.97 5.98",
  ],
  // A row that opens to more rows beneath it.
  chev: ["M9 6l6 6-6 6"],
  // The same four arrows pointing in: a block inside it.
  shrink: ["M14 5v5h5M20 4l-6 6M10 19v-5H5M4 20l6-6"],
  // The comment bubble without its plus, to hold the open count.
  bubble: ["M20.5 11.5a8 8 0 0 1-11.7 7.1L4 19.8l1.2-4.4A8 8 0 1 1 20.5 11.5z"],
  close: ["M6 6l12 12M18 6L6 18"],
  // A pencil: edit your name.
  smile: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M8.5 14a4.5 4.5 0 0 0 7 0", "M9 9.6h.01M15 9.6h.01"],
  edit: ["M4 20h4L19 9l-4-4L4 16z"],
  // An eye, struck through: Hide comments.
  hide: [
    "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z",
    "M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z",
    "M4 4l16 16",
  ],
  more: ["M5.5 12h.01M12 12h.01M18.5 12h.01"],
  look: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M12 3v18"],
} as const;

export type IconName = keyof typeof PATHS;

/** Outline icons drawn from constant path data; `stroke` thins or thickens the line (in 24-unit terms). */
export function icon(name: IconName, size = 15, stroke?: number): SVGSVGElement {
  const svg = draw(PATHS[name], size);
  if (stroke) svg.setAttribute("stroke-width", String(stroke));
  return svg;
}

/** An outline drawing from constant path data (never from text people wrote). */
export function draw(paths: readonly string[], size: number): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  const attrs: Record<string, string> = {
    width: String(size),
    height: String(size),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const d of paths) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
