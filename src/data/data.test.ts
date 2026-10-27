import { describe, expect, it, vi } from 'vitest';
import { cached } from './cache';
import { backoffMs, politeFetch, RateLimitedError, type HttpDeps } from './http';
import { createMemoryStore } from './storage';

function deps(responses: Response[], start = 1_000_000): HttpDeps & { clock: { t: number } } {
  const clock = { t: start };
  const queue = [...responses];
  return {
    clock,
    fetch: vi.fn(async () => queue.shift() ?? new Response('', { status: 500 })),
    store: createMemoryStore(),
    now: () => clock.t,
    sleep: async (ms) => void (clock.t += ms),
  };
}

describe('cached', () => {
  it('serves fresh entries without loading, reloads stale ones, and falls back on error', async () => {
    const store = createMemoryStore();
    let t = 0;
    const d = { store, now: () => t };
    const load = vi.fn(async () => 'v1');

    expect((await cached('k', 1000, load, d)).origin).toBe('network');
    t = 500;
    expect((await cached('k', 1000, load, d)).origin).toBe('cache');
    expect(load).toHaveBeenCalledTimes(1);

    t = 2000;
    const failing = await cached('k', 1000, async () => Promise.reject(new Error('offline')), d);
    expect(failing).toMatchObject({ value: 'v1', origin: 'stale-cache', error: 'offline' });

    await expect(cached('missing', 1000, async () => Promise.reject(new Error('x')), d)).rejects.toThrow('x');
  });
});

describe('politeFetch', () => {
  it('backs off after 429 and refuses to hit the host until Retry-After passes', async () => {
    const d = deps([new Response('', { status: 429, headers: { 'retry-after': '120' } }), new Response('ok')]);
    await expect(politeFetch('https://a.example/x', d)).rejects.toBeInstanceOf(RateLimitedError);
    await expect(politeFetch('https://a.example/x', d)).rejects.toBeInstanceOf(RateLimitedError);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    d.clock.t += 121_000;
    await expect(politeFetch('https://a.example/x', d)).resolves.toBe('ok');
  });

  it('spaces requests to the same host', async () => {
    const d = deps([new Response('1'), new Response('2')]);
    await politeFetch('https://b.example/1', d, { minIntervalMs: 1000 });
    const before = d.clock.t;
    await politeFetch('https://b.example/2', d, { minIntervalMs: 1000 });
    expect(d.clock.t - before).toBeGreaterThanOrEqual(1000);
  });

  it('uses exponential backoff capped at 6 hours without Retry-After', () => {
    expect(backoffMs(0, null)).toBe(60_000);
    expect(backoffMs(3, null)).toBe(480_000);
    expect(backoffMs(20, null)).toBe(6 * 3_600_000);
  });
});
