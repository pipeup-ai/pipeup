// A minimal NIP-01 Nostr relay for tests: EVENT, REQ and CLOSE over WebSocket. Ephemeral kinds (20000-29999) are
// delivered to current subscribers and never stored; other kinds are kept in memory. Signatures are not checked.
// Like strfry it refuses an event whose created_at is more than 60 s old.
import { WebSocketServer } from "ws";

const matches = (f, e) =>
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (f.since === undefined || e.created_at >= f.since) &&
  (f.until === undefined || e.created_at <= f.until) &&
  Object.entries(f).every(
    ([k, v]) => !k.startsWith("#") || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])),
  );

/** Starts a relay on 127.0.0.1 (port 0: any free one). `events` lists every accepted event, for assertions. */
export async function startRelay(port = 0) {
  const wss = new WebSocketServer({ host: "127.0.0.1", port });
  await new Promise((resolve) => wss.once("listening", resolve));
  const stored = [];
  const events = [];
  const stats = { connections: 0, open: 0 };
  wss.on("connection", (ws) => {
    stats.connections++;
    stats.open++;
    const subs = new Map();
    ws.on("close", () => stats.open--);
    ws.on("message", (raw) => {
      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return ws.send(JSON.stringify(["NOTICE", "invalid: not JSON"]));
      }
      if (!Array.isArray(m)) return;
      if (m[0] === "EVENT" && m[1] && typeof m[1] === "object") {
        const e = m[1];
        const age = Date.now() / 1000 - e.created_at;
        if (!(age < 60)) return ws.send(JSON.stringify(["OK", e.id, false, "invalid: event too old"]));
        events.push(e);
        if (!(e.kind >= 20000 && e.kind < 30000)) stored.push(e);
        ws.send(JSON.stringify(["OK", e.id, true, ""]));
        for (const client of wss.clients)
          if (client.readyState === 1 && client.deliver) client.deliver(e);
      } else if (m[0] === "REQ" && typeof m[1] === "string") {
        const filters = m.slice(2);
        subs.set(m[1], filters);
        for (const e of stored)
          if (filters.some((f) => matches(f, e))) ws.send(JSON.stringify(["EVENT", m[1], e]));
        ws.send(JSON.stringify(["EOSE", m[1]]));
      } else if (m[0] === "CLOSE") subs.delete(m[1]);
    });
    ws.deliver = (e) => {
      for (const [id, filters] of subs)
        if (filters.some((f) => matches(f, e))) ws.send(JSON.stringify(["EVENT", id, e]));
    };
  });
  const address = wss.address();
  return {
    url: `ws://127.0.0.1:${address.port}`,
    port: address.port,
    events,
    stats,
    /** Drops every connection (the relay stays up): for testing reconnects. */
    dropAll() {
      for (const c of wss.clients) c.terminate();
    },
    close: () =>
      new Promise((resolve) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => resolve());
      }),
  };
}
