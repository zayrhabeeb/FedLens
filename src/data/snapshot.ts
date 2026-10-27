/**
 * Loads the static data snapshots published by the GitHub Actions workflow.
 *
 * Order of preference:
 *   1. cached copy in chrome.storage (if younger than its TTL)
 *   2. remote snapshot on raw.githubusercontent.com
 *   3. stale cached copy (if the network failed)
 *   4. the snapshot bundled into the extension at build time
 * …and whichever of remote/bundled is newer wins, so a fork that has not set
 * up the workflow yet still gets the data it was built with.
 */
import { SNAPSHOT_BASE_URL, TTL } from '../config';
import type { IndicatorSnapshot, NewsSnapshot } from '../shared/types';
import { cached, type Cached } from './cache';
import { politeFetch } from './http';
import { packagedUrl, runtimeDeps } from './runtime';

type Snapshot = IndicatorSnapshot | NewsSnapshot;

function assertSnapshot<T extends Snapshot>(value: unknown, name: string): T {
  const v = value as Partial<Snapshot> | null;
  if (!v || v.schemaVersion !== 1 || typeof v.generatedAt !== 'string') {
    throw new Error(`${name}: unexpected snapshot format`);
  }
  return value as T;
}

async function loadBundled<T extends Snapshot>(file: string): Promise<T> {
  const res = await fetch(packagedUrl(`data/${file}`));
  if (!res.ok) throw new Error(`Bundled ${file} missing`);
  return assertSnapshot<T>(await res.json(), file);
}

async function loadSnapshot<T extends Snapshot>(file: string, ttlMs: number, force: boolean): Promise<Cached<T>> {
  const bundledPromise = loadBundled<T>(file).catch(() => undefined);
  let remote: Cached<T> | undefined;
  try {
    remote = await cached(
      `snapshot:${file}`,
      ttlMs,
      async () => assertSnapshot<T>(JSON.parse(await politeFetch(`${SNAPSHOT_BASE_URL}/${file}`, runtimeDeps)), file),
      runtimeDeps,
      { force },
    );
  } catch {
    // Network unavailable and nothing cached — fall through to the bundled copy.
  }
  const bundled = await bundledPromise;
  if (bundled && (!remote || bundled.generatedAt > remote.value.generatedAt)) {
    return {
      value: bundled,
      storedAt: Date.parse(bundled.generatedAt),
      origin: 'bundled',
      ...(remote?.error ? { error: remote.error } : {}),
    };
  }
  if (remote) return remote;
  throw new Error(`No ${file} available (offline and nothing bundled).`);
}

export const loadIndicatorSnapshot = (force = false) =>
  loadSnapshot<IndicatorSnapshot>('indicators.json', TTL.indicators, force);

export const loadNewsSnapshot = (force = false) => loadSnapshot<NewsSnapshot>('news.json', TTL.newsSnapshot, force);
