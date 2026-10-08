import { toB64u, utf8 } from "./encoding";

/** What a key or address is for. Each gets its own key, so one can never be used as another. */
export type Purpose = "share" | "live" | "presence" | "signal" | "relay";

const salt = (docId: string) => utf8(`pipeup/v1/doc:${docId}`);

async function hkdf(
  ikm: Uint8Array<ArrayBuffer>,
  docId: string,
  info: string,
  bits: number,
): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt(docId), info: utf8(info) },
    base,
    bits,
  );
}

/**
 * The room secret R, derived from the page secret S when the page names no sharing key of its own:
 * HKDF-SHA-256(ikm S, salt "pipeup/v1/doc:" + docId, info "pipeup/v1/room"). Frozen by test vectors.
 */
export async function derivedRoom(
  docId: string,
  pageSecret: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await hkdf(pageSecret, docId, "pipeup/v1/room", 256));
}

/** Per-purpose keys and addresses from the room secret R. HKDF's extract step is the salted PRK of the design. */
export interface Ladder {
  readonly docId: string;
  /** AES-256-GCM, not extractable. */
  key(purpose: Purpose): Promise<CryptoKey>;
  /** 16 bytes as base64url: an opaque address that reveals nothing of R. */
  addr(purpose: Purpose): Promise<string>;
  /** The additional data every sealed message of this purpose is bound to. */
  aad(purpose: Purpose): string;
}

export function ladder(docId: string, room: Uint8Array<ArrayBuffer>): Ladder {
  return {
    docId,
    key: async (p) =>
      crypto.subtle.importKey("raw", await hkdf(room, docId, `pipeup/v1/${p}/key`, 256), "AES-GCM", false, [
        "encrypt",
        "decrypt",
      ]),
    addr: async (p) => toB64u(new Uint8Array(await hkdf(room, docId, `pipeup/v1/${p}/address`, 128))),
    aad: (p) => `pipeup/v1/${p}:${docId}`,
  };
}
