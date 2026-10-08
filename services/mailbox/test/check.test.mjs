import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createMailboxServer } from "../src/server.mjs";
import { runChecks } from "../src/check.mjs";

const failing = (results) => results.filter((r) => r.status === "FAIL").map((r) => r.name);

async function ref(options) {
  const s = createMailboxServer({ memory: true, ...options });
  const { port } = await s.listen(0, "127.0.0.1");
  return { s, base: `http://127.0.0.1:${port}` };
}

test("the checker passes against the reference server", async () => {
  const { s, base } = await ref();
  try {
    const results = await runChecks(base);
    assert.deepEqual(failing(results), []);
    assert.ok(results.filter((r) => r.status === "PASS").length >= 15);
    assert.equal(results.find((r) => r.name.startsWith("rate limit")).status, "PASS");
  } finally {
    await s.close();
  }
});

test("the checker passes with a create token, write tokens and a path prefix", async () => {
  const s = createMailboxServer({ memory: true, createToken: "sesame", writeTokens: true });
  const { port } = await s.listen(0, "127.0.0.1");
  try {
    const results = await runChecks(`http://localhost:${port}/pipeup/`, { createToken: "sesame" });
    assert.deepEqual(failing(results), []);
    assert.equal(results.find((r) => r.name.startsWith("write token")).status, "PASS");
    const bad = await runChecks(`http://127.0.0.1:${port}`, { createToken: "wrong" });
    assert.equal(bad[0].status, "FAIL");
  } finally {
    await s.close();
  }
});

test("a server that cannot be made to limit is skipped, not failed", async () => {
  const { s, base } = await ref({ rate: { post: 100000, get: 100000 } });
  try {
    const results = await runChecks(base);
    assert.deepEqual(failing(results), []);
    assert.equal(results.find((r) => r.name.startsWith("rate limit")).status, "SKIP");
  } finally {
    await s.close();
  }
});

test("the checker refuses http: for anything but localhost", async () => {
  await assert.rejects(runChecks("http://example.com"), /https/);
});

test("the checker fails against a deliberately broken server", async () => {
  // No CORS headers, accepts anything, never dedups, no error JSON.
  let n = 0;
  const bad = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      if (req.method === "POST" && req.url.endsWith("/m")) {
        res.writeHead(201, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "Retry-After",
        });
        return res.end(
          JSON.stringify({
            v: 1,
            mailbox: "m".repeat(22),
            stop: "s",
            token: null,
            limits: { body: 524288, mailbox: 1 },
          }),
        );
      }
      n++;
      res.writeHead(req.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ v: 1, batches: [], next: "0", more: false }));
    });
  });
  await new Promise((r) => bad.listen(0, "127.0.0.1", r));
  try {
    const results = await runChecks(`http://127.0.0.1:${bad.address().port}`);
    const names = failing(results);
    assert.ok(n > 0);
    assert.ok(names.length >= 8, `only ${names.length} failures`);
    assert.ok(names.some((x) => x.includes("idempotent")));
    assert.ok(names.some((x) => x.includes("413")));
    assert.ok(names.some((x) => x.includes("DELETE")));
  } finally {
    bad.closeAllConnections();
    await new Promise((r) => bad.close(r));
  }
});

test("a server that forgets the CORS headers on errors fails only the error checks", async () => {
  const { s, base } = await ref();
  const proxy = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await fetch(base + req.url, {
      method: req.method,
      headers: { authorization: req.headers.authorization ?? "", "content-type": "text/plain" },
      body: ["GET", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const headers = { "Content-Type": "application/json" };
    if (r.status < 400) {
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Expose-Headers"] = "Retry-After";
    }
    res.writeHead(r.status, headers);
    res.end(r.status === 204 ? undefined : await r.text());
  });
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  try {
    const results = await runChecks(`http://127.0.0.1:${proxy.address().port}`);
    const names = failing(results);
    assert.ok(names.some((x) => x.includes("400")));
    assert.ok(names.some((x) => x.includes("404")));
    assert.ok(!names.some((x) => x.includes("idempotent")));
  } finally {
    proxy.closeAllConnections();
    await new Promise((r) => proxy.close(r));
    await s.close();
  }
});
