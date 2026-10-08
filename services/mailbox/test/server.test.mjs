import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMailboxServer } from "../src/server.mjs";

const idOf = (ct) => createHash("sha256").update(ct).digest("base64url").slice(0, 22);
const mk = (s) => {
  const ct = `pu1.${Buffer.from(s).toString("base64url")}`;
  return { id: idOf(ct), ct };
};
const TXT = { "Content-Type": "text/plain;charset=UTF-8" };

async function start(options = {}) {
  const s = createMailboxServer({ memory: true, ...options });
  const { port } = await s.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  const j = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      headers,
    });
    const text = await r.text();
    return { status: r.status, headers: r.headers, body: text ? JSON.parse(text) : undefined };
  };
  const create = async (h) => {
    const r = await j("POST", "/m", { v: 1 }, h);
    return { ...r, url: `/m/${r.body?.mailbox}` };
  };
  return { s, base, port, j, create };
}
const ids = (r) => r.body.batches.map((b) => b.id);

describe("endpoints", () => {
  let t;
  before(async () => (t = await start()));
  after(() => t.s.close());

  test("create, post, get, idempotent retry", async () => {
    const c = await t.create();
    assert.equal(c.status, 201);
    assert.match(c.body.mailbox, /^[A-Za-z0-9_-]{22}$/);
    assert.equal(c.body.token, null);
    assert.equal(c.body.keep, "last-write");
    assert.deepEqual(c.body.limits, { body: 524288, mailbox: 67108864 });
    assert.ok(c.body.expires);
    const b = mk("hi");
    const p1 = await t.j("POST", `${c.url}/ops`, b, TXT);
    assert.equal(p1.status, 201);
    assert.deepEqual(p1.body, { v: 1 });
    assert.equal((await t.j("POST", `${c.url}/ops`, b, TXT)).status, 200);
    const g = await t.j("GET", `${c.url}/ops`, undefined, { Accept: "application/json" });
    assert.equal(g.status, 200);
    assert.deepEqual(g.body.batches, [b]);
    assert.equal(g.body.next, "1");
    assert.equal(g.body.more, false);
  });

  test("body is JSON whatever the content type", async () => {
    const c = await t.create();
    assert.equal(
      (await t.j("POST", `${c.url}/ops`, mk("a"), { "Content-Type": "application/json" })).status,
      201,
    );
    assert.equal((await t.j("POST", `${c.url}/ops`, mk("b"))).status, 201);
  });

  test("cursors: since returns only what is new", async () => {
    const c = await t.create();
    const [a, b, d] = [mk("a"), mk("b"), mk("d")];
    await t.j("POST", `${c.url}/ops`, a);
    const first = await t.j("GET", `${c.url}/ops?since=`);
    assert.deepEqual(ids(first), [a.id]);
    await t.j("POST", `${c.url}/ops`, b);
    await t.j("POST", `${c.url}/ops`, d);
    const next = await t.j("GET", `${c.url}/ops?since=${first.body.next}`);
    assert.deepEqual(ids(next), [b.id, d.id]);
    const none = await t.j("GET", `${c.url}/ops?since=${next.body.next}`);
    assert.deepEqual(none.body.batches, []);
    assert.equal(none.body.next, next.body.next);
  });

  test("errors: 400 bad JSON, bad ct, id mismatch", async () => {
    const c = await t.create();
    for (const body of [
      "{nope",
      "[]",
      JSON.stringify({ id: "x", ct: 5 }),
      JSON.stringify({ id: idOf("x"), ct: "x" }),
    ]) {
      const r = await t.j("POST", `${c.url}/ops`, body, TXT);
      assert.equal(r.status, 400, body);
      assert.equal(r.body.error, "bad-request");
      assert.equal(r.body.v, 1);
      assert.equal(typeof r.body.message, "string");
    }
    const m = await t.j("POST", `${c.url}/ops`, { id: mk("a").id, ct: mk("b").ct }, TXT);
    assert.equal(m.status, 400);
    assert.equal((await t.j("GET", `${c.url}/ops`)).body.batches.length, 0);
  });

  test("errors: 404 gone, 409 cursor, 413 too-large, 404 elsewhere, 405", async () => {
    const c = await t.create();
    const gone = await t.j("GET", `/m/${"a".repeat(22)}/ops`);
    assert.equal(gone.status, 404);
    assert.equal(gone.body.error, "gone");
    assert.equal((await t.j("POST", `/m/${"a".repeat(22)}/ops`, mk("x"))).status, 404);
    for (const since of ["abc", "5", "-1", "1.5"]) {
      const r = await t.j("GET", `${c.url}/ops?since=${since}`);
      assert.equal(r.status, 409, since);
      assert.equal(r.body.error, "cursor");
    }
    const ct = `pu1.${"A".repeat(524288)}`;
    const big = await t.j("POST", `${c.url}/ops`, { id: idOf(ct), ct }, TXT);
    assert.equal(big.status, 413);
    assert.equal(big.body.error, "too-large");
    const ok = `pu1.${"A".repeat(524288 - 100)}`;
    assert.equal((await t.j("POST", `${c.url}/ops`, { id: idOf(ok), ct: ok }, TXT)).status, 201);
    assert.equal((await t.j("GET", "/nowhere")).status, 404);
    assert.equal((await t.j("PUT", `${c.url}/ops`, "{}")).status, 405);
    assert.equal((await t.j("GET", "/m")).status, 405);
  });

  test("mailboxes are never listed", async () => {
    for (const p of ["/m", "/m/", "/m/ops", "/"]) assert.notEqual((await t.j("GET", p)).status, 200);
  });

  test("DELETE with the stop key, then everything is 404", async () => {
    const c = await t.create();
    await t.j("POST", `${c.url}/ops`, mk("a"));
    assert.equal((await t.j("DELETE", c.url)).status, 403);
    const wrong = await t.j("DELETE", c.url, undefined, { Authorization: "Bearer nope" });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.error, "token");
    const d = await t.j("DELETE", c.url, undefined, { Authorization: `Bearer ${c.body.stop}` });
    assert.equal(d.status, 204);
    assert.equal(d.headers.get("access-control-allow-origin"), "*");
    assert.equal((await t.j("GET", `${c.url}/ops`)).status, 404);
    assert.equal((await t.j("POST", `${c.url}/ops`, mk("b"))).status, 404);
    assert.equal(
      (await t.j("DELETE", c.url, undefined, { Authorization: `Bearer ${c.body.stop}` })).status,
      404,
    );
  });

  test("serves under any prefix", async () => {
    const c = await t.j("POST", "/pipeup/deep/m", { v: 1 });
    assert.equal(c.status, 201);
    const url = `/pipeup/deep/m/${c.body.mailbox}`;
    assert.equal((await t.j("POST", `${url}/ops`, mk("a"))).status, 201);
    assert.equal((await t.j("GET", `${url}/ops`)).body.batches.length, 1);
  });
});

describe("cors", () => {
  let t;
  before(async () => (t = await start({ rate: { get: 3 } })));
  after(() => t.s.close());
  const expectCors = (r) => {
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    assert.equal(r.headers.get("access-control-expose-headers"), "Retry-After");
    assert.equal(r.headers.has("access-control-allow-credentials"), false);
  };
  test("every response, errors included, carries the headers", async () => {
    const c = await t.create();
    expectCors(c);
    expectCors(await t.j("GET", `${c.url}/ops`));
    expectCors(await t.j("POST", `${c.url}/ops`, mk("a"), TXT));
    expectCors(await t.j("POST", `${c.url}/ops`, "{", TXT)); // 400
    expectCors(await t.j("GET", `/m/${"z".repeat(22)}/ops`)); // 404
    expectCors(await t.j("GET", `${c.url}/ops?since=9`)); // 409
    const limited = await t.j("GET", `${c.url}/ops`); // 429 (4th GET)
    assert.equal(limited.status, 429);
    expectCors(limited);
    expectCors(await t.j("GET", "/nowhere"));
    expectCors(await t.j("PUT", `${c.url}/ops`, "{}"));
  });
  test("OPTIONS answers 204 with methods, headers, max-age and private network", async () => {
    const r = await fetch(`${t.base}/m/${"a".repeat(22)}/ops`, { method: "OPTIONS" });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-methods"), "GET, POST, DELETE");
    assert.equal(r.headers.get("access-control-allow-headers"), "Content-Type, Authorization");
    assert.equal(r.headers.get("access-control-max-age"), "86400");
    assert.equal(r.headers.get("access-control-allow-private-network"), "true");
    expectCors(r);
  });
});

describe("paging", () => {
  test("more: by batch count, following next reaches every batch once", async () => {
    const t = await start({ pageBatches: 4 });
    try {
      const c = await t.create();
      const all = [];
      for (let i = 0; i < 10; i++) {
        const b = mk(`b${i}`);
        all.push(b.id);
        await t.j("POST", `${c.url}/ops`, b);
      }
      const seen = [];
      let since = "";
      let pages = 0;
      for (;;) {
        const r = await t.j("GET", `${c.url}/ops?since=${since}`);
        seen.push(...ids(r));
        since = r.body.next;
        pages++;
        if (pages === 1) assert.equal(r.body.more, true);
        if (!r.body.more) break;
      }
      assert.equal(pages, 3);
      assert.deepEqual(seen, all);
    } finally {
      await t.s.close();
    }
  });
  test("more: by size, and always at least one batch per page", async () => {
    const t = await start({ pageBytes: 1000 });
    try {
      const c = await t.create();
      for (let i = 0; i < 3; i++) {
        const ct = `pu1.${String(i).repeat(600)}`;
        await t.j("POST", `${c.url}/ops`, { id: idOf(ct), ct });
      }
      const r = await t.j("GET", `${c.url}/ops`);
      assert.equal(r.body.batches.length, 1);
      assert.equal(r.body.more, true);
      assert.equal(r.body.next, "1");
    } finally {
      await t.s.close();
    }
  });
});

describe("concurrency", () => {
  test("parallel POSTs: every batch is stored once and reads never skip", async () => {
    const t = await start({ rate: { post: 100000, get: 100000 } });
    try {
      const c = await t.create();
      const batches = Array.from({ length: 200 }, (_, i) => mk(`p${i}`));
      let since = "";
      const seen = [];
      let done = false;
      const reader = (async () => {
        while (!done) {
          const r = await t.j("GET", `${c.url}/ops?since=${since}`);
          seen.push(...ids(r));
          since = r.body.next;
        }
        const r = await t.j("GET", `${c.url}/ops?since=${since}`);
        seen.push(...ids(r));
      })();
      const results = await Promise.all(
        batches.map((b) => t.j("POST", `${c.url}/ops`, b, TXT).then((r) => r.status)),
      );
      done = true;
      await reader;
      assert.ok(results.every((s) => s === 201));
      assert.equal(new Set(seen).size, 200);
      assert.equal(seen.length, 200, "no batch is returned twice by a cursor");
    } finally {
      await t.s.close();
    }
  });
  test("the same batch posted in parallel is stored once", async () => {
    const t = await start();
    try {
      const c = await t.create();
      const b = mk("same");
      const st = await Promise.all(
        Array.from({ length: 20 }, () => t.j("POST", `${c.url}/ops`, b).then((r) => r.status)),
      );
      assert.equal(st.filter((s) => s === 201).length, 1);
      assert.equal(st.filter((s) => s === 200).length, 19);
      assert.equal((await t.j("GET", `${c.url}/ops`)).body.batches.length, 1);
    } finally {
      await t.s.close();
    }
  });
});

describe("tokens", () => {
  test("create token: required on POST /m only", async () => {
    const t = await start({ createToken: "sesame" });
    try {
      const no = await t.create();
      assert.equal(no.status, 403);
      assert.equal(no.body.error, "token");
      assert.equal((await t.create({ Authorization: "Bearer wrong" })).status, 403);
      const c = await t.create({ Authorization: "Bearer sesame" });
      assert.equal(c.status, 201);
      assert.equal((await t.j("GET", `${c.url}/ops`)).status, 200);
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("a"))).status, 201);
    } finally {
      await t.s.close();
    }
  });
  test("write token: carried only in the POST body; reads need nothing", async () => {
    const t = await start({ writeTokens: true });
    try {
      const c = await t.create();
      assert.equal(typeof c.body.token, "string");
      const b = mk("a");
      const no = await t.j("POST", `${c.url}/ops`, b, TXT);
      assert.equal(no.status, 403);
      assert.equal(no.body.error, "token");
      assert.equal((await t.j("POST", `${c.url}/ops`, { ...b, token: "wrong" }, TXT)).status, 403);
      assert.equal(
        (
          await t.j("POST", `${c.url}/ops?token=${c.body.token}`, b, {
            Authorization: `Bearer ${c.body.token}`,
          })
        ).status,
        403,
      );
      assert.equal((await t.j("POST", `${c.url}/ops`, { ...b, token: c.body.token }, TXT)).status, 201);
      assert.equal((await t.j("GET", `${c.url}/ops`)).body.batches.length, 1);
      const other = await t.create();
      assert.equal((await t.j("POST", `${other.url}/ops`, { ...b, token: c.body.token }, TXT)).status, 403);
    } finally {
      await t.s.close();
    }
  });
});

describe("limits", () => {
  test("rate: 429 with Retry-After and retryAfter, per kind and per address", async () => {
    const t = await start({ rate: { post: 3, get: 2 } });
    try {
      const c = await t.create(); // 1 POST
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("a"))).status, 201); // 2
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("b"))).status, 201); // 3
      const r = await t.j("POST", `${c.url}/ops`, mk("c"));
      assert.equal(r.status, 429);
      assert.equal(r.body.error, "rate");
      assert.equal(typeof r.body.retryAfter, "number");
      assert.ok(r.body.retryAfter >= 1 && r.body.retryAfter <= 60);
      assert.equal(r.headers.get("retry-after"), String(r.body.retryAfter));
      assert.equal((await t.j("GET", `${c.url}/ops`)).status, 200);
      assert.equal((await t.j("GET", `${c.url}/ops`)).status, 200);
      assert.equal((await t.j("GET", `${c.url}/ops`)).status, 429);
    } finally {
      await t.s.close();
    }
  });
  test("rate: the window resets, and X-Forwarded-For is used only when trusted", async () => {
    let clock = 1_000_000;
    const t = await start({ rate: { get: 1 }, now: () => clock, trustProxy: true });
    try {
      const c = await t.create();
      const get = (ip) => t.j("GET", `${c.url}/ops`, undefined, { "X-Forwarded-For": ip });
      assert.equal((await get("1.1.1.1")).status, 200);
      assert.equal((await get("1.1.1.1")).status, 429);
      assert.equal((await get("2.2.2.2")).status, 200);
      clock += 61_000;
      assert.equal((await get("1.1.1.1")).status, 200);
    } finally {
      await t.s.close();
    }
    const u = await start({ rate: { get: 1 } });
    try {
      const c = await u.create();
      const get = (ip) => u.j("GET", `${c.url}/ops`, undefined, { "X-Forwarded-For": ip });
      assert.equal((await get("1.1.1.1")).status, 200);
      assert.equal((await get("2.2.2.2")).status, 429);
    } finally {
      await u.s.close();
    }
  });
  test("507 full: by bytes and by batch count; a retry of a stored batch is still 200", async () => {
    const t = await start({ maxMailboxBytes: 200, maxBatches: 3 });
    try {
      const c = await t.create();
      const a = { ...mk("a") };
      assert.equal((await t.j("POST", `${c.url}/ops`, a)).status, 201);
      const big = `pu1.${"Q".repeat(250)}`;
      const r = await t.j("POST", `${c.url}/ops`, { id: idOf(big), ct: big });
      assert.equal(r.status, 507);
      assert.equal(r.body.error, "full");
      assert.equal((await t.j("POST", `${c.url}/ops`, a)).status, 200);
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("b"))).status, 201);
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("c"))).status, 201);
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("d"))).status, 507);
    } finally {
      await t.s.close();
    }
  });
});

describe("expiry and storage", () => {
  test("a mailbox expires keepDays after its last write", async () => {
    let clock = Date.parse("2026-10-08T00:00:00Z");
    const t = await start({ keepDays: 10, now: () => clock });
    try {
      const c = await t.create();
      assert.equal(c.body.expires, "2026-10-18T00:00:00.000Z");
      clock += 9 * 864e5;
      assert.equal((await t.j("POST", `${c.url}/ops`, mk("a"))).status, 201);
      clock += 9 * 864e5;
      const g = await t.j("GET", `${c.url}/ops`);
      assert.equal(g.status, 200);
      assert.equal(g.body.expires, "2026-10-27T00:00:00.000Z");
      clock += 2 * 864e5;
      const gone = await t.j("GET", `${c.url}/ops`);
      assert.equal(gone.status, 404);
      assert.equal(gone.body.error, "gone");
    } finally {
      await t.s.close();
    }
  });
  test("keepDays 0 keeps for ever and reports null", async () => {
    const t = await start({ keepDays: 0 });
    try {
      const c = await t.create();
      assert.equal(c.body.expires, null);
      assert.equal(c.body.keep, null);
    } finally {
      await t.s.close();
    }
  });
  test("files: append-only JSON lines survive a restart; the stop key is stored hashed; DELETE removes files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mailbox-"));
    try {
      const t = await start({ memory: false, dataDir: dir, writeTokens: true });
      const c = await t.create();
      const b = mk("a");
      await t.j("POST", `${c.url}/ops`, { ...b, token: c.body.token });
      await t.s.close();
      const t2 = await start({ memory: false, dataDir: dir, writeTokens: true });
      try {
        const g = await t2.j("GET", `${c.url}/ops`);
        assert.deepEqual(g.body.batches, [b]);
        assert.equal((await t2.j("POST", `${c.url}/ops`, { ...b, token: c.body.token })).status, 200);
        assert.equal((await t2.j("POST", `${c.url}/ops`, { ...mk("z"), token: "bad" })).status, 403);
        const files = readdirSync(dir).join(" ");
        assert.ok(files.includes(`${c.body.mailbox}.jsonl`));
        const { readFileSync } = await import("node:fs");
        const stored = readFileSync(join(dir, `${c.body.mailbox}.json`), "utf8");
        assert.ok(!stored.includes(c.body.stop) && !stored.includes(c.body.token));
        assert.equal(
          (await t2.j("DELETE", c.url, undefined, { Authorization: `Bearer ${c.body.stop}` })).status,
          204,
        );
        assert.deepEqual(readdirSync(dir), []);
      } finally {
        await t2.s.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
