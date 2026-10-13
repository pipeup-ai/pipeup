import { toHex } from "./encoding";
/**
 * Pipeup's own minimal BIP-340 Schnorr signer over secp256k1: signing only, for the throwaway keys that sign
 * Nostr meeting-point events (add-ons design §9.1). WebCrypto does the hashing, BigInt the curve. Not
 * constant-time, which is fine for a key that lives one session and signs only sealed meeting-point messages.
 */
type Point = [bigint, bigint, bigint];

const P = 2n ** 256n - 2n ** 32n - 977n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
const ZERO: Point = [0n, 1n, 0n];

const mod = (a: bigint, m = P) => ((a % m) + m) % m;

/** Modular inverse by Fermat (the moduli are prime). */
function inv(a: bigint, m = P): bigint {
  let r = 1n;
  a = mod(a, m);
  for (let e = m - 2n; e > 0n; e >>= 1n, a = (a * a) % m) if (e & 1n) r = (r * a) % m;
  return r;
}

// Jacobian coordinates; Z = 0 is the point at infinity.
function dbl([x, y, z]: Point): Point {
  if (!z || !y) return ZERO;
  const s = mod(4n * x * y * y);
  const m = mod(3n * x * x);
  const x3 = mod(m * m - 2n * s);
  return [x3, mod(m * (s - x3) - 8n * y ** 4n), mod(2n * y * z)];
}

function add(a: Point, b: Point): Point {
  if (!a[2]) return b;
  if (!b[2]) return a;
  const z1 = mod(a[2] * a[2]);
  const z2 = mod(b[2] * b[2]);
  const u1 = mod(a[0] * z2);
  const u2 = mod(b[0] * z1);
  const s1 = mod(a[1] * b[2] * z2);
  const s2 = mod(b[1] * a[2] * z1);
  if (u1 === u2) return s1 === s2 ? dbl(a) : ZERO;
  const h = mod(u2 - u1);
  const r = mod(s2 - s1);
  const hh = mod(h * h);
  const hhh = mod(h * hh);
  const x3 = mod(r * r - hhh - 2n * u1 * hh);
  return [x3, mod(r * (u1 * hh - x3) - s1 * hhh), mod(h * a[2] * b[2])];
}

function mulG(k: bigint): [bigint, bigint] {
  let r = ZERO;
  let q: Point = [GX, GY, 1n];
  for (; k > 0n; k >>= 1n) {
    if (k & 1n) r = add(r, q);
    q = dbl(q);
  }
  const zi = inv(r[2]);
  const zi2 = mod(zi * zi);
  return [mod(r[0] * zi2), mod(r[1] * zi2 * zi)];
}

const big = (b: Uint8Array) => BigInt("0x" + (toHex(b) || "0"));
const bytes = (n: bigint) =>
  Uint8Array.from(n.toString(16).padStart(64, "0").match(/../g)!, (h) => parseInt(h, 16));
const cat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of a) {
    out.set(x, i);
    i += x.length;
  }
  return out;
};
const sha = async (b: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>));
const tagged = async (tag: string, ...m: Uint8Array[]) => {
  const t = await sha(new TextEncoder().encode(tag));
  return sha(cat(t, t, ...m));
};

/** The x-only public key (32 bytes) of a 32-byte secret key. */
export const publicKey = (sk: Uint8Array): Uint8Array => bytes(mulG(big(sk))[0]);

/** A BIP-340 signature (64 bytes) of `msg` with `sk` and 32 bytes of auxiliary randomness. */
export async function sign(
  msg: Uint8Array,
  sk: Uint8Array,
  aux: Uint8Array = crypto.getRandomValues(new Uint8Array(32)),
): Promise<Uint8Array> {
  const d0 = big(sk);
  if (d0 < 1n || d0 >= N) throw new Error("bad secret key");
  const p = mulG(d0);
  const d = p[1] & 1n ? N - d0 : d0;
  const px = bytes(p[0]);
  const t = bytes(d ^ big(await tagged("BIP0340/aux", aux)));
  const k0 = mod(big(await tagged("BIP0340/nonce", t, px, msg)), N);
  if (!k0) throw new Error("bad nonce");
  const r = mulG(k0);
  const k = r[1] & 1n ? N - k0 : k0;
  const rx = bytes(r[0]);
  const e = mod(big(await tagged("BIP0340/challenge", rx, px, msg)), N);
  return cat(rx, bytes(mod(k + e * d, N)));
}
