import { fromB64u, toB64u } from "../util/encoding";

/** A reviewer's signing identity. The private key cannot be exported and never leaves the browser. */
export interface Identity {
  publicKey: string;
  privateKey: CryptoKey;
}

const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/;
const MAX_KEYS = 512;
const verifyKeys = new Map<string, Promise<CryptoKey>>();

/** For tests: how many imported verify keys are cached. */
export const verifyKeyCacheSize = (): number => verifyKeys.size;

export async function createIdentity(): Promise<Identity> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { publicKey: toB64u(raw), privateKey: pair.privateKey };
}

export async function sign(identity: Identity, data: Uint8Array<ArrayBuffer>): Promise<string> {
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, data);
  return toB64u(new Uint8Array(sig));
}

export async function verify(
  publicKey: string,
  data: Uint8Array<ArrayBuffer>,
  signature: string,
): Promise<boolean> {
  if (!PUBLIC_KEY.test(publicKey)) return false;
  try {
    // Only the canonical spelling: a last character with non-zero padding bits aliases the same key.
    if (toB64u(fromB64u(publicKey)) !== publicKey) return false;
    let key = verifyKeys.get(publicKey);
    if (!key) {
      if (verifyKeys.size >= MAX_KEYS) verifyKeys.delete(verifyKeys.keys().next().value as string);
      key = crypto.subtle.importKey("raw", fromB64u(publicKey), { name: "Ed25519" }, true, ["verify"]);
      verifyKeys.set(publicKey, key);
      const pending = key;
      pending.catch(() => {
        if (verifyKeys.get(publicKey) === pending) verifyKeys.delete(publicKey);
      });
    }
    return await crypto.subtle.verify({ name: "Ed25519" }, await key, fromB64u(signature), data);
  } catch {
    return false;
  }
}
