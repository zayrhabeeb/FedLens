/**
 * Macro event extraction (PRD §6). An article becomes an event when its
 * entity set matches an event pattern — e.g. central bank + rate action.
 * Events from several articles about the same thing are merged, and
 * TIER_4 sources never create events.
 */
import { fnv1a } from '../shared/math';
import type {
  Confidence,
  CountryCode,
  EventType,
  RateDirection,
  Sentiment,
  SourceTier,
} from '../shared/types';
import type { ProcessedArticle } from './analyze';
import { EVENT_CUES, HEDGES, INSTITUTIONS, OPINION_MARKERS } from './lexicon';
import { findPhrases } from './text';
import type { TextAnalysis } from './types';

export interface MacroEvent {
  id: string;
  country: CountryCode;
  type: EventType;
  /** YYYY-MM-DD */
  date: string;
  headline: string;
  entities: string[];
  sentiment: Sentiment;
  direction?: RateDirection;
  sourceArticleIds: string[];
  confidence: Confidence;
  linkedDocumentId?: string;
}

export interface EventCandidate {
  type: EventType;
  direction?: RateDirection;
  confidence: Confidence;
}

const CENTRAL_BANKS = new Set(INSTITUTIONS.filter((i) => i.isCentralBank).map((i) => i.name));

/** Order matters: the first matching specific type wins ties for the article. */
const PRIORITY: EventType[] = [
  'RATE_DECISION',
  'INFLATION_PRINT',
  'GDP_RELEASE',
  'CURRENCY_SHOCK',
  'TRADE_EVENT',
  'FISCAL_ACTION',
  'ELECTION_RESULT',
  'EXTERNAL_SHOCK',
  'CENTRAL_BANK_SPEECH',
];

/**
 * Bare nouns ("a rate hike", "on hold") are how speculation is phrased; a
 * decision is reported with a verb ("raised rates", "holds rates").
 */
const BARE_RATE_NOUNS = new Set(['rate hike', 'rate cut', 'on hold']);

function rateDirection(analysis: TextAnalysis): RateDirection | undefined {
  const actions = analysis.entities
    .filter((e) => e.kind === 'action' && !BARE_RATE_NOUNS.has(e.text.toLowerCase()))
    .map((e) => e.normalized);
  if (actions.includes('rate hike')) return 'hike';
  if (actions.includes('rate cut')) return 'cut';
  if (actions.includes('rate hold')) return 'hold';
  return undefined;
}

/** Event types that report something that already happened (a decision or a data release). */
const FACTUAL_TYPES = new Set<EventType>(['RATE_DECISION', 'INFLATION_PRINT', 'GDP_RELEASE']);

/**
 * Detect up to two event types in an analysed text. Opinion pieces create no
 * events. Hedged or speculative language ("expect", "poised", a question
 * headline) never creates a decision or data-release event, and caps the
 * remaining types at LOW confidence.
 */
export function detectEvents(
  text: string,
  analysis: TextAnalysis,
  tier: SourceTier = 'TIER_1',
): EventCandidate[] {
  const lower = text.trimStart().toLowerCase();
  if (OPINION_MARKERS.some((m) => lower.startsWith(m))) return [];
  const hedged = findPhrases(text, HEDGES).length > 0 || text.includes('?');
  const hasCentralBank = analysis.entities.some(
    (e) => e.kind === 'institution' && CENTRAL_BANKS.has(e.normalized),
  );
  const figureMetrics = new Set(
    analysis.entities.filter((e) => e.kind === 'figure').map((e) => e.metric),
  );
  const cue = (type: EventType) => findPhrases(text, EVENT_CUES[type]).length > 0;
  const strongSource = tier === 'TIER_1' || tier === 'TIER_2';

  const found: EventCandidate[] = [];
  const add = (type: EventType, figureBacked: boolean, direction?: RateDirection) => {
    const confidence: Confidence = hedged
      ? 'LOW'
      : figureBacked && strongSource
        ? 'HIGH'
        : figureBacked || strongSource
          ? 'MODERATE'
          : 'LOW';
    found.push({ type, confidence, ...(direction ? { direction } : {}) });
  };

  for (const type of PRIORITY) {
    if (hedged && FACTUAL_TYPES.has(type)) continue;
    switch (type) {
      case 'RATE_DECISION': {
        const direction = rateDirection(analysis);
        if (direction && (hasCentralBank || analysis.topics.topics.includes('rates'))) {
          add(type, figureMetrics.has('policy rate'), direction);
        }
        break;
      }
      case 'INFLATION_PRINT':
        if (
          cue(type) &&
          (figureMetrics.has('inflation') || analysis.topics.topics.includes('inflation'))
        ) {
          add(type, figureMetrics.has('inflation'));
        }
        break;
      case 'GDP_RELEASE':
        if (cue(type) && (figureMetrics.has('gdp') || /recession/i.test(text)))
          add(type, figureMetrics.has('gdp'));
        break;
      case 'CENTRAL_BANK_SPEECH':
        if (cue(type) && hasCentralBank && !found.some((f) => f.type === 'RATE_DECISION'))
          add(type, false);
        break;
      default:
        if (cue(type)) add(type, figureMetrics.size > 0);
    }
    if (found.length === 2) break;
  }
  return found;
}

const DAY = 86_400_000;
const CONFIDENCE_RANK: Record<Confidence, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

/**
 * Build the event timeline from processed articles. Same country + type
 * (+ direction) within 3 days is treated as one event with several sources;
 * corroboration by ≥3 sources (one of them TIER_1) upgrades confidence to HIGH.
 */
export function buildEvents(articles: readonly ProcessedArticle[]): MacroEvent[] {
  const events: (MacroEvent & { firstMs: number; bestTier: SourceTier })[] = [];
  const sorted = [...articles].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  for (const article of sorted) {
    if (article.tier === 'TIER_4' || !article.country) continue;
    const text = `${article.title}. ${article.summary}`;
    const ms = Date.parse(article.publishedAt);
    for (const cand of detectEvents(text, article.analysis, article.tier)) {
      const existing = events.find(
        (e) =>
          e.country === article.country &&
          e.type === cand.type &&
          e.direction === cand.direction &&
          Math.abs(ms - e.firstMs) <= 3 * DAY,
      );
      const entityLabels = article.analysis.entities
        .filter((e) => e.kind !== 'country')
        .map((e) => e.normalized);
      if (existing) {
        existing.sourceArticleIds.push(article.id);
        existing.entities = [...new Set([...existing.entities, ...entityLabels])].slice(0, 8);
        if (CONFIDENCE_RANK[cand.confidence] > CONFIDENCE_RANK[existing.confidence])
          existing.confidence = cand.confidence;
        if (article.tier < existing.bestTier) {
          existing.bestTier = article.tier;
          existing.headline = article.title;
        }
        continue;
      }
      events.push({
        id: fnv1a(`${article.country}|${cand.type}|${cand.direction ?? ''}|${article.id}`),
        country: article.country,
        type: cand.type,
        date: article.publishedAt.slice(0, 10),
        headline: article.title,
        entities: [...new Set(entityLabels)].slice(0, 8),
        sentiment: article.analysis.sentiment.label,
        sourceArticleIds: [article.id],
        confidence: cand.confidence,
        firstMs: ms,
        bestTier: article.tier,
        ...(cand.direction ? { direction: cand.direction } : {}),
      });
    }
  }

  const byId = new Map(articles.map((a) => [a.id, a]));
  return events
    .map(({ firstMs: _f, bestTier: _b, ...event }) => {
      const tiers = event.sourceArticleIds.map((id) => byId.get(id)?.tier);
      if (event.sourceArticleIds.length >= 3 && tiers.includes('TIER_1')) event.confidence = 'HIGH';
      return event;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface ActivityWindow {
  country: CountryCode;
  start: string;
  end: string;
  eventIds: string[];
}

/** PRD §6.5: 3+ events within 7 days for one country = "high-activity window". */
export function findHighActivityWindows(
  events: readonly MacroEvent[],
  minEvents = 3,
  days = 7,
): ActivityWindow[] {
  const windows: ActivityWindow[] = [];
  const byCountry = new Map<CountryCode, MacroEvent[]>();
  for (const e of events) byCountry.set(e.country, [...(byCountry.get(e.country) ?? []), e]);

  for (const [country, list] of byCountry) {
    const asc = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let i = 0;
    while (i < asc.length) {
      const startMs = Date.parse(asc[i]!.date);
      const inWindow = asc.filter(
        (e, j) => j >= i && Date.parse(e.date) - startMs <= (days - 1) * DAY,
      );
      if (inWindow.length >= minEvents) {
        windows.push({
          country,
          start: asc[i]!.date,
          end: inWindow.at(-1)!.date,
          eventIds: inWindow.map((e) => e.id),
        });
        i += inWindow.length;
      } else {
        i++;
      }
    }
  }
  return windows;
}

export const EVENT_LABELS: Record<EventType, string> = {
  RATE_DECISION: 'Rate decision',
  INFLATION_PRINT: 'Inflation print',
  GDP_RELEASE: 'GDP release',
  FISCAL_ACTION: 'Fiscal action',
  TRADE_EVENT: 'Trade event',
  CURRENCY_SHOCK: 'Currency shock',
  ELECTION_RESULT: 'Election result',
  CENTRAL_BANK_SPEECH: 'Central bank speech',
  EXTERNAL_SHOCK: 'External shock',
};
