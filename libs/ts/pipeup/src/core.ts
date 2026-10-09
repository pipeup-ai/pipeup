export const VERSION = "0.5.2";

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
