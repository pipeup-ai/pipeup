import { fromB64u, utf8 } from "./encoding";

const KEY = /^[A-Za-z0-9_-]{43}$/;

/**
 * Checks a `host.sign` signature against its author's public key (both base64url). `purpose` is the full
 * "<add-on id>/<name>" the signer passed to the core, which signs the text "pipeup:<purpose>\n<data>".
 */
export async function verifySigned(
  author: string,
  purpose: string,
  data: string,
  sig: string,
): Promise<boolean> {
  if (!KEY.test(author)) return false;
  try {
    const key = await crypto.subtle.importKey("raw", fromB64u(author), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64u(sig), utf8(`pipeup:${purpose}\n${data}`));
  } catch {
    return false;
  }
}
