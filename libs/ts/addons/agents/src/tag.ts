/** Replies a shell link tagged with this session's key: HMAC-SHA256 of the block's words, in hex (as `openssl dgst -hmac` prints it). */
const HEX = /^[0-9a-f]{64}$/;
const utf8 = (s: string) => new TextEncoder().encode(s);

export async function taggedBy(key: string, text: string, tag: string): Promise<boolean> {
  if (!key || !HEX.test(tag)) return false;
  const k = await crypto.subtle.importKey("raw", utf8(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const sig = Uint8Array.from(tag.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", k, sig, utf8(text));
}
