/**
 * Historical Parallels (PRD §5.2): for an event detected in an article, find
 * comparable past episodes in the stored indicator archive and report what
 * happened next. Pattern-matching against real data — nothing generated.
 */
import { median, round } from '../shared/math';
import { periodFromMonthIndex, toMonthMap } from '../shared/series';
import type { CountryCode, EventType, IndicatorSnapshot, RateDirection } from '../shared/types';
import { relativeAppreciation } from './fx';

export interface ParallelEpisode {
  period: string;
  trigger: string;
  /** Outcome metrics after the episode, keyed by label. */
  after: Record<string, number | undefined>;
}

export interface ParallelsResult {
  description: string;
  episodes: ParallelEpisode[];
  summary: Record<string, number>;
}

const HORIZON = 3;

export function findParallels(
  snapshot: IndicatorSnapshot,
  code: CountryCode,
  type: EventType,
  direction?: RateDirection,
  limit = 6,
): ParallelsResult | null {
  const series = snapshot.countries[code]?.series;
  const rates = toMonthMap(series?.policyRate?.points ?? []);
  const cpi = toMonthMap(series?.cpi?.points ?? []);
  // FX vs USD; for the US itself use EUR as the counter-currency.
  const fxPartner: CountryCode = code === 'US' ? 'EA' : 'US';
  const fxLabel = `${code === 'US' ? 'USD vs EUR' : 'vs USD'} % (${HORIZON}m)`;

  const episodes: ParallelEpisode[] = [];
  const months = [...rates.keys()].sort((a, b) => b - a); // newest first

  if (type === 'RATE_DECISION' && direction && direction !== 'hold') {
    let lastTaken = Infinity;
    for (const m of months) {
      const d = (rates.get(m) ?? NaN) - (rates.get(m - 1) ?? NaN);
      const hit = direction === 'hike' ? d >= 0.1 : d <= -0.1;
      if (!hit || lastTaken - m < 6) continue;
      if (rates.get(m + HORIZON) === undefined) continue;
      lastTaken = m;
      episodes.push({
        period: periodFromMonthIndex(m),
        trigger: `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}bp move`,
        after: {
          [fxLabel]: maybeRound(relativeAppreciation(snapshot, code, fxPartner, m, m + HORIZON)),
          [`CPI change pp (${HORIZON}m)`]: diff(cpi, m, m + HORIZON),
          [`Further rate change pp (${HORIZON}m)`]: diff(rates, m, m + HORIZON),
        },
      });
      if (episodes.length >= limit) break;
    }
    return summarise(
      `Past ${direction === 'hike' ? 'hikes' : 'cuts'} in this economy and what followed`,
      episodes,
    );
  }

  if (type === 'INFLATION_PRINT') {
    let lastTaken = Infinity;
    for (const m of [...cpi.keys()].sort((a, b) => b - a)) {
      const jump = diff(cpi, m - 1, m);
      if (jump === undefined || Math.abs(jump) < 0.4 || lastTaken - m < 6) continue;
      if (rates.get(m + HORIZON) === undefined) continue;
      lastTaken = m;
      episodes.push({
        period: periodFromMonthIndex(m),
        trigger: `CPI ${jump > 0 ? 'jumped' : 'dropped'} ${Math.abs(jump).toFixed(1)}pp in a month`,
        after: {
          [`Policy rate change pp (${HORIZON}m)`]: diff(rates, m, m + HORIZON),
          [fxLabel]: maybeRound(relativeAppreciation(snapshot, code, fxPartner, m, m + HORIZON)),
        },
      });
      if (episodes.length >= limit) break;
    }
    return summarise('Past large inflation surprises and the policy response', episodes);
  }
  return null;
}

function diff(map: Map<number, number>, from: number, to: number): number | undefined {
  const a = map.get(from);
  const b = map.get(to);
  return a === undefined || b === undefined ? undefined : round(b - a, 2);
}

const maybeRound = (x: number | undefined) => (x === undefined ? undefined : round(x, 2));

function summarise(description: string, episodes: ParallelEpisode[]): ParallelsResult | null {
  if (episodes.length === 0) return null;
  const keys = Object.keys(episodes[0]!.after);
  const summary: Record<string, number> = {};
  for (const k of keys) {
    const vals = episodes.map((e) => e.after[k]).filter((v): v is number => v !== undefined);
    if (vals.length) summary[k] = round(median(vals), 2);
  }
  return { description, episodes, summary };
}
