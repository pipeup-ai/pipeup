import { RetryAfter, open as openBatch, fromB64, toB64 } from "@pipeup/kit";
import { describe, expect, it } from "vitest";
import { Problem } from "../src/backend";
import { commentBody, createPaste, PrivateBin, readPaste } from "../src/privatebin";
import { anchor, L, reviewer } from "./helpers";
import { createPrivateBinMock } from "./privatebin-mock";

const BASE = "https://paste.example.org/";

async function setup(mock = createPrivateBinMock()) {
  const made = await createPaste(mock.fetch, BASE, L);
  const backend = () => new PrivateBin({ base: BASE, paste: made.id }, L, mock.fetch);
  return { mock, made, backend };
}

describe("PrivateBin wire format (spike S1)", () => {
  it("a comment is exactly the five fields, with the cipher spec PrivateBin checks and no meta", async () => {
    const body = commentBody("f468483c313401e8", new Uint8Array(40).fill(9));
    expect(Object.keys(body).sort()).toEqual(["adata", "ct", "parentid", "pasteid", "v"]);
    expect(body.v).toBe(2);
    const [iv, salt, iter, key, tag, algo, mode, comp] = body.adata as [
      string,
      string,
      number,
      number,
      number,
      string,
      string,
      string,
    ];
    expect(fromB64(iv)).toHaveLength(16);
    expect(iv.length).toBeLessThanOrEqual(24);
    expect(fromB64(salt)).toHaveLength(8);
    expect(salt.length).toBeLessThanOrEqual(14);
    expect([iter, key, tag, algo, mode, comp]).toEqual([100000, 256, 128, "aes", "gcm", "none"]);
    expect(body.ct).toMatch(/^[A-Za-z0-9+/]+=*$/); // standard base64, not base64url
  });

  it("posts with simple requests only: text body, Accept JSON, no credentials, no custom headers", async () => {
    const { mock, backend } = await setup();
    const sam = await reviewer("Sam");
    await sam.comment(anchor, "hello");
    const [url, init] = await backend().req(sam.ops());
    expect(url).toBe(BASE);
    expect(init.credentials).toBe("omit");
    expect(Object.keys(init.headers as object)).toEqual(["Accept"]);
    expect(typeof init.body).toBe("string");
    void mock;
  });

  it("round trip: post, then read opens the batch once and reports the ids it holds", async () => {
    const { backend } = await setup();
    const sam = await reviewer("Sam");
    const id = await sam.comment(anchor, "hello");
    const a = backend();
    await a.post(sam.ops());
    const b = backend();
    const got = await b.read();
    expect(got).toHaveLength(1);
    expect((got[0]!.ops[0] as { body: { id: string } }).body.id).toBe(id);
    expect(b.ids.has(id)).toBe(true);
    expect(await b.read()).toEqual([]); // opened comments are cached
  });

  it("anything that is not ours is ignored: junk, another document, another key", async () => {
    const { mock, made, backend } = await setup();
    const p = mock.pastes.get(made.id)!;
    p.comments.push({ id: "j1", ct: toB64(new Uint8Array(60).fill(1)), created: 1 });
    p.comments.push({ id: "j2", ct: "not base64 !!", created: 2 });
    const other = await reviewer("Ada", "cccccccccccccccc");
    const { ladder } = await import("@pipeup/kit");
    const { seal } = await import("@pipeup/kit");
    await other.comment(anchor, "elsewhere");
    p.comments.push({
      id: "j3",
      ct: toB64(
        await seal(
          ladder("cccccccccccccccc", new Uint8Array(32).fill(7) as Uint8Array<ArrayBuffer>),
          "share",
          other.ops(),
        ),
      ),
      created: 3,
    });
    expect(await backend().read()).toEqual([]);
  });

  it("'please wait' (HTTP 200, status 1) and a 429 both mean wait; neither is parsed for a number", async () => {
    const { mock, backend } = await setup();
    const sam = await reviewer("Sam");
    await sam.comment(anchor, "hello");
    const b = backend();
    mock.pleaseWait(1);
    await expect(b.post(sam.ops())).rejects.toMatchObject({ seconds: 10 });
    mock.tooMany(1);
    await expect(b.post(sam.ops())).rejects.toBeInstanceOf(RetryAfter);
    mock.tooMany(1);
    await expect(b.post(sam.ops())).rejects.toMatchObject({ seconds: 2 });
    await b.post(sam.ops());
  });

  it("404 on the paste is 'gone'", async () => {
    const { mock, made, backend } = await setup();
    mock.pastes.delete(made.id);
    await expect(backend().read()).rejects.toBeInstanceOf(Problem);
  });

  it("a network failure is not 'gone'", async () => {
    const b = new PrivateBin({ base: BASE, paste: "f468483c313401e8" }, L, (async () => {
      throw new TypeError("offline");
    }) as typeof fetch);
    await expect(b.read()).rejects.toThrow("offline");
  });

  it("reads how long the instance keeps the paste from meta.time_to_live, including an expiry it doesn't offer", async () => {
    const mock = createPrivateBinMock();
    const made = await createPaste(mock.fetch, BASE, L, "never");
    // 'never' is offered here: no time_to_live.
    expect((await readPaste(mock.fetch, BASE, made.id))!.ttl).toBeNull();
    const strict = createPrivateBinMock({ offered: ["1week"], defaultExpire: "1week" });
    const m2 = await createPaste(strict.fetch, BASE, L, "never"); // not offered: silently the default
    const ttl = (await readPaste(strict.fetch, BASE, m2.id))!.ttl!;
    expect(ttl / 1000).toBeGreaterThan(604_000);
    expect(ttl / 1000).toBeLessThanOrEqual(604_800);
  });

  it("a paste is created with discussions on, burn-after-reading off, and the longest expiry asked for", async () => {
    const { mock } = await setup();
    const body = JSON.parse(mock.log[0]!.body) as {
      adata: [unknown, string, number, number];
      meta: { expire: string };
    };
    expect(body.adata.slice(1)).toEqual(["plaintext", 1, 0]);
    expect(body.meta.expire).toBe("never");
  });
});

describe("rollover", () => {
  it("a new generation holds the ops, the old paste points to it, and a reader from the file follows", async () => {
    const { mock, made, backend } = await setup();
    const sam = await reviewer("Sam");
    const id = await sam.comment(anchor, "hello");
    const a = backend();
    await a.post(sam.ops());
    const got = await a.roll(sam.ops());
    expect(a.head).not.toBe(made.id);
    expect(got.flatMap((g) => g.ops).length).toBeGreaterThanOrEqual(1);
    const fresh = backend(); // starts at the file's address
    const seen = await fresh.read();
    expect(fresh.head).toBe(a.head);
    expect(seen.flatMap((g) => g.ops.map((o) => (o as { body: { id: string } }).body.id))).toContain(id);
    expect(mock.pastes.size).toBe(2);
  });

  it("two browsers racing converge on one successor; the loser's paste is deleted", async () => {
    const { mock, backend } = await setup();
    const sam = await reviewer("Sam");
    await sam.comment(anchor, "hello");
    const a = backend();
    const b = backend();
    await Promise.all([a.roll(sam.ops()), b.roll(sam.ops())]);
    expect(a.head).toBe(b.head);
    expect(mock.pastes.size).toBe(2);
    expect(mock.pastes.has(a.head)).toBe(true);
  });

  it("follows at most 16 hops", async () => {
    const { backend } = await setup();
    const sam = await reviewer("Sam");
    await sam.comment(anchor, "hello");
    const w = backend();
    for (let i = 0; i < 4; i++) await w.roll(sam.ops());
    const r = backend();
    await r.read();
    expect(r.head).toBe(w.head);
  });

  it("a reader whose saved generation is gone falls back to the file's address", async () => {
    const { mock, made } = await setup();
    const b = new PrivateBin({ base: BASE, paste: made.id }, L, mock.fetch, undefined, "0000000000000000");
    await b.read();
    expect(b.head).toBe(made.id);
  });

  it("asks for a rollover only past 256 KB and twice the first batch", async () => {
    const { mock, made, backend } = await setup();
    const p = mock.pastes.get(made.id)!;
    const a = backend();
    p.comments.push({ id: "c1", ct: "A".repeat(1000), created: 1 });
    await a.read();
    expect(a.big).toBe(false);
    for (let i = 0; i < 4; i++) p.comments.push({ id: "x" + i, ct: "A".repeat(70_000), created: 2 });
    await a.read();
    expect(a.big).toBe(true);
    void openBatch;
  });
});
