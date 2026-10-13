import { RetryAfter } from "@pipeup/kit";
import { describe, expect, it } from "vitest";
import { createPaste, deletePaste, PrivateBin, readPaste } from "../src/privatebin";
import { anchor, L, reviewer } from "./helpers";

/**
 * Against a real PrivateBin instance, such as the official Docker image:
 *   docker run -d -p 8080:8080 privatebin/nginx-fpm-alpine
 *   PRIVATEBIN_URL=http://localhost:8080/ npx vitest run share/test/privatebin.integration
 * Skipped unless PRIVATEBIN_URL is set. Never point it at a public instance from CI (add-ons design §17).
 */
const URL_ = process.env.PRIVATEBIN_URL;
const base = URL_ ? new URL(URL_).origin + new URL(URL_).pathname : "";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!URL_)("a real PrivateBin instance", () => {
  const f: typeof fetch = (i, n) => fetch(i, n);

  it("makes a paste with discussions on, reads it back with its retention, and takes Pipeup's comments", async () => {
    const made = await createPaste(f, base, L, "1week");
    try {
      const back = await readPaste(f, base, made.id);
      expect(back, "the paste can be read back as JSON").not.toBeNull();
      expect(back!.ttl === null || back!.ttl > 0).toBe(true);

      const sam = await reviewer("Sam");
      await sam.comment(anchor, "Hello from the integration test");
      const a = new PrivateBin({ base, paste: made.id }, L, f);
      await wait(11_500); // PrivateBin allows one post per address every 10 seconds, counted in whole seconds
      await a.post(sam.ops());

      const b = new PrivateBin({ base, paste: made.id }, L, f);
      const got = await b.read();
      expect(got.flatMap((g) => g.ops)).toHaveLength(1);
      expect(b.ids.size).toBe(1);
      expect(await b.read()).toEqual([]);

      // Posting again at once is 'please wait' (HTTP 200, status 1): a RetryAfter, never an error.
      await expect(a.post(sam.ops())).rejects.toBeInstanceOf(RetryAfter);
    } finally {
      await wait(11_500);
      const res = await deletePaste(f, base, made.id, made.deleteToken);
      expect(((await res.json()) as { status: number }).status).toBe(0);
    }
    expect(await readPaste(f, base, made.id)).toBeNull();
  }, 60_000);

  it("a paste asked for 'never' reports no end, or the instance's own default", async () => {
    const made = await createPaste(f, base, L, "never");
    try {
      const back = await readPaste(f, base, made.id);
      expect(back).not.toBeNull();
      // Either unlimited (null) or silently the instance's default: both are what the command line reports in words.
      console.log(
        "time_to_live:",
        back!.ttl === null ? "none (kept until deleted)" : `${Math.round(back!.ttl / 1000)} s`,
      );
    } finally {
      await wait(11_500);
      await deletePaste(f, base, made.id, made.deleteToken);
    }
  }, 60_000);

  it("rolls over to a new generation that a reader from the file's address follows", async () => {
    await wait(11_500);
    const made = await createPaste(f, base, L, "1week");
    const sam = await reviewer("Sam");
    await sam.comment(anchor, "Before the rollover");
    const a = new PrivateBin({ base, paste: made.id }, L, f);
    await a.roll(sam.ops());
    expect(a.head).not.toBe(made.id);
    const fresh = new PrivateBin({ base, paste: made.id }, L, f);
    const got = await fresh.read();
    expect(fresh.head).toBe(a.head);
    expect(got.flatMap((g) => g.ops).length).toBeGreaterThanOrEqual(1);
    await wait(11_500);
    await deletePaste(f, base, made.id, made.deleteToken);
  }, 120_000);
});
