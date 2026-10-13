import { createIdentity, MemoryStore, PipeupDocument, type Anchor } from "pipeup/core";
import { ladder, toB64u } from "@pipeup/kit";

export const DOC = "aaaaaaaaaaaaaaaa";
export const SECRET = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const ROOM = new Uint8Array(32).fill(7) as Uint8Array<ArrayBuffer>;
export const KEY = toB64u(ROOM);
export const L = ladder(DOC, ROOM);

export const anchor: Anchor = { path: "", fingerprint: "00000000", snapshot: "x" };

/** A document for a fictional reviewer. */
export async function reviewer(name: string, doc = DOC): Promise<PipeupDocument> {
  return PipeupDocument.open({
    doc,
    key: null,
    store: new MemoryStore(),
    identity: await createIdentity(),
    name,
  });
}
