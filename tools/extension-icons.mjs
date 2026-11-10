// The extension's icons, drawn from Pipeup's own comment glyph (the outlined bubble, `comment` in
// libs/ts/pipeup/src/ui/icons.ts) with four samples a pixel each way, so the build needs no image tools.
//
// Everywhere it's the bubble alone, no plus and no background:
// - listed(n): in Pipeup's violet, where the extension is listed (the browser's extensions page, the stores, Safari's
//   settings, the toolbar panel's header). A violet that reads on light and dark pages alike.
// - toolbar(n, rgb): filling the toolbar button, in one grey each: dark for light toolbars, light for dark ones; Safari
//   takes the black one as a template and tints it itself.
import { deflateSync } from "node:zlib";

/** The toolbar glyph's colours: Chrome's own icon greys, for light and dark toolbars, and black for Safari's template. */
export const INK = {
  light: [0x47, 0x47, 0x47],
  dark: [0xe3, 0xe3, 0xe3],
  template: [0, 0, 0],
};
/** Pipeup's accent, a little lighter, so the bubble reads on a dark extensions page as well as a light one. */
const VIOLET = [0x6a, 0x60, 0xd6];

// The bubble, in its 24-unit box: a circle with a gap where the tail leaves it, and the tail.
const [CX, CY, R] = [12.5, 11.5, 8];
const GAP = [Math.atan2(18.6 - CY, 8.8 - CX), Math.atan2(15.4 - CY, 5.2 - CX)];
const TAIL = [
  [8.8, 18.6, 4, 19.8],
  [4, 19.8, 5.2, 15.4],
];

function toSegment(x, y, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Whether a point of the 24-unit box is on the bubble's strokes, `half` units either side of each line. */
function onGlyph(x, y, half) {
  const a = Math.atan2(y - CY, x - CX);
  if (Math.abs(Math.hypot(x - CX, y - CY) - R) <= half && !(a > GAP[0] && a < GAP[1])) return true;
  return TAIL.some((s) => toSegment(x, y, s) <= half);
}

/** Draws an n×n picture: `cover(x, y)` says, for a point in 0..1, whether it's inside and in what colour. */
function draw(n, cover) {
  const S = 4;
  const px = Buffer.alloc(n * n * 4);
  for (let py = 0; py < n; py++)
    for (let qx = 0; qx < n; qx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const c = cover((qx + (sx + 0.5) / S) / n, (py + (sy + 0.5) / S) / n);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      const i = (py * n + qx) * 4;
      if (a) [px[i], px[i + 1], px[i + 2]] = [r / a, g / a, b / a].map(Math.round);
      px[i + 3] = Math.round((a / (S * S)) * 255);
    }
  return png(n, px);
}

/** The listed icon: the violet bubble, inside the padding the stores ask for (an eighth each side at 128). */
export function listed(n) {
  return bubble(n, VIOLET, n >= 48 ? n / 8 : n * 0.04);
}

/** The toolbar button's icon: the bubble alone, as large as the button allows, in one colour on nothing. */
export function toolbar(n, ink) {
  return bubble(n, ink, n * 0.04);
}

function bubble(n, ink, margin) {
  // Strokes as heavy as the browsers' own toolbar icons: about 1.7 pixels at 16, a tenth of the art above that.
  const stroke = Math.max(1.7, (n - 2 * margin) * 0.105);
  // The bubble's extent in the 24-unit box (the tail reaches 4, 19.8), with half a stroke round it.
  const [x0, y0, x1, y1] = [4, 3.5, 20.5, 19.8];
  const unit = (n - 2 * margin - stroke) / Math.max(x1 - x0, y1 - y0);
  const half = stroke / 2 / unit;
  const ox = (n - (x1 - x0) * unit) / 2;
  const oy = (n - (y1 - y0) * unit) / 2;
  return draw(n, (x, y) => (onGlyph(x0 + (x * n - ox) / unit, y0 + (y * n - oy) / unit, half) ? ink : null));
}

/** An RGBA picture as a PNG file: w wide, h high (square unless said). */
export function png(w, rgba, h = w) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
