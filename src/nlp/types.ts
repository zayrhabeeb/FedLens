import type { Confidence, CountryCode, Sentiment, Stance, Topic } from '../shared/types';
import type { Sentence } from './text';

export type EntityKind = 'figure' | 'institution' | 'country' | 'action';

export interface Entity {
  kind: EntityKind;
  /** Surface text exactly as it appears in the source. */
  text: string;
  /** Canonical form: institution name, country code, action label, or "4.2%". */
  normalized: string;
  sentenceIndex: number;
  /** Character offset within the full analysed text, for highlighting. */
  start: number;
  length: number;
  /** For figures: the metric the number most likely refers to (inflation, gdp, ...). */
  metric?: string;
  value?: number;
  unit?: '%' | 'bp' | 'currency';
  country?: CountryCode;
}

/** A sentence-level assertion grounded to its source sentence. */
export interface Claim {
  sentenceIndex: number;
  text: string;
  confidence: Confidence;
  /** Why this confidence: exact figure, implied direction, or hedged opinion. */
  basis: 'exact figure' | 'implied direction' | 'analyst opinion';
}

export interface SentenceSignal {
  index: number;
  hawkish: number;
  dovish: number;
  shock: number;
  positive: number;
  negative: number;
}

export interface SentimentResult {
  label: Sentiment;
  stance: Stance;
  /** -1 (dovish) … +1 (hawkish). */
  monetaryScore: number;
  /** -1 (negative) … +1 (positive). */
  growthScore: number;
  shockCount: number;
  perSentence: SentenceSignal[];
}

export interface TopicResult {
  primary?: Topic;
  topics: Topic[];
  hits: Partial<Record<Topic, string[]>>;
}

export interface CountryScore {
  code: CountryCode;
  score: number;
}

export interface TextAnalysis {
  sentences: Sentence[];
  entities: Entity[];
  claims: Claim[];
  topics: TopicResult;
  sentiment: SentimentResult;
  countries: CountryScore[];
  primaryCountry?: CountryCode;
}
