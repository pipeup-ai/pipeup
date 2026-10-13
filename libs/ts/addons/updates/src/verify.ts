import type { UpdateList } from "./decide";

/** The same text the maintainer signed: JSON with sorted keys, without the signature. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

const bytes = (b64u: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64u.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** The list, if it was signed by one of `keys`, has the shape this reads, and has not expired; otherwise null. */
export async function check(
  text: string,
  keys: readonly { id: string; key: string }[],
  now = Date.now(),
): Promise<UpdateList | null> {
  try {
    const list = JSON.parse(text) as UpdateList;
    const known = keys.find((k) => k.id === list?.sig?.key);
    if (!known || list.v !== 1 || !(Date.parse(list.expires) > now)) return null;
    const { sig, ...rest } = list;
    const key = await crypto.subtle.importKey("raw", bytes(known.key), { name: "Ed25519" }, false, [
      "verify",
    ]);
    const signed = new TextEncoder().encode(canonical(rest));
    return (await crypto.subtle.verify({ name: "Ed25519" }, key, bytes(sig.value), signed)) ? list : null;
  } catch {
    return null;
  }
}
