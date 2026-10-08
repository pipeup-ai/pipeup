export const VERSION = "0.4.1-beta.1";

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
export { ANIMALS, COLOURS, animalName, nameOf, type Animal } from "./model/animals";
export type { Anchor, Comment, Thread } from "./model/types";
