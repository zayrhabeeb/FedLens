import type { KeyValueStore } from './storage';

export type Origin = 'network' | 'cache' | 'stale-cache' | 'bundled';

export interface Cached<T> {
  value: T;
  /** Epoch ms when the value was obtained from upstream. */
  storedAt: number;
  origin: Origin;
  /** Set when a refresh failed and an older value is being served. */
  error?: string;
}

interface Entry<T> {
  value: T;
  storedAt: number;
}

/**
 * Stale-while-error cache with timestamps in chrome.storage:
 *  fresh entry → return it (no network);
 *  stale/missing → load; on success store and return;
 *  load fails → serve the stale entry (with the error) if there is one.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  deps: { store: KeyValueStore; now: () => number },
  { force = false } = {},
): Promise<Cached<T>> {
  const storageKey = `cache:${key}`;
  const entry = await deps.store.get<Entry<T>>(storageKey);
  if (entry && !force && deps.now() - entry.storedAt < ttlMs) {
    return { value: entry.value, storedAt: entry.storedAt, origin: 'cache' };
  }
  try {
    const value = await load();
    const storedAt = deps.now();
    await deps.store.set(storageKey, { value, storedAt } satisfies Entry<T>);
    return { value, storedAt, origin: 'network' };
  } catch (err) {
    if (!entry) throw err;
    return {
      value: entry.value,
      storedAt: entry.storedAt,
      origin: 'stale-cache',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
