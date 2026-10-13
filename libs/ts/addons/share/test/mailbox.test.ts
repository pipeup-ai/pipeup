import { createServer, type IncomingMessage, type Server } from "node:http";
import { RetryAfter } from "@pipeup/kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Problem } from "../src/backend";
import { batchId, Mailbox } from "../src/mailbox";
import { anchor, L, reviewer } from "./helpers";

interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

let server: Server;
let base: string;
let seen: Seen[] = [];
let batches: { id: string; ct: string }[] = [];
/** Answers for the next requests, oldest first: [status, headers, body]. */
let script: [number, Record<string, string>, unknown][] = [];
let pageSize = 1000;
let tooBig = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method!, url: req.url!, headers: req.headers, body });
      const send = (s: number, h: Record<string, string>, b: unknown) => {
        res.writeHead(s, { "content-type": "application/json", "access-control-allow-origin": "*", ...h });
        res.end(JSON.stringify(b));
      };
      const next = script.shift();
      if (next) return send(...next);
      const u = new URL(req.url!, "http://x");
      if (req.method === "GET") {
        const from = Number(u.searchParams.get("since") || 0);
        const page = batches.slice(from, from + pageSize);
        return send(
          200,
          {},
          {
            v: 1,
            batches: page,
            next: String(from + page.length),
            more: from + page.length < batches.length,
            expires: "2027-10-07T00:00:00Z",
          },
        );
      }
      const d = JSON.parse(body) as { id: string; ct: string };
      if (tooBig > 0 && body.length > 1000) {
        tooBig--;
        return send(413, {}, { v: 1, error: "too-large" });
      }
      if (!batches.some((b) => b.id === d.id)) batches.push({ id: d.id, ct: d.ct });
      send(201, {}, { v: 1 });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/m/${"a".repeat(22)}`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  seen = [];
  batches = [];
  script = [];
  pageSize = 1000;
  tooBig = 0;
});

const make = (token?: string) => new Mailbox({ mailbox: base, token }, L, fetch);
const ops = async (n: number) => {
  const sam = await reviewer("Sam");
  for (let i = 0; i < n; i++) await sam.comment(anchor, `comment ${i}`);
  return sam.ops();
};

describe("mailbox client (contract pm1)", () => {
  it("posts a sealed batch with its content address as id, and a reader opens it", async () => {
    const all = await ops(2);
    await make().post(all);
    const sent = JSON.parse(seen[0]!.body) as { id: string; ct: string };
    expect(sent.ct).toMatch(/^pu1\.[A-Za-z0-9_-]+$/);
    expect(sent.id).toBe(await batchId(sent.ct));
    expect(sent.id).toHaveLength(22);
    const r = make();
    const got = await r.read();
    expect(got.flatMap((g) => g.ops)).toHaveLength(2);
    expect(r.ids.size).toBe(2);
    expect(r.expires).toBe(Date.parse("2027-10-07T00:00:00Z"));
  });

  it("reads simple requests only, and pages with `more` and the cursor, then only what is new", async () => {
    pageSize = 1;
    for (const o of await Promise.all([ops(1), ops(1), ops(1)])) await make().post(o);
    seen = [];
    const r = make();
    expect((await r.read()).length).toBe(3);
    expect(seen.map((s) => s.url)).toEqual([
      `${new URL(base).pathname}/ops`,
      `${new URL(base).pathname}/ops?since=1`,
      `${new URL(base).pathname}/ops?since=2`,
    ]);
    for (const s of seen) {
      expect(
        Object.keys(s.headers).filter(
          (h) =>
            ![
              "host",
              "connection",
              "accept",
              "accept-language",
              "accept-encoding",
              "user-agent",
              "sec-fetch-mode",
            ].includes(h),
        ),
      ).toEqual([]);
      expect(s.headers.accept).toBe("application/json");
    }
    seen = [];
    expect(await r.read()).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("since=3");
  });

  it("the write token appears only in the POST body: never in a URL or a header", async () => {
    await make("secret-token_1").post(await ops(1));
    await make("secret-token_1").read();
    for (const s of seen) {
      expect(s.url).not.toContain("secret-token_1");
      expect(JSON.stringify(s.headers)).not.toContain("secret-token_1");
    }
    expect(JSON.parse(seen[0]!.body).token).toBe("secret-token_1");
    expect(seen[0]!.headers["content-type"]).toMatch(/^text\/plain/);
    expect(seen[0]!.headers.authorization).toBeUndefined();
  });

  it("a retried POST reuses its id and ct", async () => {
    const all = await ops(1);
    const m = make();
    script = [[503, {}, {}]];
    await expect(m.post(all)).rejects.toThrow("HTTP 503");
    await m.post(all);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.body).toBe(seen[0]!.body);
    expect(batches).toHaveLength(1);
  });

  it("403 stops sending (and says so), 404 is gone, 507 is full", async () => {
    const all = await ops(1);
    script = [[403, {}, { v: 1, error: "token" }]];
    await expect(make().post(all)).rejects.toMatchObject({ kind: "closed" });
    script = [[404, {}, { v: 1, error: "gone" }]];
    await expect(make().post(all)).rejects.toMatchObject({ kind: "gone" });
    script = [[507, {}, { v: 1, error: "full" }]];
    await expect(make().post(all)).rejects.toMatchObject({ kind: "full" });
    script = [[404, {}, { v: 1, error: "gone" }]];
    await expect(make().read()).rejects.toBeInstanceOf(Problem);
  });

  it("429 waits Retry-After, else the body's retryAfter, else 10 s, capped at an hour", async () => {
    const all = await ops(1);
    script = [[429, { "retry-after": "7" }, { v: 1, error: "rate", retryAfter: 7 }]];
    await expect(make().post(all)).rejects.toMatchObject({ seconds: 7 });
    script = [[429, {}, { v: 1, error: "rate", retryAfter: 30 }]];
    await expect(make().post(all)).rejects.toMatchObject({ seconds: 30 });
    script = [[429, {}, { v: 1, error: "rate" }]];
    await expect(make().post(all)).rejects.toBeInstanceOf(RetryAfter);
    script = [[429, { "retry-after": "999999" }, {}]];
    await expect(make().post(all)).rejects.toMatchObject({ seconds: 3600 });
  });

  it("409 on a read starts again from the start without opening anything twice", async () => {
    await make().post(await ops(1));
    const r = make();
    await r.read();
    script = [[409, {}, { v: 1, error: "cursor" }]];
    seen = [];
    expect(await r.read()).toEqual([]);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.url).not.toContain("since");
  });

  it("413 splits the batch and retries; 400 drops the batch", async () => {
    tooBig = 1;
    await make().post(await ops(6));
    expect(batches.length).toBeGreaterThanOrEqual(2);
    const total = (await make().read()).flatMap((g) => g.ops);
    expect(new Set(total.map((o) => (o as { body: { id: string } }).body.id)).size).toBe(6);
    script = [[400, {}, { v: 1, error: "bad-request" }]];
    await expect(make().post(await ops(1))).resolves.toBeUndefined();
  });
});
