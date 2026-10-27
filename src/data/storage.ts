/**
 * Async key-value storage. Backed by chrome.storage.local inside the extension
 * and by localStorage when the UI runs on the Vite dev server, so the same
 * code works in both. Tests use the in-memory store.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Remove every key starting with a prefix (e.g. "cache:"). */
  clearPrefix(prefix: string): Promise<void>;
}

export function createMemoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    set: async (key, value) => void data.set(key, structuredClone(value)),
    remove: async (key) => void data.delete(key),
    clearPrefix: async (prefix) => {
      for (const key of [...data.keys()]) if (key.startsWith(prefix)) data.delete(key);
    },
  };
}

function createChromeStore(area: chrome.storage.StorageArea): KeyValueStore {
  return {
    get: async <T>(key: string) => (await area.get(key))[key] as T | undefined,
    set: (key, value) => area.set({ [key]: value }),
    remove: (key) => area.remove(key),
    clearPrefix: async (prefix) => {
      const all = await area.get(null);
      await area.remove(Object.keys(all).filter((k) => k.startsWith(prefix)));
    },
  };
}

function createLocalStorageStore(): KeyValueStore {
  const ns = 'fedlens:';
  return {
    get: async <T>(key: string) => {
      const raw = localStorage.getItem(ns + key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    set: async (key, value) => localStorage.setItem(ns + key, JSON.stringify(value)),
    remove: async (key) => localStorage.removeItem(ns + key),
    clearPrefix: async (prefix) => {
      for (const k of Object.keys(localStorage)) if (k.startsWith(ns + prefix)) localStorage.removeItem(k);
    },
  };
}

export const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

export const store: KeyValueStore = isExtension
  ? createChromeStore(chrome.storage.local)
  : typeof localStorage !== 'undefined'
    ? createLocalStorageStore()
    : createMemoryStore();
