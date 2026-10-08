/**
 * An add-on's own non-secret settings (a choice, a list of op ids): IndexedDB `pipeup-addon-<id>`, opened within
 * 4 s, else kept in memory. Secrets are never stored: on `file://` every local page can read what is kept.
 */
export interface Settings {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  /** The settings survive a reload. When false, an add-on says "This browser won't remember this choice". */
  readonly lasting: boolean;
}

const OPEN_MS = 4000;

export async function settings(id: string, o: { memory?: boolean } = {}): Promise<Settings> {
  const mem = new Map<string, unknown>();
  const inMemory: Settings = {
    get: async <T>(k: string) => mem.get(k) as T | undefined,
    set: async (k, v) => void mem.set(k, v),
    lasting: false,
  };
  if (o.memory || typeof indexedDB === "undefined") return inMemory;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timed out")), OPEN_MS);
      const req = indexedDB.open(`pipeup-addon-${id}`, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => {
        clearTimeout(t);
        resolve(req.result);
      };
      req.onerror = req.onblocked = () => {
        clearTimeout(t);
        reject(req.error ?? new Error("blocked"));
      };
    });
    const tx = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction("kv", mode).objectStore("kv"));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    return {
      get: <T>(k: string) => tx("readonly", (s) => s.get(k)) as Promise<T | undefined>,
      set: async (k, v) => void (await tx("readwrite", (s) => s.put(v, k))),
      lasting: true,
    };
  } catch {
    return inMemory;
  }
}
