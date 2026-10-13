import type { AddonHost, PipeupAddon } from "pipeup";
import { decide, type Notice } from "./decide";
import { KEYS } from "./keys";
import { check } from "./verify";

export const LIST_URL = "https://pipeup-ai.github.io/pipeup/updates.json";
const DAY = 864e5;
const WEEK = 7 * DAY;
const KEEP = { list: "pipeup:updates-list", dismissed: "pipeup:updates-dismissed" };
const ARROW = ["M12 19V5", "M5 12l7-7 7 7"];
/** Notices link only to the project's own addresses. */
const SAFE = ["https://github.com/pipeup-ai/", "https://pipeup-ai.github.io/"];

const kept = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};
const keep = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered
  }
};

/** Whether the author is the one looking: a page from disk, this computer, or where the author asked. */
export function authorContext(
  loc: Pick<Location, "protocol" | "hostname"> = location,
  html: Element = document.documentElement,
): boolean {
  const ask = html.getAttribute("data-pipeup-updates");
  if (ask === "off") return false;
  if (ask === "on" || ask === "everyone") return true;
  const h = loc.hostname;
  return (
    loc.protocol === "file:" ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".localhost") ||
    h.endsWith(".test")
  );
}

/** A link is shown only if it is on the project's own addresses (compared as parsed addresses, not as text). */
export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && SAFE.some((s) => u.href.startsWith(s)) ? u.href : null;
  } catch {
    return null;
  }
}

export function createAddon(): PipeupAddon {
  return {
    id: "updates",
    api: 1,
    version: "0.6.0",
    needs: ["menu", "notify"],
    network: {
      when: "page-configured",
      to: ["pipeup-ai.github.io"],
      says: "Checks the Pipeup project's published update list (GitHub Pages) once a day, only on this computer or where the page's author asked; that service can see your network address.",
    },
    setup(host: AddonHost) {
      if (document.documentElement.getAttribute("data-pipeup-updates") === "off")
        return host.off('the page switched it off (data-pipeup-updates="off")');
      if (!authorContext())
        return host.off(
          'not the author\'s computer (add data-pipeup-updates="on" to the page to check here)',
        );
      void run(host);
    },
  };
}

async function run(host: AddonHost): Promise<void> {
  let text = "";
  const cached = kept(KEEP.list);
  const at = Number(kept(`${KEEP.list}-at`));
  if (cached && Date.now() - at < DAY) text = cached;
  else {
    try {
      const timeout = AbortSignal.timeout(4000);
      const res = await fetch(LIST_URL, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        mode: "cors",
        signal: AbortSignal.any ? AbortSignal.any([host.signal, timeout]) : timeout,
      });
      if (res.ok) {
        text = await res.text();
        keep(KEEP.list, text);
        keep(`${KEEP.list}-at`, String(Date.now()));
      }
    } catch {
      return;
    }
  }
  const list = await check(text, KEYS);
  if (!list || host.signal.aborted) return;
  const notice = decide(list, host.version);
  if (notice) show(host, notice);
}

function show(host: AddonHost, n: Notice): void {
  const link = safeUrl(n.url);
  const line = `pipeup: ${n.text}${link ? ` ${link}` : ""}`;
  if (n.level === "info") return void console.info(line);
  console.warn(line);
  // A dismissed notice stays quiet, except a security one, which comes back after a week.
  const dismissed = JSON.parse(kept(KEEP.dismissed) || "{}") as Record<string, number>;
  const when = dismissed[n.id];
  if (when && (n.level !== "security" || Date.now() - when < WEEK)) return;
  host.addMenuItem({
    id: "update",
    icon: ARROW,
    label: () => (n.level === "security" ? "Security update for Pipeup" : "A newer Pipeup is out"),
    hint: () => n.text,
    select: () => {
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      dismissed[n.id] = Date.now();
      keep(KEEP.dismissed, JSON.stringify(dismissed));
    },
  });
  if (n.level === "security") host.notify(n.text);
}
