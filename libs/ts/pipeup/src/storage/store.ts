import { createIdentity, type Identity } from "../crypto/identity";
import type { SignedOp } from "../model/types";

export interface Profile {
  identity: Identity;
  name: string;
}

/** Where a browser keeps ops and the reviewer's profile. Implementations must not leave the machine. */
export interface OpStore {
  load(doc: string): Promise<SignedOp[]>;
  append(doc: string, ops: SignedOp[]): Promise<void>;
  loadProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  /** Saves `profile` only if none is stored yet, atomically, and returns whichever profile is stored afterwards. */
  saveProfileIfAbsent(profile: Profile): Promise<Profile>;
}

export class MemoryStore implements OpStore {
  private readonly docs = new Map<string, Map<string, SignedOp>>();
  private profile: Profile | null = null;

  async load(doc: string): Promise<SignedOp[]> {
    return [...(this.docs.get(doc)?.values() ?? [])];
  }

  async append(doc: string, ops: SignedOp[]): Promise<void> {
    let bucket = this.docs.get(doc);
    if (!bucket) this.docs.set(doc, (bucket = new Map()));
    for (const op of ops) bucket.set(op.body.id, op);
  }

  async loadProfile(): Promise<Profile | null> {
    return this.profile;
  }

  async saveProfile(profile: Profile): Promise<void> {
    this.profile = profile;
  }

  async saveProfileIfAbsent(profile: Profile): Promise<Profile> {
    if (!this.profile) this.profile = profile;
    return this.profile;
  }
}

/** A new reviewer has no name: they show as their animal until they add one. */
export const DEFAULT_PROFILE_NAME = "";
/** What earlier versions called everyone before they chose a name; read as no name. */
const OLD_DEFAULT_NAME = "Reviewer";

/** The reviewer's profile, created with a new identity the first time. */
export async function loadOrCreateProfile(store: OpStore, name = DEFAULT_PROFILE_NAME): Promise<Profile> {
  const existing = await store.loadProfile();
  if (existing) return existing.name === OLD_DEFAULT_NAME ? { ...existing, name: "" } : existing;
  const candidate: Profile = { identity: await createIdentity(), name };
  return store.saveProfileIfAbsent(candidate);
}
