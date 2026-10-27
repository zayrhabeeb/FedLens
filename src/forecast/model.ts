/**
 * Policy Forecast Lab (PRD §8): probability of tightening / easing in the next
 * ~3 months (≈1–3 meetings), built from a transparent weighted score.
 *
 *   raw = Σ wᵢ·sᵢ / Σ wᵢ (available inputs only) × 100      ∈ [-100, 100]
 *   P(tighten) = σ(aₜ·raw/100 + bₜ)     P(ease) = σ(aₑ·(−raw/100) + bₑ)
 *
 * The Platt-scaling parameters (a, b) are fitted on the historical backtest
 * (see backtest.ts), so probabilities are calibrated against real outcomes.
 */
import { clamp, round, sigmoid } from '../shared/math';
import type { Confidence } from '../shared/types';
import { INPUT_LABELS, INPUT_WEIGHTS, type InputKey, type Signal } from './signals';

export interface PlattParams {
  a: number;
  b: number;
}

export interface Calibration {
  tighten: PlattParams;
  ease: PlattParams;
  /** Where the parameters came from, shown in the UI. */
  fittedOn: string;
}

/** Conservative defaults used only until a backtest has been run. */
export const DEFAULT_CALIBRATION: Calibration = {
  tighten: { a: 3, b: -1.6 },
  ease: { a: 3, b: -1.6 },
  fittedOn: 'default priors (no backtest yet)',
};

export interface InputContribution {
  key: InputKey;
  label: string;
  weight: number;
  available: boolean;
  /** Signal in [-1, 1]; null when the input is unavailable. */
  signal: number | null;
  /** Contribution to the raw score after re-weighting, in points. */
  points: number;
  detail: string;
}

export type Direction = 'LIKELY TIGHTEN' | 'LIKELY EASE' | 'LIKELY HOLD';

export interface ForecastResult {
  raw: number;
  pTighten: number;
  pEase: number;
  pHold: number;
  direction: Direction;
  confidence: Confidence;
  inputs: InputContribution[];
  calibration: Calibration;
}

export function rawScore(signals: Partial<Record<InputKey, Signal | null>>): {
  raw: number;
  inputs: InputContribution[];
} {
  const keys = Object.keys(INPUT_WEIGHTS) as InputKey[];
  const availableWeight = keys.reduce((s, k) => s + (signals[k] ? INPUT_WEIGHTS[k] : 0), 0);
  const inputs = keys.map((key): InputContribution => {
    const sig = signals[key];
    const weight = INPUT_WEIGHTS[key];
    return {
      key,
      label: INPUT_LABELS[key],
      weight,
      available: Boolean(sig),
      signal: sig ? round(sig.value, 3) : null,
      points:
        sig && availableWeight > 0 ? round((sig.value * weight * 100) / availableWeight, 1) : 0,
      detail: sig ? sig.detail : 'not available',
    };
  });
  const raw = round(
    inputs.reduce((s, i) => s + i.points, 0),
    1,
  );
  return { raw: clamp(raw, -100, 100), inputs };
}

export function probabilities(raw: number, calibration: Calibration) {
  const x = raw / 100;
  const pTighten = sigmoid(calibration.tighten.a * x + calibration.tighten.b);
  const pEase = sigmoid(calibration.ease.a * -x + calibration.ease.b);
  // The two models are fitted independently; normalise if they overlap.
  const total = pTighten + pEase;
  const scale = total > 1 ? 1 / total : 1;
  return {
    pTighten: pTighten * scale,
    pEase: pEase * scale,
    pHold: Math.max(0, 1 - total * scale),
  };
}

export function directionFor(p: { pTighten: number; pEase: number; pHold: number }): Direction {
  if (p.pTighten >= p.pEase && p.pTighten >= p.pHold) return 'LIKELY TIGHTEN';
  if (p.pEase >= p.pHold) return 'LIKELY EASE';
  return 'LIKELY HOLD';
}

/** Categorical confidence: strength of the score and breadth of evidence. */
export function confidenceFor(raw: number, availableInputs: number): Confidence {
  if (availableInputs < 3) return 'LOW';
  if (Math.abs(raw) >= 40) return 'HIGH';
  if (Math.abs(raw) >= 15) return 'MODERATE';
  return 'LOW';
}

export function forecast(
  signals: Partial<Record<InputKey, Signal | null>>,
  calibration: Calibration = DEFAULT_CALIBRATION,
): ForecastResult {
  const { raw, inputs } = rawScore(signals);
  const p = probabilities(raw, calibration);
  return {
    raw,
    ...p,
    direction: directionFor(p),
    confidence: confidenceFor(raw, inputs.filter((i) => i.available).length),
    inputs,
    calibration,
  };
}
