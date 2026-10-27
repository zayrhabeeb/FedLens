/**
 * News loading: live RSS (direct, thanks to extension host permissions — no
 * third-party CORS proxy), merged with the published news snapshot and a
 * local 30-day archive used for intensity history.
 */
import { NEWS_ARCHIVE_CAP, NEWS_ARCHIVE_DAYS, TTL } from '../config';
import { mergeArticles, toRawArticle, withinDays } from '../shared/articles';
import { FEEDS, type FeedDefinition } from '../shared/feeds';
import { parseFeed } from '../shared/rss';
import type { RawArticle } from '../shared/types';
import { cached, type Origin } from './cache';
import { politeFetch } from './http';
import { runtimeDeps } from './runtime';
import { loadNewsSnapshot } from './snapshot';

export interface FeedStatus {
  id: string;
  label: string;
  ok: boolean;
  origin?: Origin;
  count: number;
  error?: string;
}

export interface NewsLoadResult {
  articles: RawArticle[];
  feeds: FeedStatus[];
  snapshotGeneratedAt?: string;
}

const ARCHIVE_KEY = 'news:archive';
const CONCURRENCY = 3;

async function loadFeed(feed: FeedDefinition, force: boolean): Promise<{ status: FeedStatus; articles: RawArticle[] }> {
  try {
    const result = await cached(
      `feed:${feed.id}`,
      TTL.feed,
      async () => parseFeed(await politeFetch(feed.url, runtimeDeps)).slice(0, 40).map((item) => toRawArticle(item, feed)),
      runtimeDeps,
      { force },
    );
    return {
      articles: result.value,
      status: { id: feed.id, label: feed.label, ok: !result.error, origin: result.origin, count: result.value.length, ...(result.error ? { error: result.error } : {}) },
    };
  } catch (err) {
    return { articles: [], status: { id: feed.id, label: feed.label, ok: false, count: 0, error: err instanceof Error ? err.message : String(err) } };
  }
}

/** Run async tasks with bounded concurrency so free endpoints are never burst. */
async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function loadNews(force = false): Promise<NewsLoadResult> {
  const [live, snapshot, archive] = await Promise.all([
    mapLimited(FEEDS, CONCURRENCY, (feed) => loadFeed(feed, force)),
    loadNewsSnapshot(force).catch(() => undefined),
    runtimeDeps.store.get<RawArticle[]>(ARCHIVE_KEY),
  ]);
  const merged = mergeArticles(
    live.flatMap((l) => l.articles),
    snapshot?.value.articles ?? [],
    archive ?? [],
  );
  const kept = withinDays(merged, NEWS_ARCHIVE_DAYS).slice(0, NEWS_ARCHIVE_CAP);
  await runtimeDeps.store.set(ARCHIVE_KEY, kept);
  return {
    articles: kept,
    feeds: live.map((l) => l.status),
    ...(snapshot ? { snapshotGeneratedAt: snapshot.value.generatedAt } : {}),
  };
}
