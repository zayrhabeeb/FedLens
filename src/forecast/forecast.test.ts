import { describe, expect, it } from 'vitest';
import type { IndicatorSnapshot, Point } from '../shared/types';
import { buildSamples, calibrate, fitPlatt, runBacktest } from './backtest';
import { confidenceFor, forecast, probabilities, rawScore } from './model';
import { cpiTrendSignal, inflationGapSignal, marketSignal, rateHistorySignal } from './signals';

describe('signals', () => {
  it('saturates the inflation gap at ±3pp', () => {
    expect(inflationGapSignal(5, 2).value).toBe(1);
    expect(inflationGapSignal(0.5, 2).value).toBeCloseTo(-0.5);
  });

  it('scores CPI direction over the last three prints', () => {
    expect(cpiTrendSignal([2, 2.2, 2.4, 2.6])?.value).toBe(1);
    expect(cpiTrendSignal([3, 2.8, 2.8, 2.9])?.value).toBeCloseTo(0);
    expect(cpiTrendSignal([1, 2])).toBeNull();
  });

  it('decays the last policy move with time', () => {
    const recentHike: Point[] = [
      ['2026-01', 4],
      ['2026-02', 4.25],
    ];
    const oldCut: Point[] = [
      ['2025-01', 4],
      ['2025-02', 3.75],
      ...Array.from({ length: 13 }, (_, i): Point => [`m${i}`, 3.75]),
    ];
    expect(rateHistorySignal(recentHike)?.value).toBe(1);
    expect(rateHistorySignal(oldCut)?.value).toBeCloseTo(-0.1);
  });

  it('reads market pricing from the 2y–policy spread', () => {
    expect(marketSignal(4.5, 3.75).value).toBe(1);
    expect(marketSignal(3.5, 3.75).value).toBeCloseTo(-1 / 3);
  });
});

describe('model', () => {
  it('re-weights over available inputs only', () => {
    const { raw, inputs } = rawScore({
      inflationGap: { value: 1, detail: '' },
      rateHistory: { value: -1, detail: '' },
    });
    // (25·1 + 15·−1) / 40 × 100 = 25
    expect(raw).toBe(25);
    expect(inputs.find((i) => i.key === 'newsSentiment')?.available).toBe(false);
  });

  it('keeps probabilities coherent and monotonic in the score', () => {
    const cal = { tighten: { a: 4, b: -2 }, ease: { a: 4, b: -2 }, fittedOn: 'test' };
    const low = probabilities(-80, cal);
    const high = probabilities(80, cal);
    expect(high.pTighten).toBeGreaterThan(low.pTighten);
    expect(low.pEase).toBeGreaterThan(high.pEase);
    for (const p of [low, high]) expect(p.pTighten + p.pEase + p.pHold).toBeCloseTo(1);
    expect(
      forecast(
        {
          inflationGap: { value: 1, detail: '' },
          cpiTrend: { value: 1, detail: '' },
          rateHistory: { value: 1, detail: '' },
        },
        cal,
      ).direction,
    ).toBe('LIKELY TIGHTEN');
  });

  it('assigns categorical confidence from score strength and evidence breadth', () => {
    expect(confidenceFor(80, 2)).toBe('LOW');
    expect(confidenceFor(50, 4)).toBe('HIGH');
    expect(confidenceFor(20, 4)).toBe('MODERATE');
  });
});

describe('backtest', () => {
  it('fits Platt scaling that separates classes', () => {
    const xs = [-1, -0.8, -0.5, 0.5, 0.8, 1];
    const p = fitPlatt(xs, [0, 0, 0, 1, 1, 1]);
    expect(p.a).toBeGreaterThan(0);
  });

  /** Synthetic economy: CPI overshoots, then the central bank hikes 3 months later. */
  function syntheticSnapshot(): IndicatorSnapshot {
    const rates: Point[] = [];
    const cpi: Point[] = [];
    let rate = 2;
    for (let i = 0; i < 300; i++) {
      const y = 2001 + Math.floor(i / 12);
      const period = `${y}-${String((i % 12) + 1).padStart(2, '0')}`;
      const cycle = Math.sin(i / 8);
      cpi.push([period, 2 + 2 * cycle]);
      if (i >= 3)
        rate += Math.sin((i - 3) / 8) > 0.6 ? 0.25 : Math.sin((i - 3) / 8) < -0.6 ? -0.25 : 0;
      rates.push([period, rate]);
    }
    const series = (key: 'cpi' | 'policyRate', points: Point[]) => ({
      key,
      label: key,
      unit: '%',
      frequency: 'M' as const,
      source: 'bis' as const,
      points,
    });
    return {
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      sources: [],
      countries: {
        US: {
          code: 'US',
          series: { cpi: series('cpi', cpi), policyRate: series('policyRate', rates) },
        },
      },
    };
  }

  it('builds look-ahead-free samples and beats the naive baseline on a learnable process', () => {
    const snap = syntheticSnapshot();
    const samples = buildSamples(snap, 'US');
    expect(samples.length).toBeGreaterThan(200);
    expect(samples.every((s) => s.period >= '2003-01')).toBe(true);
    const report = runBacktest(snap, 'US', samples);
    expect(report).not.toBeNull();
    expect(report!.accuracy).toBeGreaterThan(report!.baselineAccuracy);
    expect(calibrate(samples, 'x').tighten.a).toBeGreaterThan(0);
  });
});
