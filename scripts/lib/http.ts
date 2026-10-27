/**
 * Polite HTTP helper for the snapshot pipeline: timeouts, a descriptive
 * User-Agent, and exponential backoff that honours Retry-After on 429/503.
 */

const USER_AGENT = 'FedLens-snapshot/1.0 (+https://github.com/zayrhabeeb/FedLens)';

export interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { retries = 3, timeoutMs = 30_000, ...init } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: init.method ?? 'GET',
        ...(init.body ? { body: init.body } : {}),
        headers: { 'User-Agent': USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.text();
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after'));
        lastError = new Error(`HTTP ${res.status} for ${redact(url)}`);
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt,
        );
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${redact(url)}`);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith('HTTP 4')) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, opts?: FetchOptions): Promise<T> {
  return JSON.parse(await fetchText(url, opts)) as T;
}

/** Never let an API key leak into logs or committed error messages. */
export function redact(url: string): string {
  return url.replace(/(api_key|UserID|registrationkey)=[^&]+/gi, '$1=***');
}
