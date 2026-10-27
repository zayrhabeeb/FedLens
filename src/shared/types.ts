/**
 * Domain types shared by the extension UI, the NLP pipeline and the snapshot
 * scripts that run in GitHub Actions. Keep this file dependency-free so it can
 * be imported from both browser and Node contexts.
 */

/** The 12 economies FedLens tracks. "EA" is the euro area. */
export type CountryCode =
  'US' | 'EA' | 'GB' | 'JP' | 'CN' | 'IN' | 'BR' | 'CA' | 'AU' | 'KR' | 'MX' | 'ZA';

export type Region = 'Americas' | 'Europe' | 'Asia-Pacific' | 'Africa';

/** Upstream data providers. Used for attribution and source-status reporting. */
export type SourceId = 'worldbank' | 'bis' | 'ecb' | 'fred' | 'treasury' | 'bls' | 'bea' | 'rss';

export type IndicatorKey =
  | 'gdpGrowth'
  | 'cpi'
  | 'policyRate'
  | 'unemployment'
  | 'fx'
  | 'tradeBalance'
  | 'yield2y'
  | 'publicDebt';

/** D = daily, M = monthly (YYYY-MM), Q = quarterly (YYYY-Qn), A = annual (YYYY). */
export type Frequency = 'D' | 'M' | 'Q' | 'A';

/** A single observation: [period, value]. Tuples keep snapshot files compact. */
export type Point = [period: string, value: number];

export interface Series {
  key: IndicatorKey;
  label: string;
  unit: string;
  frequency: Frequency;
  source: SourceId;
  /** Ascending by period. */
  points: Point[];
}

export interface CountryIndicators {
  code: CountryCode;
  series: Partial<Record<IndicatorKey, Series>>;
}

export interface SourceStatus {
  id: SourceId;
  ok: boolean;
  fetchedAt: string;
  detail?: string;
}

export interface IndicatorSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  countries: Partial<Record<CountryCode, CountryIndicators>>;
  sources: SourceStatus[];
}

/** An article as it arrives from a feed, before any NLP. */
export interface RawArticle {
  /** Stable dedup hash of title + source + day. */
  id: string;
  title: string;
  link: string;
  source: string;
  /** ISO-8601 timestamp. */
  publishedAt: string;
  summary: string;
  feedId: string;
  countryHint?: CountryCode;
}

export interface NewsSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  articles: RawArticle[];
}

export type Confidence = 'LOW' | 'MODERATE' | 'HIGH';
export type Stance = 'hawkish' | 'neutral' | 'dovish';
export type Sentiment = 'hawkish' | 'dovish' | 'neutral' | 'shock' | 'positive' | 'negative';
export type Topic = 'inflation' | 'rates' | 'trade' | 'employment' | 'currency' | 'fiscal';
export type SourceTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
export type RateDirection = 'hike' | 'cut' | 'hold';

export type EventType =
  | 'RATE_DECISION'
  | 'INFLATION_PRINT'
  | 'GDP_RELEASE'
  | 'FISCAL_ACTION'
  | 'TRADE_EVENT'
  | 'CURRENCY_SHOCK'
  | 'ELECTION_RESULT'
  | 'CENTRAL_BANK_SPEECH'
  | 'EXTERNAL_SHOCK';
