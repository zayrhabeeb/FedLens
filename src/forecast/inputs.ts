import { getCountry } from '../shared/countries';
import type { CountryCode, IndicatorSnapshot } from '../shared/types';
import type { ProcessedArticle } from '../nlp/analyze';
import type { DocumentAnalysis } from '../nlp/document';
import {
  cpiTrendSignal,
  documentToneSignal,
  guidanceSignal,
  inflationGapSignal,
  marketSignal,
  newsSentimentSignal,
  rateHistorySignal,
  type InputKey,
  type Signal,
} from './signals';

const FOURTEEN_DAYS = 14 * 86_400_000;

/** Assemble the live forecast inputs for one economy from everything FedLens knows. */
export function liveSignals(
  code: CountryCode,
  snapshot: IndicatorSnapshot,
  articles: readonly ProcessedArticle[],
  latestDocument?: DocumentAnalysis,
  now = Date.now(),
): Partial<Record<InputKey, Signal | null>> {
  const series = snapshot.countries[code]?.series;
  const cpi = series?.cpi?.points ?? [];
  const rates = series?.policyRate?.points ?? [];
  const lastCpi = cpi.at(-1)?.[1];
  const lastRate = rates.at(-1)?.[1];
  const lastYield = series?.yield2y?.points.at(-1)?.[1];
  const recent = articles.filter(
    (a) => a.country === code && now - Date.parse(a.publishedAt) <= FOURTEEN_DAYS,
  );

  return {
    inflationGap:
      lastCpi === undefined ? null : inflationGapSignal(lastCpi, getCountry(code).inflationTarget),
    cpiTrend: cpiTrendSignal(cpi.slice(-4).map(([, v]) => v)),
    documentTone: latestDocument ? documentToneSignal(latestDocument) : null,
    guidance: latestDocument ? guidanceSignal(latestDocument) : null,
    rateHistory: rateHistorySignal(rates.slice(-37)),
    newsSentiment: newsSentimentSignal(recent),
    market:
      lastYield !== undefined && lastRate !== undefined ? marketSignal(lastYield, lastRate) : null,
  };
}
