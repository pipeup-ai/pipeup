import { seal, unseal } from "../crypto/seal";
import type { SignedOp } from "../model/types";

/** The file a reviewer sends back with "Send feedback". */
export interface FeedbackFile {
  pipeup: 1;
  doc: string;
  sealed: boolean;
  iv?: string;
  data?: string;
  ops?: SignedOp[];
}

const MAX_CHARS = 5_000_000;
const context = (doc: string) => `pipeup-file:${doc}`;

export async function writeFeedbackFile(
  doc: string,
  ops: SignedOp[],
  key: CryptoKey | null,
): Promise<string> {
  const file: FeedbackFile = key
    ? { pipeup: 1, doc, sealed: true, ...(await seal(key, JSON.stringify(ops), context(doc))) }
    : { pipeup: 1, doc, sealed: false, ops };
  return JSON.stringify(file, null, 2);
}

/** Returns the file's ops, untrusted: pass them to OpLog.add, which validates and verifies each one. */
export async function readFeedbackFile(json: string, doc: string, key: CryptoKey | null): Promise<unknown[]> {
  if (json.length > MAX_CHARS) throw new Error("pipeup: this feedback file is too large");
  let file: Partial<FeedbackFile>;
  try {
    file = JSON.parse(json) as Partial<FeedbackFile>;
  } catch {
    throw new Error("pipeup: this is not an Pipeup feedback file");
  }
  if (!file || typeof file !== "object" || file.pipeup !== 1 || typeof file.doc !== "string") {
    throw new Error("pipeup: this is not an Pipeup feedback file");
  }
  if (file.doc !== doc) throw new Error("pipeup: this feedback is for a different document");
  if (!file.sealed) return Array.isArray(file.ops) ? file.ops : [];
  if (!key) throw new Error("pipeup: this feedback is sealed, and this page has no document key");
  if (typeof file.iv !== "string" || typeof file.data !== "string") {
    throw new Error("pipeup: this is not an Pipeup feedback file");
  }
  let plaintext: string;
  try {
    plaintext = await unseal(key, { iv: file.iv, data: file.data }, context(doc));
  } catch {
    throw new Error("pipeup: this feedback could not be opened with this document's key");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("pipeup: this is not an Pipeup feedback file");
  }
  return Array.isArray(parsed) ? parsed : [];
}
