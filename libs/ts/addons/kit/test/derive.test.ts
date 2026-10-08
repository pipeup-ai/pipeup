import { describe, expect, it } from "vitest";
import { derivedRoom, ladder } from "../src/derive";
import { toB64u } from "../src/encoding";

const S = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const DOC = "aaaaaaaaaaaaaaaa";

/** Frozen: changing the derivation strings orphans every shared copy (add-ons design §6.1). */
describe("the key ladder", () => {
  it("derives the room secret and the per-purpose addresses as frozen", async () => {
    const room = await derivedRoom(DOC, S);
    expect(toB64u(room)).toBe("zl_TihRMr4Xo7yy-MEZknmvjJcovXsYDf6Yk_bodifM");
    const l = ladder(DOC, room);
    expect(await l.addr("share")).toBe("AgGx9PyywO46igPg5T8UTw");
    expect(await l.addr("live")).toBe("0b6PgWmijhl5oG3fw4PLKQ");
    expect(await l.addr("signal")).toBe("l3hCm2aNSG63VfoBflwDyQ");
  });

  it("gives each purpose its own key, bound to the document by its additional data", async () => {
    const room = await derivedRoom(DOC, S);
    const l = ladder(DOC, room);
    const iv = new Uint8Array(12);
    const data = new TextEncoder().encode("hello");
    const enc = (p: "share" | "live", aad = l.aad(p)) =>
      crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
        ladderKey(p),
        data,
      );
    const ladderKey = (p: "share" | "live") => keys[p]!;
    const keys = { share: await l.key("share"), live: await l.key("live") };
    const a = new Uint8Array(await enc("share"));
    expect(
      Array.from(a.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe("a87d9be925438b8c");
    expect(new Uint8Array(await enc("live"))).not.toEqual(a);
    expect(l.aad("share")).toBe(`pipeup/v1/share:${DOC}`);
  });

  it("keeps keys non-extractable and addresses apart across rooms and documents", async () => {
    const room = await derivedRoom(DOC, S);
    const key = await ladder(DOC, room).key("share");
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
    const other = await derivedRoom("bbbbbbbbbbbbbbbb", S);
    expect(toB64u(other)).not.toBe(toB64u(room));
    expect(await ladder(DOC, room).addr("share")).not.toBe(
      await ladder("bbbbbbbbbbbbbbbb", other).addr("share"),
    );
  });
});
