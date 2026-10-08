import { fromB64u } from "@pipeup/kit";

/** What `data-pipeup-share` says: where the shared copy is and the key that seals it. */
export type Address =
  | { kind: "privatebin"; base: string; paste: string; key: Uint8Array<ArrayBuffer> }
  | { kind: "mailbox"; mailbox: string; key: Uint8Array<ArrayBuffer>; token?: string }
  | { kind: "off"; reason: string };

export const NOT_SET = "sharing isn't set up for this page";
export const NOT_AN_ADDRESS = "data-pipeup-share isn't a sharing address";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

const off = (reason: string): Address => ({ kind: "off", reason });

/**
 * Reads the sharing address (add-ons design §7.1). The fragment decides the backend: `#pm1.<key>[.<token>]` is an
 * HTTP mailbox, `?<paste id>#<key>` is PrivateBin. Both need `https:`, except `http://localhost` and
 * `http://127.0.0.1` (`local`), which never leave the machine: they let a developer try sharing without a certificate.
 */
export function parseShare(value: string | null | undefined, local = false): Address {
  const text = value?.trim();
  if (!text) return off(NOT_SET);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return off(NOT_AN_ADDRESS);
  }
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && LOCAL.test(url.hostname)))
    return off(NOT_AN_ADDRESS);
  const at = url.origin + url.pathname;
  const frag = url.hash.slice(1);
  if (frag.startsWith("pm1.")) {
    const [key, token, ...rest] = frag.slice(4).split(".");
    if (!KEY.test(key ?? "") || rest.length || (token !== undefined && !/^[A-Za-z0-9_-]+$/.test(token)))
      return off(NOT_AN_ADDRESS);
    if (url.search || !/\/m\/[A-Za-z0-9_-]{22,64}$/.test(at)) return off(NOT_AN_ADDRESS);
    return { kind: "mailbox", mailbox: at, key: fromB64u(key!), ...(token ? { token } : {}) };
  }
  const paste = /^\?([A-Za-z0-9_-]{8,64})$/.exec(url.search)?.[1];
  if (!paste || !KEY.test(frag)) return off(NOT_AN_ADDRESS);
  return { kind: "privatebin", base: at, paste, key: fromB64u(frag) };
}
