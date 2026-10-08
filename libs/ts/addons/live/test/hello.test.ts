import { describe, expect, it } from "vitest";
import { toB64u } from "@pipeup/kit";
import { checkHello, fingerprintOf, helloData } from "../src/session";

const FP = "AB:CD:EF:01:23";
const TOPIC = "topic-address";

/** A reviewer identity the way the core makes one, and `host.sign("hello", …)` as the core signs it. */
async function reviewer() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const author = toB64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const sign = async (data: string) =>
    toB64u(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          pair.privateKey,
          new TextEncoder().encode(`pipeup:live/hello\n${data}`),
        ),
      ),
    );
  return { author, sign };
}

describe("hello", () => {
  it("takes the fingerprint from a session description", () => {
    expect(fingerprintOf("v=0\r\na=fingerprint:sha-256 ab:cd:ef\r\n")).toBe("AB:CD:EF");
    expect(fingerprintOf(undefined)).toBe("");
  });

  it("accepts a hello signed by its author for this connection", async () => {
    const r = await reviewer();
    const sig = await r.sign(helloData(TOPIC, "sess1234", FP));
    const hello = { t: "hello", author: r.author, session: "sess1234", fingerprint: FP, sig };
    expect(await checkHello(hello, TOPIC, "sess1234", FP)).toBe(r.author);
  });

  it("rejects a forged hello: another author's key, a tampered signature, another connection", async () => {
    const r = await reviewer();
    const other = await reviewer();
    const sig = await r.sign(helloData(TOPIC, "sess1234", FP));
    const good = { t: "hello", author: r.author, session: "sess1234", fingerprint: FP, sig };
    // Claims someone else's key with its own signature.
    expect(await checkHello({ ...good, author: other.author }, TOPIC, "sess1234", FP)).toBeNull();
    // A damaged signature.
    expect(
      await checkHello({ ...good, sig: sig.split("").reverse().join("") }, TOPIC, "sess1234", FP),
    ).toBeNull();
    // Replayed on a connection with another fingerprint (a peer in the middle), another session, another room.
    expect(await checkHello(good, TOPIC, "sess1234", "00:11")).toBeNull();
    expect(await checkHello({ ...good, fingerprint: "00:11" }, TOPIC, "sess1234", "00:11")).toBeNull();
    expect(await checkHello(good, TOPIC, "other123", FP)).toBeNull();
    expect(await checkHello(good, "another-room", "sess1234", FP)).toBeNull();
    // Not a hello, or missing parts, or no fingerprint to compare to.
    expect(await checkHello({ ...good, t: "p" }, TOPIC, "sess1234", FP)).toBeNull();
    expect(await checkHello({ t: "hello" }, TOPIC, "sess1234", FP)).toBeNull();
    expect(await checkHello(good, TOPIC, "sess1234", "")).toBeNull();
    expect(await checkHello(null, TOPIC, "sess1234", FP)).toBeNull();
    expect(await checkHello({ ...good, author: "short" }, TOPIC, "sess1234", FP)).toBeNull();
  });

  it("does not accept an op-style signature as a hello (different signed text)", async () => {
    const r = await reviewer();
    const pair = await r.sign(`${TOPIC}:sess1234:${FP}`);
    // The signer above adds the live/hello prefix; a signature made for another purpose must not verify.
    const wrong = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign"])) as CryptoKeyPair;
    const sig = toB64u(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          wrong.privateKey,
          new TextEncoder().encode("pipeup:share/x\ndata"),
        ),
      ),
    );
    expect(pair.length).toBeGreaterThan(40);
    expect(
      await checkHello(
        { t: "hello", author: r.author, session: "sess1234", fingerprint: FP, sig },
        TOPIC,
        "sess1234",
        FP,
      ),
    ).toBeNull();
  });
});
