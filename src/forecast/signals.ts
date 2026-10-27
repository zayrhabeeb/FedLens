/**
 * Forecast input signals. Each maps raw data to a value in [-1, 1]
 * (+1 = pressure to tighten, -1 = pressure to ease). These are pure functions
 * of data available at time t, so the backtest reuses them unchanged.
 */
import { clamp, mean } from '../shared/math';
import type { Point, Stance } from '../shared/types';
import type { DocumentAnalysis } from '../nlp/document';
import type { ProcessedArticle } from '../nlp/analyze';

export type InputKey =
  | 'inflationGap'
  | 'cpiTrend'
  | 'documentTone'
  | 'guidance'
  | 'rateHistory'
  | 'newsSentiment'
  | 'market';

/** PRD §8.2 weights (sum = 100). */
export const INPUT_WEIGHTS: Record<InputKey, number> = {
  inflationGap: 25,
  cpiTrend: 15,
  documentTone: 20,
  guidance: 10,
  rateHistory: 15,
  newsSentiment: 10,
  market: 5,
};

export const INPUT_LABELS: Record<InputKey, string> = {
  inflationGap: 'Inflation vs target',
  cpiTrend: 'CPI trend (3 prints)',
  documentTone: 'Central bank document tone',
  guidance: 'Forward guidance',
  rateHistory: 'Rate history',
  newsSentiment: 'News sentiment (14 days)',
  market: 'Market-implied (2y vs policy)',
};

export interface Signal {
  value: number;
  detail: string;
}

/** 3pp above target saturates at +1. */
export function inflationGapSignal(cpi: number, target: number): Signal {
  return {
    value: clamp((cpi - target) / 3, -1, 1),
    detail: `CPI ${cpi.toFixed(1)}% vs ${target}% target`,
  };
}

/** Direction of the last three changes in YoY CPI: rising = +, falling = −. */
export function cpiTrendSignal(lastFour: readonly number[]): Signal | null {
  if (lastFour.length < 4) return null;
  const moves = [1, 2, 3].map((i) => {
    const d = lastFour[i]! - lastFour[i - 1]!;
    return Math.abs(d) < 0.05 ? 0 : Math.sign(d);
  });
  const rising = moves.filter((m) => m > 0).length;
  const falling = moves.filter((m) => m < 0).length;
  return { value: mean(moves), detail: `rising ${rising} of 3, falling ${falling} of 3` };
}

/**
 * Last policy move direction, decaying with time since that move.
 * A hike last month is a strong tightening signal; one two years ago is not.
 */
export function rateHistorySignal(points: readonly Point[]): Signal | null {
  if (points.length < 2) return null;
  let lastMove = 0;
  let monthsSince = 0;
  let holds = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const d = points[i]![1] - points[i - 1]![1];
    if (Math.abs(d) >= 0.05) {
      lastMove = Math.sign(d);
      break;
    }
    monthsSince++;
    holds++;
  }
  if (lastMove === 0) return { value: 0, detail: 'no move in available history' };
  const decay = monthsSince <= 2 ? 1 : monthsSince <= 6 ? 0.6 : monthsSince <= 12 ? 0.3 : 0.1;
  return {
    value: lastMove * decay,
    detail: `last move ${lastMove > 0 ? 'hike' : 'cut'}, ${holds} month(s) on hold since`,
  };
}

export function documentToneSignal(doc: DocumentAnalysis): Signal {
  return {
    value: clamp(doc.stance.score * 2, -1, 1),
    detail: `${doc.stance.label} (${doc.title})`,
  };
}

export function guidanceSignal(doc: DocumentAnalysis): Signal | null {
  const { type, bias } = doc.guidance;
  if (type === 'none') return null;
  const dir: Record<Stance, number> = { hawkish: 1, neutral: 0, dovish: -1 };
  return {
    value: dir[bias] * (type === 'explicit' ? 1 : 0.5),
    detail: `${type}, ${bias} bias`,
  };
}

/** Credibility-weighted mean monetary tone of recent articles. */
export function newsSentimentSignal(articles: readonly ProcessedArticle[]): Signal | null {
  const scored = articles.filter((a) => a.weight > 0 && a.analysis.sentiment.monetaryScore !== 0);
  if (scored.length < 3) return null;
  const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
  const tone =
    scored.reduce((s, a) => s + a.weight * a.analysis.sentiment.monetaryScore, 0) / totalWeight;
  return {
    value: clamp(tone * 2, -1, 1),
    detail: `${scored.length} rate-relevant articles, net ${tone > 0.05 ? 'hawkish' : tone < -0.05 ? 'dovish' : 'neutral'}`,
  };
}

/** 2-year yield above the policy rate means markets price hikes. 75bp saturates. */
export function marketSignal(yield2y: number, policyRate: number): Signal {
  const spread = yield2y - policyRate;
  return {
    value: clamp(spread / 0.75, -1, 1),
    detail: `2y ${yield2y.toFixed(2)}% vs policy ${policyRate.toFixed(2)}% (${spread >= 0 ? '+' : ''}${(spread * 100).toFixed(0)}bp)`,
  };
}
