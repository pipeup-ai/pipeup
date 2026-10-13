// The contract's own checks (pm1), runnable against any server.
import { createHash } from "node:crypto";

/**
 * @typedef {{name: string, status: "PASS" | "FAIL" | "SKIP", note?: string}} CheckResult
 */

const ctOf = (s) => `pu1.${Buffer.from(s).toString("base64url")}`;
const idOf = (ct) => createHash("sha256").update(ct).digest("base64url").slice(0, 22);
const batch = (s) => {
  const ct = ctOf(s);
  return { id: idOf(ct), ct };
};

class Fail extends Error {}
const ok = (cond, msg) => {
  if (!cond) throw new Fail(msg);
};

/**
 * @param {string} base the server's base address (no trailing slash needed)
 * @param {{createToken?: string}} [opts]
 * @returns {Promise<CheckResult[]>}
 */
export async function runChecks(base, opts = {}) {
  const u = new URL(base);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    throw new Error("The base address must be https: (http: only for localhost or 127.0.0.1).");
  }
  const root = base.replace(/\/+$/, "");
  const tag = Date.now().toString(36);

  async function call(method, url, { body, headers, raw } = {}) {
    const res = await fetch(url, {
      method,
      body,
      headers,
      credentials: "omit",
      redirect: "manual",
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    return { status: res.status, headers: res.headers, data, text: raw ? text : undefined };
  }
  const simple = (url, obj) =>
    call("POST", url, {
      body: typeof obj === "string" ? obj : JSON.stringify(obj),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });
  const corsOk = (r, what) => {
    ok(
      r.headers.get("access-control-allow-origin") === "*",
      `${what}: Access-Control-Allow-Origin must be *`,
    );
    ok(
      (r.headers.get("access-control-expose-headers") ?? "")
        .toLowerCase()
        .split(/\s*,\s*/)
        .includes("retry-after"),
      `${what}: Access-Control-Expose-Headers must include Retry-After`,
    );
    ok(
      !r.headers.has("access-control-allow-credentials"),
      `${what}: must not send Access-Control-Allow-Credentials`,
    );
  };
  const errOk = (r, status, code, what) => {
    ok(r.status === status, `${what}: expected ${status}, got ${r.status}`);
    ok(
      r.data?.v === 1 && r.data.error === code && typeof r.data.message === "string",
      `${what}: expected JSON {v:1,error:"${code}",message}`,
    );
    corsOk(r, what);
  };

  async function create() {
    const headers = { "Content-Type": "text/plain;charset=UTF-8" };
    if (opts.createToken) headers.Authorization = `Bearer ${opts.createToken}`;
    const r = await call("POST", `${root}/m`, { body: '{"v":1}', headers });
    ok(r.status === 201, `create: expected 201, got ${r.status} (is the create token right?)`);
    ok(r.data?.v === 1 && /^[A-Za-z0-9_-]{22,64}$/.test(r.data.mailbox ?? ""), "create: bad mailbox id");
    ok(typeof r.data.stop === "string" && r.data.stop.length > 0, "create: missing stop key");
    ok(r.data.limits && r.data.limits.body >= 524288, "create: limits.body must be at least 524288");
    corsOk(r, "create");
    return {
      id: r.data.mailbox,
      stop: r.data.stop,
      token: r.data.token ?? undefined,
      url: `${root}/m/${r.data.mailbox}`,
    };
  }

  /** @type {CheckResult[]} */
  const results = [];
  const run = async (name, fn) => {
    try {
      const note = await fn();
      results.push(
        typeof note === "string" && note.startsWith("skip:")
          ? { name, status: "SKIP", note: note.slice(5).trim() }
          : { name, status: "PASS" },
      );
    } catch (e) {
      results.push({
        name,
        status: "FAIL",
        note: e instanceof Fail ? e.message : `${e?.cause?.code ?? ""} ${e?.message ?? e}`.trim(),
      });
    }
  };

  let a;
  let rateBox;
  await run("create a mailbox (POST <base>/m)", async () => {
    a = await create();
    rateBox = await create();
  });
  if (!a) return results;
  const post = (b, extra = {}) =>
    simple(`${a.url}/ops`, { ...b, ...(a.token ? { token: a.token } : {}), ...extra });
  const b1 = batch(`one-${tag}`);
  const b2 = batch(`two-${tag}`);
  const b3 = batch(`three-${tag}`);
  const get = (since) =>
    call("GET", `${a.url}/ops${since === undefined ? "" : `?since=${encodeURIComponent(since)}`}`, {
      headers: { Accept: "application/json" },
    });

  await run("OPTIONS answers 204 with methods, headers and max-age", async () => {
    const r = await call("OPTIONS", `${a.url}/ops`);
    ok(r.status === 204, `expected 204, got ${r.status}`);
    ok(
      /GET/.test(r.headers.get("access-control-allow-methods") ?? "") &&
        /POST/.test(r.headers.get("access-control-allow-methods") ?? ""),
      "Allow-Methods must list GET and POST",
    );
    ok(
      /content-type/i.test(r.headers.get("access-control-allow-headers") ?? ""),
      "Allow-Headers must list Content-Type",
    );
    ok(r.headers.has("access-control-max-age"), "Max-Age missing");
    corsOk(r, "OPTIONS");
  });
  await run("empty mailbox: GET answers the contract shape with CORS headers", async () => {
    const r = await get();
    ok(r.status === 200 && r.data?.v === 1, `expected 200 {v:1}, got ${r.status}`);
    ok(Array.isArray(r.data.batches) && r.data.batches.length === 0, "batches must be an empty array");
    ok(
      typeof r.data.next === "string" && r.data.next.length <= 64 && /^[\x20-\x7e]*$/.test(r.data.next),
      "next must be printable ASCII, 64 characters at most",
    );
    ok(typeof r.data.more === "boolean", "more must be a boolean");
    corsOk(r, "GET");
  });
  await run("simple-request POST (text/plain body) appends: 201", async () => {
    const r = await post(b1);
    ok(r.status === 201 && r.data?.v === 1, `expected 201 {v:1}, got ${r.status}`);
    corsOk(r, "POST");
  });
  await run("the same POST again is idempotent: 200", async () => {
    const r = await post(b1);
    ok(r.status === 200 && r.data?.v === 1, `expected 200 {v:1}, got ${r.status}`);
    const g = await get();
    ok(g.data.batches.filter((x) => x.id === b1.id).length === 1, "the retried batch was stored twice");
  });
  await run("id that does not match ct is refused: 400 bad-request", async () => {
    errOk(await post({ id: b2.id, ct: b3.ct }), 400, "bad-request", "id mismatch");
  });
  await run("invalid JSON and a bad ct are refused: 400 bad-request", async () => {
    errOk(await simple(`${a.url}/ops`, "{nope"), 400, "bad-request", "bad JSON");
    errOk(await post({ id: idOf("x"), ct: "x" }), 400, "bad-request", "bad ct");
  });
  await run("cursors page forward without skipping or repeating", async () => {
    ok((await post(b2)).status === 201, "second POST failed");
    ok((await post(b3)).status === 201, "third POST failed");
    const first = await get();
    ok(
      first.data.batches.map((x) => x.id).join() === [b1.id, b2.id, b3.id].join(),
      "batches must come oldest first, each once",
    );
    const again = await get(first.data.next);
    ok(again.status === 200 && again.data.batches.length === 0, "since=next must return nothing new");
    const mid = await get("1");
    const viaCursor = [];
    let since = "";
    for (let i = 0; i < 20; i++) {
      const r = await get(since);
      ok(r.status === 200, `GET since=${since} gave ${r.status}`);
      viaCursor.push(...r.data.batches.map((x) => x.id));
      since = r.data.next;
      if (!r.data.more) break;
    }
    ok(
      viaCursor.join() === [b1.id, b2.id, b3.id].join(),
      "following next while more is true must reach every batch once",
    );
    ok(mid.status === 200 || mid.status === 409, "an arbitrary cursor must answer 200 or 409");
    const b4 = batch(`four-${tag}`);
    ok((await post(b4)).status === 201, "fourth POST failed");
    const later = await get(first.data.next);
    ok(
      later.data.batches.map((x) => x.id).join() === b4.id,
      "a batch committed after a cursor must be returned by since=cursor",
    );
  });
  await run("unknown cursor: 409 cursor", async () => {
    errOk(await get("zzzz-not-a-cursor"), 409, "cursor", "unknown cursor");
  });
  await run("body over 512 KiB: 413 too-large", async () => {
    const ct = `pu1.${"A".repeat(524288)}`;
    errOk(
      await simple(`${a.url}/ops`, { id: idOf(ct), ct, ...(a.token ? { token: a.token } : {}) }),
      413,
      "too-large",
      "oversized body",
    );
  });
  await run("a body just under the limit is accepted", async () => {
    const ct = `pu1.${"B".repeat(524288 - 400)}`;
    const r = await post({ id: idOf(ct), ct });
    ok(r.status === 201, `expected 201, got ${r.status}`);
  });
  await run("unknown mailbox: 404 gone, with CORS headers", async () => {
    errOk(
      await call("GET", `${root}/m/${"x".repeat(22)}/ops`, { headers: { Accept: "application/json" } }),
      404,
      "gone",
      "unknown mailbox",
    );
  });
  await run("write token: a POST without it is refused (403 token)", async () => {
    if (!a.token) return "skip: this server does not issue write tokens";
    errOk(await simple(`${a.url}/ops`, batch(`tok-${tag}`)), 403, "token", "missing write token");
    errOk(
      await simple(`${a.url}/ops`, { ...batch(`tok-${tag}`), token: "wrong" }),
      403,
      "token",
      "wrong write token",
    );
    return undefined;
  });
  await run("DELETE with a wrong stop key: 403 token", async () => {
    errOk(
      await call("DELETE", a.url, { headers: { Authorization: "Bearer wrong" } }),
      403,
      "token",
      "wrong stop key",
    );
  });
  await run("DELETE with the stop key: 204, then every request answers 404", async () => {
    const d = await call("DELETE", a.url, { headers: { Authorization: `Bearer ${a.stop}` } });
    ok(d.status === 204, `expected 204, got ${d.status}`);
    corsOk(d, "DELETE");
    errOk(await get(), 404, "gone", "GET after DELETE");
    errOk(await post(batch(`after-${tag}`)), 404, "gone", "POST after DELETE");
  });
  await run("rate limit: 429 with Retry-After header, retryAfter in the body, readable", async () => {
    if (!rateBox) return "skip: no second mailbox";
    const b = batch(`rate-${tag}`);
    const body = JSON.stringify({ ...b, ...(rateBox.token ? { token: rateBox.token } : {}) });
    for (let i = 0; i < 80; i++) {
      const r = await call("POST", `${rateBox.url}/ops`, {
        body,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
      });
      if (r.status === 429) {
        errOk(r, 429, "rate", "429");
        const h = Number(r.headers.get("retry-after"));
        ok(Number.isFinite(h) && h >= 0, "Retry-After header must be a number of seconds");
        ok(typeof r.data.retryAfter === "number", "retryAfter in the body must be a number");
        return undefined;
      }
      ok(r.status === 200 || r.status === 201, `unexpected ${r.status} while probing the rate limit`);
    }
    return "skip: the server did not limit 80 POSTs in a row";
  });
  if (rateBox)
    await call("DELETE", rateBox.url, { headers: { Authorization: `Bearer ${rateBox.stop}` } }).catch(
      () => {},
    );
  return results;
}
