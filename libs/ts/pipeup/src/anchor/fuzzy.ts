/**
 * The last column of the edit-distance table of `a` against `b`, one entry per prefix of `a` (entry 0 is the empty
 * prefix). With `free`, a match may start anywhere in `a` (Sellers' algorithm).
 */
function column(a: string, b: string, free: boolean): number[] {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = [...prev];
  const out = [b.length];
  for (let i = 1; i <= a.length; i++) {
    cur[0] = free ? 0 : i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    out.push(cur[b.length]!);
    [prev, cur] = [cur, prev];
  }
  return out;
}

export const levenshtein = (a: string, b: string): number => column(a, b, false).pop()!;

/**
 * Best approximate occurrence of `pattern` in `text` (Sellers' algorithm), or null if every
 * occurrence needs more than `maxDistance` edits.
 */
export function approxFind(
  text: string,
  pattern: string,
  maxDistance: number,
): { start: number; end: number; distance: number } | null {
  const m = pattern.length;
  if (m === 0) return null;
  let bestEnd = -1;
  let bestDistance = Infinity;
  column(text, pattern, true).forEach((d, j) => {
    if (j && d < bestDistance) {
      bestDistance = d;
      bestEnd = j;
    }
  });
  if (bestDistance > maxDistance) return null;

  // Recover the start: the window ending at bestEnd that is closest to the pattern.
  let bestStart = Math.max(0, bestEnd - m);
  let startDistance = Infinity;
  for (
    let s = Math.max(0, bestEnd - m - maxDistance);
    s <= Math.min(bestEnd, bestEnd - m + maxDistance);
    s++
  ) {
    const d = levenshtein(text.slice(s, bestEnd), pattern);
    if (d < startDistance) {
      startDistance = d;
      bestStart = s;
    }
  }
  return { start: bestStart, end: bestEnd, distance: startDistance };
}
