/**
 * A portable identity: an Ed25519 key made from a 32-byte seed the reviewer can keep as a recovery code. Pipeup's
 * ordinary identity is never exportable (its key can't leave the browser); only one made here can be, because the person
 * chose to make it portable.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PREFIX = "PU1";
/** Checksum characters at the end of the code: they catch a mistyped or misread code. */
const CHECK = 4;
// The fixed start of an Ed25519 private key in PKCS #8, before its 32-byte seed.
const PKCS8 = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

function unbase32(text: string): Uint8Array | null {
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const c of text) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** A few characters from the seed, so a code with a mistake is noticed before it is used. */
function check(seed: Uint8Array): string {
  let x = 0x811c9dc5;
  for (const b of seed) x = Math.imul(x ^ b, 0x01000193);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  let out = "";
  for (let i = 0; i < CHECK; i++, x >>>= 5) out += ALPHABET[x & 31];
  return out;
}

/** The code for a seed, written to be read and typed: `PU1-XXXX-XXXX-…`. */
export function codeOf(seed: Uint8Array): string {
  const body = (base32(seed) + check(seed)).match(/.{1,4}/g)!.join("-");
  return `${PREFIX}-${body}`;
}

/** The private key a seed stands for: extractable, so it can be backed up again later. */
export function keyOf(seed: Uint8Array): Promise<CryptoKey> {
  const pkcs8 = new Uint8Array(PKCS8.length + seed.length);
  pkcs8.set(PKCS8);
  pkcs8.set(seed, PKCS8.length);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
}

/** A new identity the reviewer can back up, and its recovery code. */
export async function makePortable(): Promise<{ key: CryptoKey; code: string }> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  return { key: await keyOf(seed), code: codeOf(seed) };
}

export type CodeProblem = "shape" | "mistake";

/** The key a recovery code stands for, or what is wrong with the code, in a word the dialog turns into a sentence. */
export async function keyFromCode(text: string): Promise<{ key: CryptoKey } | { problem: CodeProblem }> {
  const clean = text.toUpperCase().replace(/[\s-]+/g, "");
  if (!clean.startsWith(PREFIX) || clean.length !== PREFIX.length + 52 + CHECK) return { problem: "shape" };
  // Letters that look like others are read as the ones the code uses (O is 0, I and L are 1, U is V).
  const body = clean.slice(PREFIX.length).replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  const seed = unbase32(body.slice(0, 52));
  if (!seed || seed.length < 32) return { problem: "shape" };
  const bytes = seed.slice(0, 32);
  if (check(bytes) !== body.slice(52) || base32(bytes) !== body.slice(0, 52)) return { problem: "mistake" };
  return { key: await keyOf(bytes) };
}
