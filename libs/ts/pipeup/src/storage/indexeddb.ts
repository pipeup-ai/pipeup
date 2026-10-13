import type { SignedOp } from "../model/types";
import type { OpStore, Profile } from "./store";

interface Row {
  doc: string;
  id: string;
  op: SignedOp;
}

/** Ops and profile in this browser's IndexedDB. The private key is stored as a non-extractable CryptoKey. */
export class IndexedDbStore implements OpStore {
  private constructor(private readonly db: IDBDatabase) {}

  static open(name = "pipeup"): Promise<IndexedDbStore> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("ops", { keyPath: ["doc", "id"] }).createIndex("doc", "doc");
        db.createObjectStore("meta");
      };
      req.onsuccess = () => {
        const db = req.result;
        // A newer Pipeup in another tab can then upgrade the schema instead of hanging.
        db.onversionchange = () => db.close();
        resolve(new IndexedDbStore(db));
      };
      req.onerror = () => reject(req.error ?? new Error("pipeup: could not open local storage"));
    });
  }

  close(): void {
    this.db.close();
  }

  async load(doc: string): Promise<SignedOp[]> {
    const rows = await this.request<Row[]>("ops", "readonly", (s) => s.index("doc").getAll(doc));
    return rows.map((r) => r.op);
  }

  async append(doc: string, ops: SignedOp[]): Promise<void> {
    if (ops.length === 0) return;
    const tx = this.db.transaction("ops", "readwrite");
    const store = tx.objectStore("ops");
    const finished = done(tx);
    try {
      for (const op of ops) store.put({ doc, id: op.body.id, op } satisfies Row);
    } catch (error) {
      tx.abort();
      finished.catch(() => undefined);
      throw error;
    }
    await finished;
  }

  async loadProfile(): Promise<Profile | null> {
    return (await this.request<Profile | undefined>("meta", "readonly", (s) => s.get("profile"))) ?? null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.request("meta", "readwrite", (s) => s.put(profile, "profile"));
  }

  async saveProfileIfAbsent(profile: Profile): Promise<Profile> {
    const tx = this.db.transaction("meta", "readwrite");
    const store = tx.objectStore("meta");
    const finished = done(tx);
    let stored = profile;
    const get = store.get("profile");
    get.onsuccess = () => {
      if (get.result) stored = get.result as Profile;
      else store.put(profile, "profile");
    };
    await finished;
    return stored;
  }

  private request<T>(
    store: string,
    mode: IDBTransactionMode,
    make: (s: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = make(this.db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error ?? new Error("pipeup: local storage request failed"));
    });
  }
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("pipeup: local storage write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("pipeup: local storage write aborted"));
  });
}
