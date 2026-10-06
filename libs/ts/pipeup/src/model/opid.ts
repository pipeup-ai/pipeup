import { canonicalJson, toB64u, utf8 } from "../util/encoding";
import type { OpBody } from "./types";

/**
 * An op's id: base64url of the SHA-256 of the op's canonical body, without its id (and, for a
 * create, without its thread, which must equal the id). 43 characters.
 */
export async function computeOpId(body: OpBody): Promise<string> {
  const content = { ...body, id: undefined, thread: body.kind === "create" ? undefined : body.thread };
  const digest = await crypto.subtle.digest("SHA-256", utf8(canonicalJson(content)));
  return toB64u(new Uint8Array(digest));
}
