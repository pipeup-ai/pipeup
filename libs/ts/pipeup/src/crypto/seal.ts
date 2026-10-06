import { fromB64u, randomId, toB64u, utf8 } from "../util/encoding";

/** The document's identity and 256-bit key, from the page's data-pipeup-doc attribute. */
export interface DocumentKey {
  id: string;
  key: CryptoKey;
}

export interface Sealed {
  iv: string;
  data: string;
}

const DOC_ATTRIBUTE = /^([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{43})$/;

/** A fresh value for data-pipeup-doc: "<document id>:<key>". */
export function newDocumentAttribute(): string {
  return `${randomId(12)}:${toB64u(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function parseDocumentAttribute(value: string): Promise<DocumentKey> {
  const match = DOC_ATTRIBUTE.exec(value.trim());
  const id = match?.[1];
  const secret = match?.[2];
  if (!id || !secret) {
    throw new Error('pipeup: data-pipeup-doc must look like "<id>:<key>", as made by newDocumentAttribute()');
  }
  const key = await crypto.subtle.importKey("raw", fromB64u(secret), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return { id, key };
}

/** AES-256-GCM. `context` is bound into the ciphertext so it can't be replayed elsewhere. */
export async function seal(key: CryptoKey, plaintext: string, context: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8(context) },
    key,
    utf8(plaintext),
  );
  return { iv: toB64u(iv), data: toB64u(new Uint8Array(data)) };
}

export async function unseal(key: CryptoKey, sealed: Sealed, context: string): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64u(sealed.iv), additionalData: utf8(context) },
      key,
      fromB64u(sealed.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("pipeup: this feedback could not be opened with this document");
  }
}
