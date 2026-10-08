import { fromB64u } from "./encoding";

const DOC = /^([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{43})$/;

/**
 * The page's secret from `data-pipeup-doc` ("<16-char id>:<43-char base64url>"), if its id is `docId`.
 * Anyone holding the file has it; it is never stored (add-ons design §6.1).
 */
export function pageSecret(docId: string, doc: Document = document): Uint8Array<ArrayBuffer> | null {
  const m = DOC.exec(doc.documentElement.getAttribute("data-pipeup-doc")?.trim() ?? "");
  return m && m[1] === docId ? fromB64u(m[2]!) : null;
}
