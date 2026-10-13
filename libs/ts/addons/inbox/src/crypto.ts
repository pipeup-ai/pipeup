/**
 * What the inbox needs from cryptography, all of it the browser's own (Ed25519 and X25519 signatures and agreement,
 * HKDF and AES-GCM): the address of a person's inbox, the small proof of work a note carries, the encryption key made
 * from the person's identity, and sealing a note so only they can open it. Matches services/mailbox/src/inbox.mjs.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const enc = new TextEncoder();

export const b64u = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (text: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const sha256 = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", data));
const cat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** A person's inbox address: the hash of their public key, which a sender can work out and nobody can reverse. */
export async function inboxId(edPublicKey: string): Promise<string> {
  const digest = await sha256(cat(enc.encode("pipeup-inbox/1"), unb64u(edPublicKey)));
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const byte of digest) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 26) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

const leadingZeroBits = (d: Uint8Array): number => {
  let n = 0;
  for (const byte of d) {
    if (byte === 0) n += 8;
    else return n + Math.clz32(byte) - 24;
  }
  return n;
};

/** Finds the number that makes a note cost a little to send: the hash of inbox, note and number starts with `bits` zero bits. */
export async function findWork(inbox: string, ct: string, bits: number): Promise<string> {
  for (let n = 0; ; n++)
    if (leadingZeroBits(await sha256(enc.encode(`${inbox}|${ct}|${n}`))) >= bits) return String(n);
}

// The fixed start of an X25519 private key in PKCS #8, before its 32-byte seed.
const X25519_PKCS8 = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

async function hkdf(
  secret: Uint8Array<ArrayBuffer>,
  info: string,
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: enc.encode(info) },
      base,
      bytes * 8,
    ),
  );
}

export interface InboxKey {
  /** The private key, which never leaves this page. */
  privateKey: CryptoKey;
  /** The public half (base64url), which senders seal to. */
  publicKey: string;
}

/**
 * The encryption key of a person, made from a signature their identity gives on a fixed text. An Ed25519 signature is
 * the same every time, and only the identity can make it, so the same person gets the same key on every browser that
 * holds their identity, and the key itself is never stored or sent.
 */
export async function keyFrom(signature: string): Promise<InboxKey> {
  const seed = await hkdf(unb64u(signature), "pipeup-inbox/x25519", 32);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    cat(X25519_PKCS8, seed),
    { name: "X25519" },
    true,
    ["deriveBits"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  return { privateKey, publicKey: jwk.x! };
}

const aes = async (secret: Uint8Array<ArrayBuffer>, ephemeral: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    await hkdf(cat(secret, ephemeral), "pipeup-inbox/seal", 32),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );

/** Seals `plain` to a person's public encryption key: `pi1.` and the sender's one-time key, a nonce and the ciphertext. */
export async function seal(recipientPublic: string, plain: string): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const ephemeral = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const them = await crypto.subtle.importKey("raw", unb64u(recipientPublic), { name: "X25519" }, false, []);
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "X25519", public: them }, pair.privateKey, 256),
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aes(secret, ephemeral), enc.encode(plain)),
  );
  return `pi1.${b64u(cat(ephemeral, iv, body))}`;
}

/** Opens a note sealed to this key; null when it isn't for this key or has been changed. */
export async function open(key: InboxKey, ct: string): Promise<string | null> {
  try {
    const raw = unb64u(ct.replace(/^pi1\./, ""));
    const ephemeral = raw.slice(0, 32);
    const iv = raw.slice(32, 44);
    const them = await crypto.subtle.importKey("raw", ephemeral, { name: "X25519" }, false, []);
    const secret = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "X25519", public: them }, key.privateKey, 256),
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await aes(secret, ephemeral),
      raw.slice(44),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Whether `signature` is by `edPublicKey` on the same framing the page's `sign(purpose, data)` uses. */
export async function signedBy(
  edPublicKey: string,
  purpose: string,
  data: string,
  signature: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", unb64u(edPublicKey), { name: "Ed25519" }, false, [
      "verify",
    ]);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      unb64u(signature),
      enc.encode(`pipeup:${purpose}\n${data}`),
    );
  } catch {
    return false;
  }
}
