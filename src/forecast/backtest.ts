/**
 * Walk-forward backtest of the forecast model on monthly BIS policy-rate and
 * CPI history for every tracked economy.
 *
 * Only indicator-derived inputs exist historically (inflation gap, CPI trend,
 * rate history, and the 2y yield for the US); document tone and news sentiment
 * are not reconstructable, so they are excluded here and the UI says so.
 *
 * Calibration is fitted on the pooled panel before TEST_START and evaluated
 * out-of-sample from TEST_START onward — no look-ahead.
 */
import { COUNTRIES } from '../shared/countries';
import { clamp, round, sigmoid } from '../shared/math';
import { monthIndex, toMonthMap } from '../shared/series';
import type { Confidence, CountryCode, IndicatorSnapshot } from '../shared/types';
import {
  confidenceFor,
  directionFor,
  probabilities,
  rawScore,
  type Calibration,
  type Direction,
  type PlattParams,
} from './model';
import { cpiTrendSignal, inflationGapSignal, marketSignal, rateHistorySignal } from './signals';

export const HORIZON_MONTHS = 3;
const MOVE_THRESHOLD = 0.1;
const TEST_START = '2015-01';
const FIRST_SAMPLE = '2003-01';

export type Outcome = 'tighten' | 'ease' | 'hold';

export interface BacktestSample {
  country: CountryCode;
  period: string;
  raw: number;
  inputs: number;
  outcome: Outcome;
}

/** Build one sample per month: features use data ≤ t (CPI lagged a month), label uses t+1..t+3. */
export function buildSamples(snapshot: IndicatorSnapshot, code: CountryCode): BacktestSample[] {
  const series = snapshot.countries[code]?.series;
  const rates = series?.policyRate?.points ?? [];
  const cpi = series?.cpi?.points ?? [];
  if (rates.length < 24 || cpi.length < 24) return [];
  const target = COUNTRIES.find((c) => c.code === code)!.inflationTarget;
  const rateByMonth = toMonthMap(rates);
  const cpiByMonth = toMonthMap(cpi);
  const yieldByMonth = toMonthMap(series?.yield2y?.points ?? []);

  const samples: BacktestSample[] = [];
  for (let i = 0; i < rates.length; i++) {
    const [period, rate] = rates[i]!;
    if (period < FIRST_SAMPLE) continue;
    const t = monthIndex(period);
    const future = [1, 2, 3].map((k) => rateByMonth.get(t + k));
    if (future.some((v) => v === undefined)) continue;
    const lastFourCpi = [4, 3, 2, 1].map((k) => cpiByMonth.get(t - k));
    if (lastFourCpi.some((v) => v === undefined)) continue;
    const cpiNow = lastFourCpi[3]!;

    const y2 = yieldByMonth.get(t);
    const { raw, inputs } = rawScore({
      inflationGap: inflationGapSignal(cpiNow, target),
      cpiTrend: cpiTrendSignal(lastFourCpi as number[]),
      rateHistory: rateHistorySignal(rates.slice(Math.max(0, i - 36), i + 1)),
      market: y2 === undefined ? null : marketSignal(y2, rate),
    });
    const up = Math.max(...(future as number[])) - rate;
    const down = Math.min(...(future as number[])) - rate;
    const outcome: Outcome =
      up >= MOVE_THRESHOLD && up >= -down ? 'tighten' : down <= -MOVE_THRESHOLD ? 'ease' : 'hold';
    samples.push({
      country: code,
      period,
      raw,
      inputs: inputs.filter((x) => x.available).length,
      outcome,
    });
  }
  return samples;
}

/** Fit P(y=1) = σ(a·x + b) by gradient descent on log-loss (Platt scaling). */
export function fitPlatt(
  xs: readonly number[],
  ys: readonly (0 | 1)[],
  iterations = 800,
  lr = 0.5,
): PlattParams {
  let a = 1;
  let b = 0;
  const n = xs.length;
  if (n === 0) return { a, b };
  for (let it = 0; it < iterations; it++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const err = sigmoid(a * xs[i]! + b) - ys[i]!;
      ga += err * xs[i]!;
      gb += err;
    }
    a -= (lr * ga) / n;
    b -= (lr * gb) / n;
  }
  return { a: round(a, 4), b: round(b, 4) };
}

export function calibrate(samples: readonly BacktestSample[], label: string): Calibration {
  const xs = samples.map((s) => s.raw / 100);
  return {
    tighten: fitPlatt(
      xs,
      samples.map((s) => (s.outcome === 'tighten' ? 1 : 0)),
    ),
    ease: fitPlatt(
      xs.map((x) => -x),
      samples.map((s) => (s.outcome === 'ease' ? 1 : 0)),
    ),
    fittedOn: label,
  };
}

export interface CalibrationBin {
  /** Bin lower edge, e.g. 0.2 for 20–30%. */
  from: number;
  predicted: number;
  observed: number;
  n: number;
}

export interface BacktestReport {
  country: CountryCode;
  testStart: string;
  testSamples: number;
  /** 3-class directional accuracy (tighten / ease / hold). */
  accuracy: number;
  /** Accuracy of always predicting the most common class — the bar to beat. */
  baselineAccuracy: number;
  brierTighten: number;
  calibrationBins: CalibrationBin[];
  byConfidence: Record<Confidence, { n: number; accuracy: number }>;
  calibration: Calibration;
  recent: { period: string; pTighten: number; predicted: Direction; outcome: Outcome }[];
}

const OUTCOME_OF: Record<Direction, Outcome> = {
  'LIKELY TIGHTEN': 'tighten',
  'LIKELY EASE': 'ease',
  'LIKELY HOLD': 'hold',
};

export function poolSamples(snapshot: IndicatorSnapshot): BacktestSample[] {
  return COUNTRIES.flatMap((c) => buildSamples(snapshot, c.code));
}

export function runBacktest(
  snapshot: IndicatorSnapshot,
  code: CountryCode,
  pooled = poolSamples(snapshot),
): BacktestReport | null {
  const train = pooled.filter((s) => s.period < TEST_START);
  const test = pooled.filter((s) => s.country === code && s.period >= TEST_START);
  if (train.length < 100 || test.length < 12) return null;
  const calibration = calibrate(train, `pooled panel, ${train.length} months before ${TEST_START}`);

  const scored = test.map((s) => {
    const p = probabilities(s.raw, calibration);
    return { s, p, predicted: directionFor(p), confidence: confidenceFor(s.raw, s.inputs) };
  });
  const correct = (x: (typeof scored)[number]) => OUTCOME_OF[x.predicted] === x.s.outcome;

  const counts = { tighten: 0, ease: 0, hold: 0 };
  for (const x of scored) counts[x.s.outcome]++;

  const bins: CalibrationBin[] = [];
  for (let k = 0; k < 10; k++) {
    const inBin = scored.filter((x) => clamp(Math.floor(x.p.pTighten * 10), 0, 9) === k);
    if (inBin.length === 0) continue;
    bins.push({
      from: k / 10,
      predicted: round(inBin.reduce((s, x) => s + x.p.pTighten, 0) / inBin.length, 3),
      observed: round(inBin.filter((x) => x.s.outcome === 'tighten').length / inBin.length, 3),
      n: inBin.length,
    });
  }

  const byConfidence = Object.fromEntries(
    (['HIGH', 'MODERATE', 'LOW'] as const).map((tier) => {
      const group = scored.filter((x) => x.confidence === tier);
      return [
        tier,
        {
          n: group.length,
          accuracy: group.length ? round(group.filter(correct).length / group.length, 3) : 0,
        },
      ];
    }),
  ) as BacktestReport['byConfidence'];

  return {
    country: code,
    testStart: TEST_START,
    testSamples: scored.length,
    accuracy: round(scored.filter(correct).length / scored.length, 3),
    baselineAccuracy: round(Math.max(counts.tighten, counts.ease, counts.hold) / scored.length, 3),
    brierTighten: round(
      scored.reduce((s, x) => s + (x.p.pTighten - (x.s.outcome === 'tighten' ? 1 : 0)) ** 2, 0) /
        scored.length,
      4,
    ),
    calibrationBins: bins,
    byConfidence,
    calibration,
    recent: scored.slice(-12).map((x) => ({
      period: x.s.period,
      pTighten: round(x.p.pTighten, 3),
      predicted: x.predicted,
      outcome: x.s.outcome,
    })),
  };
}
