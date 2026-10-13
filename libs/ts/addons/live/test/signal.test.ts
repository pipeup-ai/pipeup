import { derivedRoom, ladder, randomBytes } from "@pipeup/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRelay, type TestRelay } from "../../kit/test/relay.mjs";
import { DEFAULT_RELAYS, KIND, meet, relayList } from "../src/signal";

let relay: TestRelay;
beforeAll(async () => {
  relay = await startRelay();
});
afterAll(async () => {
  await relay.close();
});

const room = async (docId = "doc") => ladder(docId, await derivedRoom(docId, randomBytes(32)));
const until = async (fn: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
  return fn();
};

describe("the relay client against the test relay", () => {
  it("two people in one room hear each other, sealed, signed by a throwaway key", async () => {
    const l = await room();
    const ac = new AbortController();
    const heardA: unknown[] = [];
    const heardB: unknown[] = [];
    const a = await meet([relay.url], l, ac.signal, (m) => heardA.push(m));
    const b = await meet([relay.url], l, ac.signal, (m) => heardB.push(m));
    expect(await until(() => a.open() === 1 && b.open() === 1)).toBe(true);
    await a.post({ t: "here", s: "aaaaaaaa" });
    expect(await until(() => heardB.length === 1)).toBe(true);
    expect(heardB[0]).toEqual({ t: "here", s: "aaaaaaaa" });
    // Not heard by the sender itself.
    expect(heardA).toEqual([]);
    const e = relay.events.at(-1)!;
    expect(e.kind).toBe(KIND);
    expect(e.content).toMatch(/^pu1\./);
    expect(e.content).not.toContain("here");
    expect(e.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(e.tags[0]![0]).toBe("t");
    ac.abort();
  });

  it("another room's messages are never delivered, and a forged one for ours does not open", async () => {
    const ours = await room("doc");
    const theirs = await room("doc");
    const ac = new AbortController();
    const heard: unknown[] = [];
    const a = await meet([relay.url], ours, ac.signal, (m) => heard.push(m));
    const other = await meet([relay.url], theirs, ac.signal, () => {});
    const sender = await meet([relay.url], ours, ac.signal, () => {});
    await until(() => a.open() === 1 && other.open() === 1 && sender.open() === 1);
    await other.post({ t: "here", s: "bbbbbbbb" });
    // Same address tag but sealed with the wrong key: a raw event posted by a client that doesn't hold the room key.
    const ws = new WebSocket(relay.url);
    await new Promise((r) => (ws.onopen = r));
    const addr = await ours.addr("signal");
    ws.send(
      JSON.stringify([
        "EVENT",
        {
          id: "f".repeat(64),
          pubkey: "e".repeat(64),
          created_at: Math.floor(Date.now() / 1000),
          kind: KIND,
          tags: [["t", addr]],
          content: "pu1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          sig: "0".repeat(128),
        },
      ]),
    );
    await sender.post({ t: "here", s: "cccccccc" });
    expect(await until(() => heard.length === 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    expect(heard).toEqual([{ t: "here", s: "cccccccc" }]);
    ws.close();
    ac.abort();
  });

  it("ignores events older than 30 seconds", async () => {
    const l = await room();
    const ac = new AbortController();
    const heard: unknown[] = [];
    const a = await meet([relay.url], l, ac.signal, (m) => heard.push(m));
    await until(() => a.open() === 1);
    // An old but accepted-by-the-relay event (45 s old) from a client holding the key.
    const { sealJson, toText } = await import("@pipeup/kit");
    const ws = new WebSocket(relay.url);
    await new Promise((r) => (ws.onopen = r));
    const content = toText(await sealJson(l, "signal", { t: "offer", s: "dddddddd" }));
    ws.send(
      JSON.stringify([
        "EVENT",
        {
          id: "a".repeat(64),
          pubkey: "d".repeat(64),
          created_at: Math.floor(Date.now() / 1000) - 45,
          kind: KIND,
          tags: [["t", await l.addr("signal")]],
          content,
          sig: "0".repeat(128),
        },
      ]),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(heard).toEqual([]);
    ws.close();
    ac.abort();
  });

  it("works with any subset of the relays, and reconnects when one drops", async () => {
    const l = await room();
    const ac = new AbortController();
    const heard: unknown[] = [];
    // The first relay address refuses connections.
    const dead = "ws://127.0.0.1:1";
    const a = await meet([dead, relay.url], l, ac.signal, (m) => heard.push(m));
    const b = await meet([relay.url, dead], l, ac.signal, () => {});
    expect(await until(() => a.open() === 1 && b.open() === 1)).toBe(true);
    relay.dropAll();
    expect(await until(() => a.open() === 0)).toBe(true);
    // Back after a growing wait (first retry after about a second).
    expect(await until(() => a.open() === 1 && b.open() === 1, 8000)).toBe(true);
    await b.post({ t: "here", s: "eeeeeeee" });
    expect(await until(() => heard.length === 1)).toBe(true);
    ac.abort();
    expect(await until(() => a.open() === 0)).toBe(true);
  });
});

describe("relay list", () => {
  it("defaults to three public relays and keeps only wss: (or local ws:) addresses", () => {
    expect(relayList(null)).toEqual(DEFAULT_RELAYS);
    expect(DEFAULT_RELAYS).toHaveLength(3);
    expect(
      relayList("wss://a.example, ws://evil.example, https://x.example, ws://127.0.0.1:9, ws://localhost"),
    ).toEqual(["wss://a.example", "ws://127.0.0.1:9", "ws://localhost"]);
    expect(relayList("junk, ws://example.org")).toEqual(DEFAULT_RELAYS);
  });
});
