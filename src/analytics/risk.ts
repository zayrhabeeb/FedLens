/**
 * Policy Risk Score (PRD §4.4): a 0–100 weighted sum of normalised components.
 * Higher = more likely that policy or macro conditions shift abruptly.
 */
import { getCountry } from '../shared/countries';
import { clamp, round } from '../shared/math';
import type { CountryCode, IndicatorSnapshot } from '../shared/types';
import type { ProcessedArticle } from '../nlp/analyze';
import type { DocumentAnalysis } from '../nlp/document';
import type { MacroEvent } from '../nlp/events';

export interface RiskComponent {
  key: 'inflation' | 'rates' | 'news' | 'events' | 'language';
  label: string;
  weight: number;
  /** 0–1 normalised intensity. */
  value: number;
  detail: string;
}

export interface RiskScore {
  score: number;
  level: 'Low' | 'Elevated' | 'High';
  components: RiskComponent[];
}

const DAY = 86_400_000;

export function policyRiskScore(
  code: CountryCode,
  snapshot: IndicatorSnapshot,
  articles: readonly ProcessedArticle[],
  events: readonly MacroEvent[],
  latestDocument?: DocumentAnalysis,
  now = Date.now(),
): RiskScore {
  const series = snapshot.countries[code]?.series;
  const cpi = series?.cpi?.points ?? [];
  const rates = series?.policyRate?.points ?? [];
  const target = getCountry(code).inflationTarget;

  const cpiNow = cpi.at(-1)?.[1];
  const cpi3mAgo = cpi.at(-4)?.[1];
  const inflationValue =
    cpiNow === undefined
      ? 0
      : clamp(Math.abs(cpiNow - target) / 4, 0, 1) * 0.6 +
        (cpi3mAgo === undefined ? 0 : clamp(Math.abs(cpiNow - cpi3mAgo) / 1.5, 0, 1) * 0.4);

  const rateNow = rates.at(-1)?.[1];
  const rate6mAgo = rates.at(-7)?.[1];
  const rateDelta = rateNow !== undefined && rate6mAgo !== undefined ? rateNow - rate6mAgo : 0;

  const recent = articles.filter(
    (a) => a.country === code && a.weight > 0 && now - Date.parse(a.publishedAt) <= 14 * DAY,
  );
  const totalWeight = recent.reduce((s, a) => s + a.weight, 0);
  const stress = recent.reduce((s, a) => {
    const label = a.analysis.sentiment.label;
    return s + a.weight * (label === 'shock' ? 1 : label === 'negative' ? 0.6 : 0);
  }, 0);
  const newsValue = totalWeight > 0 ? clamp((stress / totalWeight) * 2, 0, 1) : 0;

  const eventCount = events.filter(
    (e) => e.country === code && now - Date.parse(e.date) <= 30 * DAY,
  ).length;
  const shift = latestDocument?.delta?.stanceShift ?? 0;

  const components: RiskComponent[] = [
    {
      key: 'inflation',
      label: 'Inflation pressure',
      weight: 25,
      value: inflationValue,
      detail:
        cpiNow === undefined ? 'no CPI data' : `CPI ${cpiNow.toFixed(1)}% vs ${target}% target`,
    },
    {
      key: 'rates',
      label: 'Policy rate change (6m)',
      weight: 20,
      value: clamp(Math.abs(rateDelta) / 1.5, 0, 1),
      detail: `${rateDelta >= 0 ? '+' : ''}${rateDelta.toFixed(2)}pp`,
    },
    {
      key: 'news',
      label: 'News stress (14d)',
      weight: 20,
      value: newsValue,
      detail: `${recent.length} weighted articles`,
    },
    {
      key: 'events',
      label: 'Event count (30d)',
      weight: 20,
      value: clamp(eventCount / 8, 0, 1),
      detail: `${eventCount} events`,
    },
    {
      key: 'language',
      label: 'Central bank language shift',
      weight: 15,
      value: clamp(Math.abs(shift) / 0.6, 0, 1),
      detail: latestDocument?.delta
        ? `${shift >= 0 ? '+' : ''}${shift.toFixed(2)} vs prior`
        : 'needs two analysed documents',
    },
  ];
  const score = round(
    components.reduce((s, c) => s + c.weight * c.value, 0),
    0,
  );
  return { score, level: score < 35 ? 'Low' : score < 60 ? 'Elevated' : 'High', components };
}
