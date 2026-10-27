/**
 * The deterministic pipeline (PRD §5.1):
 *   dedup → country tagger → topic classifier → entity extractor → sentiment
 * Every stage is pure and synchronous; no network, no model.
 */
import type { CountryCode, RawArticle, SourceTier } from '../shared/types';
import { classifyTopics } from './classify';
import { TIER_WEIGHT, tierFor } from './credibility';
import { extractClaims, extractEntities, scoreCountries } from './entities';
import { analyzeSentiment } from './sentiment';
import { splitSentences } from './text';
import type { TextAnalysis } from './types';

export interface AnalyzeOptions {
  /** Feed-level country prior (e.g. a country-specific news query). */
  countryHint?: CountryCode;
  /** Number of leading sentences that form the headline (weighted higher). */
  headlineSentences?: number;
}

export function analyzeText(text: string, opts: AnalyzeOptions = {}): TextAnalysis {
  const sentences = splitSentences(text);
  const entities = extractEntities(sentences);
  const countries = scoreCountries(entities, opts.headlineSentences ?? 1, opts.countryHint);
  const primaryCountry = countries[0]?.code;
  return {
    sentences,
    entities,
    claims: extractClaims(sentences, entities),
    topics: classifyTopics(text),
    sentiment: analyzeSentiment(sentences),
    countries,
    ...(primaryCountry ? { primaryCountry } : {}),
  };
}

export interface ProcessedArticle extends RawArticle {
  tier: SourceTier;
  /** Credibility weight applied in sentiment/event scoring. */
  weight: number;
  analysis: TextAnalysis;
  country?: CountryCode;
}

export function processArticle(article: RawArticle): ProcessedArticle {
  const text = article.summary ? `${article.title}.\n${article.summary}` : article.title;
  const tier = tierFor(article.source);
  const analysis = analyzeText(text, {
    ...(article.countryHint ? { countryHint: article.countryHint } : {}),
    headlineSentences: 1,
  });
  return {
    ...article,
    tier,
    weight: TIER_WEIGHT[tier],
    analysis,
    ...(analysis.primaryCountry ? { country: analysis.primaryCountry } : {}),
  };
}
