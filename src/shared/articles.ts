import type { FeedDefinition } from './feeds';
import { fnv1a } from './math';
import type { FeedItem } from './rss';
import type { RawArticle } from './types';

/** Dedup key per PRD: hash of normalised title + source + publication day. */
export function articleId(title: string, source: string, publishedAt: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return fnv1a(`${norm(title)}|${norm(source)}|${publishedAt.slice(0, 10)}`);
}

/**
 * Normalise a parsed feed item into a RawArticle. Google News titles carry a
 * " - Publisher" suffix, which is split off so the publisher can be tiered.
 */
export function toRawArticle(item: FeedItem, feed: FeedDefinition, now = new Date()): RawArticle {
  let title = item.title;
  let source = item.source ?? feed.publisher;
  if (item.source && title.endsWith(` - ${item.source}`)) {
    title = title.slice(0, -(item.source.length + 3));
  }
  if (feed.publisher === 'Google News' && !item.source) {
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) {
      source = title.slice(dash + 3);
      title = title.slice(0, dash);
    }
  }
  const publishedAt = item.publishedAt || now.toISOString();
  // Google News descriptions only repeat the headline as a link; drop them.
  const summary = feed.publisher === 'Google News' ? '' : item.description.slice(0, 600);
  return {
    id: articleId(title, source, publishedAt),
    title,
    link: item.link,
    source,
    publishedAt,
    summary,
    feedId: feed.id,
    ...(feed.country ? { countryHint: feed.country } : {}),
  };
}

/** Merge article lists, keeping the first occurrence of each id, newest first. */
export function mergeArticles(...lists: readonly RawArticle[][]): RawArticle[] {
  const seen = new Map<string, RawArticle>();
  for (const list of lists) for (const a of list) if (!seen.has(a.id)) seen.set(a.id, a);
  return [...seen.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Drop articles older than `days`. */
export function withinDays(
  articles: readonly RawArticle[],
  days: number,
  now = Date.now(),
): RawArticle[] {
  const cutoff = now - days * 86_400_000;
  return articles.filter((a) => Date.parse(a.publishedAt) >= cutoff);
}
