/**
 * Polite fetching for free, keyless endpoints:
 *  - per-host minimum spacing between requests,
 *  - persistent backoff after 429/503 (honouring Retry-After), so a throttled
 *    host is left alone across popup/side-panel reopenings,
 *  - request timeouts.
 */
import { MIN_HOST_INTERVAL_MS } from '../config';
import type { KeyValueStore } from './storage';

export class RateLimitedError extends Error {
  constructor(
    readonly host: string,
    readonly until: number,
  ) {
    super(`${host} is rate-limited until ${new Date(until).toLocaleTimeString()}`);
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, url: string) {
    super(`HTTP ${status} from ${new URL(url).host}`);
  }
}

interface HostState {
  blockedUntil: number;
  failures: number;
}

export interface HttpDeps {
  fetch: typeof fetch;
  store: KeyValueStore;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const MAX_BACKOFF_MS = 6 * 60 * 60_000;
const lastRequestAt = new Map<string, number>();

export function backoffMs(failures: number, retryAfterHeader: string | null): number {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, MAX_BACKOFF_MS);
  return Math.min(60_000 * 2 ** failures, MAX_BACKOFF_MS);
}

export async function politeFetch(
  url: string,
  deps: HttpDeps,
  { timeoutMs = 15_000, minIntervalMs = MIN_HOST_INTERVAL_MS } = {},
): Promise<string> {
  const host = new URL(url).host;
  const key = `ratelimit:${host}`;
  const state = (await deps.store.get<HostState>(key)) ?? { blockedUntil: 0, failures: 0 };
  if (deps.now() < state.blockedUntil) throw new RateLimitedError(host, state.blockedUntil);

  const wait = (lastRequestAt.get(host) ?? 0) + minIntervalMs - deps.now();
  if (wait > 0) await deps.sleep(wait);
  lastRequestAt.set(host, deps.now());

  const res = await deps.fetch(url, { signal: AbortSignal.timeout(timeoutMs), credentials: 'omit' });
  if (res.status === 429 || res.status === 503) {
    const until = deps.now() + backoffMs(state.failures, res.headers.get('retry-after'));
    await deps.store.set(key, { blockedUntil: until, failures: state.failures + 1 } satisfies HostState);
    throw new RateLimitedError(host, until);
  }
  if (!res.ok) throw new HttpError(res.status, url);
  if (state.failures > 0) await deps.store.remove(key);
  return res.text();
}
