/**
 * Divergence Detector (PRD §9.4). Rule-based, so it is fast, reproducible and
 * explainable. Historical FX outcomes come from real ECB/BIS history.
 */
import { getCountry } from '../shared/countries';
import { median, round } from '../shared/math';
import { monthIndex, toMonthMap } from '../shared/series';
import type { CountryCode, IndicatorSnapshot } from '../shared/types';
import type { MacroEvent } from '../nlp/events';
import type { Direction } from '../forecast/model';
import { relativeAppreciation } from './fx';

export interface DivergenceAlert {
  kind: 'stance' | 'cycle' | 'shock';
  countries: [CountryCode, CountryCode];
  message: string;
  /** Historical evidence, when the archive has comparable episodes. */
  history?: { episodes: number; medianAppreciation: number; horizonMonths: number };
}

const CYCLE_MONTHS = 6;
const CYCLE_THRESHOLD = 0.25;

function rateChange(
  snapshot: IndicatorSnapshot,
  code: CountryCode,
  month: number,
): number | undefined {
  const map = toMonthMap(snapshot.countries[code]?.series.policyRate?.points ?? []);
  const now = map.get(month);
  const before = map.get(month - CYCLE_MONTHS);
  return now === undefined || before === undefined ? undefined : now - before;
}

/**
 * Past months where A was hiking and B cutting (or the reverse, matching the
 * current sign), and how A's currency moved against B's over the next 6 months.
 */
export function historicalCycleDivergence(
  snapshot: IndicatorSnapshot,
  a: CountryCode,
  b: CountryCode,
  aHiking: boolean,
) {
  const points = snapshot.countries[a]?.series.policyRate?.points ?? [];
  const outcomes: number[] = [];
  let lastEpisode = -Infinity;
  for (const [period] of points) {
    const m = monthIndex(period);
    if (m - lastEpisode < 12) continue; // one sample per episode
    const da = rateChange(snapshot, a, m);
    const db = rateChange(snapshot, b, m);
    if (da === undefined || db === undefined) continue;
    const matches = aHiking
      ? da >= CYCLE_THRESHOLD && db <= -CYCLE_THRESHOLD
      : da <= -CYCLE_THRESHOLD && db >= CYCLE_THRESHOLD;
    if (!matches) continue;
    const move = relativeAppreciation(snapshot, a, b, m, m + CYCLE_MONTHS);
    if (move === undefined) continue;
    outcomes.push(move);
    lastEpisode = m;
  }
  return outcomes.length
    ? {
        episodes: outcomes.length,
        medianAppreciation: round(median(outcomes), 2),
        horizonMonths: CYCLE_MONTHS,
      }
    : undefined;
}

export function detectDivergences(
  codes: readonly CountryCode[],
  snapshot: IndicatorSnapshot,
  directions: Partial<Record<CountryCode, Direction>>,
  events: readonly MacroEvent[],
  now = Date.now(),
): DivergenceAlert[] {
  const alerts: DivergenceAlert[] = [];
  const shockTypes = new Set(['CURRENCY_SHOCK', 'EXTERNAL_SHOCK']);
  const recentShock = (c: CountryCode) =>
    events.some(
      (e) =>
        e.country === c &&
        (shockTypes.has(e.type) || e.sentiment === 'shock') &&
        now - Date.parse(e.date) <= 30 * 86_400_000,
    );

  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const a = codes[i]!;
      const b = codes[j]!;
      const [na, nb] = [getCountry(a).name, getCountry(b).name];

      const da = directions[a];
      const db = directions[b];
      if (
        (da === 'LIKELY TIGHTEN' && db === 'LIKELY EASE') ||
        (da === 'LIKELY EASE' && db === 'LIKELY TIGHTEN')
      ) {
        alerts.push({
          kind: 'stance',
          countries: [a, b],
          message: `Policy divergence detected: ${na} leans ${da === 'LIKELY TIGHTEN' ? 'tighter' : 'looser'}, ${nb} the opposite — may drive an FX differential.`,
        });
      }

      const latestA = snapshot.countries[a]?.series.policyRate?.points.at(-1)?.[0];
      const latestB = snapshot.countries[b]?.series.policyRate?.points.at(-1)?.[0];
      if (latestA && latestB) {
        const m = Math.min(monthIndex(latestA), monthIndex(latestB));
        const ca = rateChange(snapshot, a, m);
        const cb = rateChange(snapshot, b, m);
        if (
          ca !== undefined &&
          cb !== undefined &&
          Math.abs(ca) >= CYCLE_THRESHOLD &&
          Math.abs(cb) >= CYCLE_THRESHOLD &&
          Math.sign(ca) !== Math.sign(cb)
        ) {
          const aHiking = ca > 0;
          const history = historicalCycleDivergence(snapshot, a, b, aHiking);
          alerts.push({
            kind: 'cycle',
            countries: [a, b],
            message: `Cycle divergence: ${na} ${aHiking ? 'hiking' : 'cutting'} (${ca >= 0 ? '+' : ''}${ca.toFixed(2)}pp/6m) while ${nb} is ${aHiking ? 'cutting' : 'hiking'} (${cb >= 0 ? '+' : ''}${cb.toFixed(2)}pp/6m).`,
            ...(history ? { history } : {}),
          });
        }
      }

      const sa = recentShock(a);
      const sb = recentShock(b);
      if (sa !== sb) {
        alerts.push({
          kind: 'shock',
          countries: [a, b],
          message: `Shock asymmetry: ${sa ? na : nb} had a shock event in the last 30 days; ${sa ? nb : na} did not.`,
        });
      }
    }
  }
  return alerts;
}
