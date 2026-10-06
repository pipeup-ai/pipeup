export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length] ?? 0;
}

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
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let cur = new Array<number>(m + 1).fill(0);
  let bestEnd = -1;
  let bestDistance = Infinity;
  for (let j = 1; j <= text.length; j++) {
    cur[0] = 0;
    const c = text.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = pattern.charCodeAt(i - 1) === c ? 0 : 1;
      cur[i] = Math.min((prev[i] ?? 0) + 1, (cur[i - 1] ?? 0) + 1, (prev[i - 1] ?? 0) + cost);
    }
    const d = cur[m] ?? Infinity;
    if (d < bestDistance) {
      bestDistance = d;
      bestEnd = j;
    }
    [prev, cur] = [cur, prev];
  }
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
