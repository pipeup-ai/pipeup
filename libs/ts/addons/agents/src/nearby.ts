/** Files kept next to the page (its replies, a shell link's address) and the computer the page is on. */

const WAIT_MS = 4000;

/**
 * A file named after the page (`report.html` → `report<suffix>`), or the page's own choice. Only a file on the same
 * computer or the same site is ever read.
 */
export function nextTo(
  suffix: string,
  given: string | null = null,
  here: Location = location,
): string | null {
  try {
    const page = here.href.split(/[?#]/)[0]!;
    const url = new URL(
      given ?? (/\/$/.test(page) ? `${page}index${suffix}` : page.replace(/\.[^./]*$/, "") + suffix),
      here.href,
    );
    const ok = url.protocol === "file:" ? here.protocol === "file:" : url.origin === here.origin;
    if (!ok)
      console.warn("pipeup: the file next to this page must be on this site or this computer; ignoring it");
    return ok ? url.href : null;
  } catch {
    return null;
  }
}

/** The page is on this computer: opened as a file, or shown at a local address. Only then can a shell link reach it. */
export function onThisComputer(here: Location = location): boolean {
  if (here.protocol === "file:") return true;
  return here.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(here.hostname);
}

/**
 * Runs a script file next to the page (a page opened from disk can run one, but not read a data file), inside Pipeup's
 * own layer so the page itself is never touched. A fresh address each time, so a changed file is read again.
 */
export function runFile(url: string, into: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${url}?${Date.now()}`;
    const done = (fail?: string) => {
      window.clearTimeout(timer);
      s.remove();
      if (fail) reject(new Error(`pipeup: ${fail}`));
      else resolve();
    };
    const timer = window.setTimeout(() => done("the file didn't answer"), WAIT_MS);
    s.addEventListener("load", () => done());
    s.addEventListener("error", () => done("there is no such file yet"));
    into.append(s);
  });
}

/** The kind of computer the page is on, for naming the right script; "other" for phones, tablets and the unknown. */
export type System = "mac" | "windows" | "linux" | "other";

export function systemOf(nav: Navigator = navigator): System {
  const ua = nav.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|android/.test(ua)) return "other";
  const p = (
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    nav.platform ||
    ua
  ).toLowerCase();
  // An iPad asks for the desktop site as a Mac; it has a touch screen, and no agent beside it.
  if (p.includes("mac")) return nav.maxTouchPoints > 1 ? "other" : "mac";
  if (p.includes("win")) return "windows";
  if (p.includes("linux") || p.includes("x11")) return "linux";
  return "other";
}
