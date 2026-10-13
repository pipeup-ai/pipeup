export const VERSION = "0.7.0-beta.2";
/** The day this version was made (set with the version): Pipeup says so, once, in the console when it is over a year old. */
export const BUILT = "2026-10-13";

export { PipeupDocument, UnsavedChangeError, type Listener, type OpenOptions } from "./document";
export {
  DEFAULT_PROFILE_NAME,
  MemoryStore,
  loadOrCreateProfile,
  type OpStore,
  type Profile,
} from "./storage/store";
export { IndexedDbStore } from "./storage/indexeddb";
export { createIdentity, type Identity } from "./crypto/identity";
export { signOp } from "./model/ops";
export { computeOpId } from "./model/opid";
export { newDocumentAttribute, parseDocumentAttribute, type DocumentKey } from "./crypto/seal";
export { describeElement, describeRange } from "./anchor/describe";
export { resolveAnchor, type AnchorState, type Resolved, type ResolveOptions } from "./anchor/resolve";
export { labelOf, locate, type Location } from "./anchor/locate";
export {
  copyAll,
  copyThread,
  formatAgo,
  type CopyAs,
  type ExportItem,
  type ExportMeta,
} from "./export/format";
export { AI_NAME, ANIMALS, COLOURS, animalName, isAiName, nameOf, type Animal } from "./model/animals";
export type { Anchor, Comment, OpBody, SignedOp, Thread } from "./model/types";
