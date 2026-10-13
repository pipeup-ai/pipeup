import {
  fromText,
  openJson,
  randomBytes,
  schnorrPublicKey,
  schnorrSign,
  sealJson,
  sha256,
  toHex,
  toText,
  utf8,
  type Ladder,
} from "@pipeup/kit";

/** Nostr's ephemeral range is 20000-29999; this one is Pipeup's meeting-point kind (add-ons design §9.1). */
export const KIND = 25_800;
/** Relays keep ephemeral events a few minutes and refuse old ones, so a joiner only asks for the last 30 s. */
export const WINDOW_S = 30;
const MAX_CONTENT = 24_000;
const SEEN = 500;

export const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

/** A relay address is `wss:` (or `ws:` to this machine, for development); anything else is ignored. */
export function relayList(attr: string | null): string[] {
  const list = attr
    ?.split(",")
    .map((s) => s.trim())
    .filter((s) => /^wss:\/\/[^\s/]+|^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(s));
  return list?.length ? [...new Set(list)] : DEFAULT_RELAYS;
}

export interface Meeting {
  /** Seals `msg` and publishes it on every relay that is open. */
  post(msg: object): Promise<void>;
  /** How many relays are connected now. */
  open(): number;
  close(): void;
}

/**
 * The meeting point: Nostr ephemeral events tagged with the room's signal address, sealed with its signal key and
 * signed by a throwaway key that is unrelated to the reviewer. Works with any subset of the relays: each reconnects
 * on its own with a growing wait, and a message is posted to those that are open.
 */
export async function meet(
  relays: readonly string[],
  l: Ladder,
  signal: AbortSignal,
  onMessage: (msg: Record<string, unknown>) => void,
): Promise<Meeting> {
  const sk = randomBytes(32);
  const me = toHex(schnorrPublicKey(sk));
  const addr = await l.addr("signal");
  const sockets = new Set<WebSocket>();
  const seen = new Set<string>();

  const hear = async (data: unknown) => {
    let m: unknown;
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    const e = Array.isArray(m) && m[0] === "EVENT" ? (m[2] as Record<string, unknown> | null) : null;
    if (!e || e.pubkey === me || typeof e.id !== "string" || seen.has(e.id)) return;
    if (typeof e.created_at !== "number" || e.created_at < Date.now() / 1000 - WINDOW_S) return;
    if (typeof e.content !== "string" || e.content.length > MAX_CONTENT) return;
    seen.add(e.id);
    if (seen.size > SEEN) seen.delete(seen.values().next().value!);
    const bytes = fromText(e.content);
    const msg = bytes && (await openJson(l, "signal", bytes));
    if (msg && typeof msg === "object" && !Array.isArray(msg)) onMessage(msg as Record<string, unknown>);
  };

  const connect = (url: string, wait = 1000) => {
    if (signal.aborted) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    let done = false;
    const lost = () => {
      if (done) return;
      done = true;
      sockets.delete(ws);
      if (!signal.aborted) setTimeout(() => connect(url, Math.min(wait * 2, 30_000)), wait);
    };
    ws.onopen = () => {
      sockets.add(ws);
      const since = Math.floor(Date.now() / 1000) - WINDOW_S;
      ws.send(JSON.stringify(["REQ", "pu", { kinds: [KIND], "#t": [addr], since }]));
      wait = 1000;
    };
    ws.onmessage = (ev) => void hear(ev.data);
    ws.onerror = ws.onclose = lost;
  };
  for (const url of relays) connect(url);

  const close = () => {
    for (const ws of sockets) ws.close();
    sockets.clear();
  };
  signal.addEventListener("abort", close, { once: true });

  return {
    open: () => sockets.size,
    close,
    async post(msg) {
      const tags = [["t", addr]];
      const content = toText(await sealJson(l, "signal", msg));
      const created_at = Math.floor(Date.now() / 1000);
      const id = await sha256(utf8(JSON.stringify([0, me, created_at, KIND, tags, content])));
      const sig = toHex(await schnorrSign(id, sk));
      const frame = JSON.stringify([
        "EVENT",
        { id: toHex(id), pubkey: me, created_at, kind: KIND, tags, content, sig },
      ]);
      for (const ws of sockets) if (ws.readyState === 1) ws.send(frame);
    },
  };
}
