import { randomBytes } from "node:crypto";

/**
 * A small PrivateBin that behaves as spike S1 found 2.0.6 to (add-ons architecture §7): paste and comment shapes
 * checked as `FormatV2::isValid` does, JSON for `Accept: application/json`, `time_to_live` read-back, and "please wait"
 * as HTTP 200 with `status: 1`.
 */
export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface Paste {
  id: string;
  token: string;
  created: number;
  expire: string;
  ct: string;
  comments: { id: string; ct: string; created: number }[];
}

const SECONDS: Record<string, number> = {
  "5min": 300,
  "1hour": 3600,
  "1day": 86400,
  "1week": 604800,
  "1year": 31536000,
};
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const hex = (n: number) => randomBytes(n).toString("hex");

export function createPrivateBinMock(options: { offered?: string[]; defaultExpire?: string } = {}) {
  const offered = options.offered ?? ["5min", "1hour", "1day", "1week", "1month", "1year", "never"];
  const pastes = new Map<string, Paste>();
  const log: { method: string; url: string; headers: Record<string, string>; body: string }[] = [];
  let waits = 0;
  let wait = 10;
  let status429 = 0;
  const json = (obj: unknown, status = 200): Reply => ({
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(obj),
  });
  const spec = (a: unknown): boolean =>
    Array.isArray(a) &&
    a.length === 8 &&
    typeof a[0] === "string" &&
    a[0].length <= 24 &&
    typeof a[1] === "string" &&
    a[1].length <= 14 &&
    typeof a[2] === "number" &&
    a[2] > 10000 &&
    [128, 192, 256].includes(a[3] as number) &&
    [64, 96, 128].includes(a[4] as number) &&
    a[5] === "aes" &&
    ["ctr", "cbc", "gcm"].includes(a[6] as string) &&
    ["zlib", "none"].includes(a[7] as string);
  const ctOk = (ct: unknown) => typeof ct === "string" && ct.length > 0 && B64.test(ct);

  function handle(method: string, url: string, headers: Record<string, string>, body = ""): Reply {
    log.push({ method, url, headers, body });
    const u = new URL(url);
    const cors = { "access-control-allow-origin": "*" };
    if (method === "OPTIONS") return { status: 405, headers: cors, body: "" };
    if (method === "GET") {
      const id = u.search.slice(1);
      const p = pastes.get(id);
      if (!/application\/json/.test(headers.accept ?? ""))
        return { status: 200, headers: cors, body: "<html>" };
      if (!p)
        return json({ status: 1, message: "Paste does not exist, has expired or has been deleted." }, 404);
      const ttl =
        p.expire === "never"
          ? undefined
          : Math.max(1, SECONDS[p.expire]! - Math.floor((Date.now() - p.created) / 1000) - 10);
      return json({
        status: 0,
        id: p.id,
        v: 2,
        ct: p.ct,
        meta: { created: Math.floor(p.created / 1000), ...(ttl ? { time_to_live: ttl } : {}) },
        comments: p.comments.map((c) => ({
          v: 2,
          adata: ["x", "y", 100000, 256, 128, "aes", "gcm", "none"],
          ct: c.ct,
          id: c.id,
          pasteid: p.id,
          parentid: p.id,
          meta: { created: Math.floor(c.created / 1000) },
        })),
        comment_count: p.comments.length,
      });
    }
    if (status429 > 0) {
      status429--;
      return {
        status: 429,
        headers: { ...cors, "retry-after": "2", "access-control-expose-headers": "Retry-After" },
        body: "",
      };
    }
    if (waits > 0) {
      waits--;
      return json({ status: 1, message: `Please wait ${wait} seconds between each post.` });
    }
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return json({ status: 1, message: "Invalid data." });
    }
    if (typeof d.deletetoken === "string") {
      const p = pastes.get(String(d.pasteid));
      if (!p || p.token !== d.deletetoken) return json({ status: 1, message: "Wrong deletion token." });
      pastes.delete(p.id);
      return json({ status: 0, id: p.id });
    }
    if (d.pasteid !== undefined) {
      // A comment is exactly these five fields; a non-empty meta would make it a paste.
      const keys = Object.keys(d).sort().join();
      if (keys !== "adata,ct,parentid,pasteid,v" || d.v !== 2 || !spec(d.adata) || !ctOk(d.ct))
        return json({ status: 1, message: "Invalid data." });
      const p = pastes.get(String(d.pasteid));
      if (!p || d.parentid !== d.pasteid) return json({ status: 1, message: "Invalid data." });
      const c = { id: hex(8), ct: d.ct as string, created: Date.now() };
      p.comments.push(c);
      return json({ status: 0, id: c.id, url: `/?${p.id}#${c.id}` });
    }
    const ad = d.adata as unknown[] | undefined;
    const meta = d.meta as { expire?: string } | undefined;
    if (
      d.v !== 2 ||
      !Array.isArray(ad) ||
      ad.length !== 4 ||
      !spec(ad[0]) ||
      ![0, 1].includes(ad[2] as number) ||
      !ctOk(d.ct) ||
      !meta
    )
      return json({ status: 1, message: "Invalid data." });
    const expire = offered.includes(meta.expire ?? "") ? meta.expire! : (options.defaultExpire ?? "1week");
    const p: Paste = {
      id: hex(8),
      token: hex(20),
      created: Date.now(),
      expire,
      ct: d.ct as string,
      comments: [],
    };
    pastes.set(p.id, p);
    return json({ status: 0, id: p.id, url: `/?${p.id}`, deletetoken: p.token });
  }

  return {
    handle,
    pastes,
    log,
    /** The next n posts get "please wait" (HTTP 200, status 1). */
    pleaseWait: (n = 1, seconds = 10) => {
      waits = n;
      wait = seconds;
    },
    /** The next n posts get HTTP 429 with Retry-After: 2. */
    tooMany: (n = 1) => (status429 = n),
    /** All comment texts across pastes, for asserting what was sent. */
    sent: () => [...pastes.values()].flatMap((p) => p.comments.map((c) => c.ct)),
    /** A `fetch` over this mock. */
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const h: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => (h[k] = v));
      const r = handle(
        init?.method ?? "GET",
        String(input),
        h,
        typeof init?.body === "string" ? init.body : "",
      );
      return new Response(r.status === 404 ? r.body : r.body, { status: r.status, headers: r.headers });
    }) as typeof fetch,
  };
}
