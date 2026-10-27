import type { Topic } from '../shared/types';
import { TOPIC_KEYWORDS } from './lexicon';
import { distinctHits, wordCount } from './text';
import type { TopicResult } from './types';

/**
 * Rule-based topic classification (PRD §12.5): a text belongs to a topic when
 * it contains at least N distinct keywords from that topic's dictionary.
 * N = 3 for article-length text, 1 for headline-length text (< 60 words),
 * because a headline rarely repeats itself.
 */
export function classifyTopics(text: string): TopicResult {
  const threshold = wordCount(text) < 60 ? 1 : 3;
  const hits: Partial<Record<Topic, string[]>> = {};
  const scored: [Topic, number][] = [];
  for (const topic of Object.keys(TOPIC_KEYWORDS) as Topic[]) {
    const found = distinctHits(text, TOPIC_KEYWORDS[topic]);
    if (found.length > 0) hits[topic] = found;
    if (found.length >= threshold) scored.push([topic, found.length]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const topics = scored.map(([t]) => t);
  return { topics, hits, ...(topics[0] ? { primary: topics[0] } : {}) };
}

export const TOPIC_LABELS: Record<Topic, string> = {
  inflation: 'Inflation',
  rates: 'Interest Rates',
  trade: 'Trade',
  employment: 'Employment',
  currency: 'Currency',
  fiscal: 'Fiscal Policy',
};
