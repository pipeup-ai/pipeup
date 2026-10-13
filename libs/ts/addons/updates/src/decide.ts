export interface Advisory {
  id: string;
  severity: "info" | "recommended" | "security";
  /** Which versions it affects: `<0.6.1`, `>=0.5.0 <0.6.1`, or a comma-separated list of exact versions. */
  affects: string;
  fixed?: string;
  summary: string;
  url: string;
}

export interface UpdateList {
  v: 1;
  at: string;
  expires: string;
  latest: string;
  minimum: string;
  versions: Record<string, { date: string; integrity: string; notes: string }>;
  advisories: Advisory[];
  sig: { key: string; value: string };
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/;

/** Negative, zero or positive: `a` before, the same as, or after `b` (a pre-release comes before its release). */
export function compare(a: string, b: string): number {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (!x || !y) return 0;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  if (x[4] === y[4]) return 0;
  if (x[4] === undefined) return 1;
  if (y[4] === undefined) return -1;
  const p = x[4].split(".");
  const q = y[4].split(".");
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    const [m, n] = [Number(p[i]), Number(q[i])];
    const d = Number.isNaN(m) || Number.isNaN(n) ? p[i]!.localeCompare(q[i]!) : m - n;
    if (d) return d;
  }
  return 0;
}

/** Whether `version` is in `expr`: comparisons joined by spaces (`>=0.5.0 <0.6.1`), or a comma-separated list of versions. */
export function inRange(version: string, expr: string): boolean {
  if (!/[<>]/.test(expr)) return expr.split(",").some((v) => v.trim() === version);
  return expr
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => {
      const m = /^(<=|>=|<|>)(.+)$/.exec(part);
      if (!m) return false;
      const c = compare(version, m[2]!);
      return m[1] === "<" ? c < 0 : m[1] === "<=" ? c <= 0 : m[1] === ">" ? c > 0 : c >= 0;
    });
}

/** What to tell the author, if anything. */
export interface Notice {
  level: "info" | "recommended" | "security";
  /** Names this notice, so dismissing one doesn't hide another. */
  id: string;
  text: string;
  url: string;
}

/** A minor step below 1.0 counts as a major one, since Pipeup may change then. */
const major = (a: string, b: string): boolean => {
  const x = SEMVER.exec(a)!;
  const y = SEMVER.exec(b)!;
  return x[1] !== y[1] || (x[1] === "0" && x[2] !== y[2]);
};

export function decide(list: UpdateList, current: string): Notice | null {
  if (!SEMVER.test(current)) return null;
  const notes = list.versions[list.latest]?.notes ?? "";
  const hit = (sev: Advisory["severity"]) =>
    list.advisories.find((a) => a.severity === sev && inRange(current, a.affects));
  const secure = hit("security");
  if (secure)
    return {
      level: "security",
      id: secure.id,
      text: `Security update: ${secure.summary}${secure.fixed ? ` Fixed in Pipeup ${secure.fixed}.` : ""}`,
      url: secure.url,
    };
  if (compare(current, list.minimum) < 0)
    return {
      level: "security",
      id: `minimum-${list.minimum}`,
      text: `This Pipeup (${current}) is no longer supported; ${list.minimum} is the oldest that is. The newest is ${list.latest}.`,
      url: notes,
    };
  const advised = hit("recommended");
  if (advised) return { level: "recommended", id: advised.id, text: advised.summary, url: advised.url };
  if (compare(list.latest, current) > 0)
    return {
      level: major(list.latest, current) ? "recommended" : "info",
      id: `latest-${list.latest}`,
      text: `Pipeup ${list.latest} is out (this page has ${current}).`,
      url: notes,
    };
  return null;
}
