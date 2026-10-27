/**
 * Central bank document analysis (PRD §7): quality gate, stance, forward
 * guidance, rate decision, dissent, and a phrase-level delta engine against
 * the previous document from the same bank. Fully deterministic.
 */
import { getCountry } from '../shared/countries';
import { fnv1a, round } from '../shared/math';
import type { Confidence, CountryCode, RateDirection, Stance } from '../shared/types';
import { analyzeText } from './analyze';
import type { MacroEvent } from './events';
import { TOPIC_KEYWORDS } from './lexicon';
import { stanceFromScore } from './sentiment';
import { findPhrases } from './text';

export const MIN_DOCUMENT_CHARS = 500;
const RECOMMENDED_CHARS = 1500;
const RECOMMENDED_KEYWORDS = 10;

export interface DocumentQuality {
  chars: number;
  macroKeywordHits: number;
  /** 0–100, from length and keyword density. */
  score: number;
  passed: boolean;
  issues: string[];
}

export interface ForwardGuidance {
  type: 'explicit' | 'conditional' | 'none';
  bias: Stance;
  sentenceIndexes: number[];
}

export interface PhraseDelta {
  added: string[];
  removed: string[];
  /** Change in monetary score vs prior document (positive = more hawkish). */
  stanceShift: number;
  priorDocumentId: string;
}

export interface DocumentAnalysis {
  id: string;
  country: CountryCode;
  title: string;
  analyzedAt: string;
  text: string;
  quality: DocumentQuality;
  stance: { label: Stance; score: number; hawkishSentences: number[]; dovishSentences: number[] };
  guidance: ForwardGuidance;
  rateDecision?: { direction: RateDirection; figures: string[] };
  dissent: { count: number; sentenceIndexes: number[] };
  keySentences: number[];
  sentences: string[];
  delta?: PhraseDelta;
  events: MacroEvent[];
}

const EXPLICIT_GUIDANCE = [
  'will be appropriate',
  'intends to',
  'expects to',
  'anticipates that',
  'will continue to',
  'ongoing increases',
  'further increases',
  'committed to',
];
const CONDITIONAL_GUIDANCE = [
  'depending on',
  'data dependent',
  'data-dependent',
  'as warranted',
  'will assess',
  'incoming data',
  'meeting by meeting',
  'meeting-by-meeting',
  'if conditions',
  'evolving outlook',
  'balance of risks',
  'prepared to adjust',
];
const POLICY_TERMS = [
  'policy rate',
  'target range',
  'interest rate',
  'monetary policy',
  'policy stance',
  'bank rate',
  'cash rate',
  'repo rate',
  'adjustments',
];
const DISSENT = [
  'dissent',
  'dissented',
  'voted against',
  'voting against',
  'preferred to',
  'preferred an increase',
  'preferred a reduction',
];
const DELTA_ANCHORS = new Set([
  'inflation',
  'rate',
  'rates',
  'policy',
  'growth',
  'labor',
  'labour',
  'employment',
  'risks',
  'prices',
  'tightening',
  'easing',
  'economic',
  'uncertainty',
  'target',
  'range',
  'restrictive',
  'demand',
  'wage',
  'wages',
  'outlook',
]);
const ALL_MACRO_KEYWORDS = Object.values(TOPIC_KEYWORDS).flat();

export function assessQuality(text: string): DocumentQuality {
  const chars = text.trim().length;
  const macroKeywordHits = findPhrases(text, ALL_MACRO_KEYWORDS).length;
  const issues: string[] = [];
  if (chars < RECOMMENDED_CHARS)
    issues.push(`Short document (${chars} chars; ≥${RECOMMENDED_CHARS} recommended).`);
  if (macroKeywordHits < RECOMMENDED_KEYWORDS)
    issues.push(`Few macro keywords (${macroKeywordHits}; ≥${RECOMMENDED_KEYWORDS} recommended).`);
  const score = Math.round(
    50 * Math.min(1, chars / 5000) + 50 * Math.min(1, macroKeywordHits / 30),
  );
  return { chars, macroKeywordHits, score, passed: chars >= MIN_DOCUMENT_CHARS, issues };
}

/** Word trigrams that contain at least one policy-relevant anchor word. */
export function policyPhrases(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) {
    const tri = words.slice(i, i + 3);
    if (tri.some((w) => DELTA_ANCHORS.has(w.replace(/\.$/, ''))))
      out.add(tri.join(' ').replace(/\.$/, ''));
  }
  return [...out];
}

export function diffPhrases(
  current: string,
  prior: string,
): { added: string[]; removed: string[] } {
  const now = policyPhrases(current);
  const before = policyPhrases(prior);
  const beforeSet = new Set(before);
  const nowSet = new Set(now);
  return {
    added: now.filter((p) => !beforeSet.has(p)).slice(0, 12),
    removed: before.filter((p) => !nowSet.has(p)).slice(0, 12),
  };
}

export function analyzeDocument(
  text: string,
  country: CountryCode,
  title: string,
  prior?: DocumentAnalysis,
  now = new Date(),
): DocumentAnalysis {
  const quality = assessQuality(text);
  if (!quality.passed) {
    throw new Error(
      `Document too short to analyse (${quality.chars} characters; minimum ${MIN_DOCUMENT_CHARS}).`,
    );
  }
  const analysis = analyzeText(text, { countryHint: country, headlineSentences: 0 });
  const signals = analysis.sentiment.perSentence;
  const score = round(analysis.sentiment.monetaryScore, 3);

  const guidanceIdx = analysis.sentences
    .filter(
      (s) =>
        findPhrases(s.text, POLICY_TERMS).length > 0 &&
        findPhrases(s.text, [...EXPLICIT_GUIDANCE, ...CONDITIONAL_GUIDANCE]).length > 0,
    )
    .map((s) => s.index);
  const guidanceText = guidanceIdx.map((i) => analysis.sentences[i]!.text).join(' ');
  const explicit = findPhrases(guidanceText, EXPLICIT_GUIDANCE).length;
  const conditional = findPhrases(guidanceText, CONDITIONAL_GUIDANCE).length;
  const guidanceSignal = guidanceIdx.reduce(
    (acc, i) => acc + (signals[i]!.hawkish - signals[i]!.dovish),
    0,
  );

  const actions = analysis.entities.filter((e) => e.kind === 'action');
  const direction: RateDirection | undefined = actions.some((a) => a.normalized === 'rate hike')
    ? 'hike'
    : actions.some((a) => a.normalized === 'rate cut')
      ? 'cut'
      : actions.some((a) => a.normalized === 'rate hold')
        ? 'hold'
        : undefined;
  const rateFigures = analysis.entities
    .filter((e) => e.kind === 'figure' && e.metric === 'policy rate')
    .map((e) => e.normalized);

  const dissentIdx = analysis.sentences
    .filter((s) => findPhrases(s.text, DISSENT).length > 0)
    .map((s) => s.index);
  const keySentences = signals
    .map((s) => ({
      i: s.index,
      weight:
        Math.abs(s.hawkish - s.dovish) +
        s.shock +
        (analysis.claims.some((c) => c.sentenceIndex === s.index) ? 1 : 0),
    }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((s) => s.i)
    .sort((a, b) => a - b);

  const id = fnv1a(`${country}|${title}|${text.length}|${text.slice(0, 200)}`);
  const date = now.toISOString().slice(0, 10);
  const bank = getCountry(country).centralBankShort;
  const delta = prior
    ? {
        ...diffPhrases(text, prior.text),
        stanceShift: round(score - prior.stance.score, 3),
        priorDocumentId: prior.id,
      }
    : undefined;

  // Document → event bridge (PRD §7): rate decisions and clear guidance shifts become events.
  const confidence: Confidence = rateFigures.length > 0 ? 'HIGH' : 'MODERATE';
  const events: MacroEvent[] = [];
  if (direction) {
    events.push({
      id: fnv1a(`doc|${id}|rate`),
      country,
      type: 'RATE_DECISION',
      date,
      headline: `${bank} ${direction === 'hold' ? 'holds rates' : direction === 'hike' ? 'raises rates' : 'cuts rates'}${rateFigures[0] ? ` (${rateFigures[0]})` : ''} — from "${title}"`,
      entities: [getCountry(country).centralBank, ...rateFigures].slice(0, 6),
      sentiment: stanceFromScore(score),
      direction,
      sourceArticleIds: [],
      confidence,
      linkedDocumentId: id,
    });
  }
  if (delta && Math.abs(delta.stanceShift) >= 0.3) {
    events.push({
      id: fnv1a(`doc|${id}|guidance`),
      country,
      type: 'CENTRAL_BANK_SPEECH',
      date,
      headline: `${bank} language shifted ${delta.stanceShift > 0 ? 'hawkish' : 'dovish'} vs prior document`,
      entities: [getCountry(country).centralBank],
      sentiment: delta.stanceShift > 0 ? 'hawkish' : 'dovish',
      sourceArticleIds: [],
      confidence: 'MODERATE',
      linkedDocumentId: id,
    });
  }

  return {
    id,
    country,
    title,
    analyzedAt: now.toISOString(),
    text,
    quality,
    stance: {
      label: stanceFromScore(score),
      score,
      hawkishSentences: signals.filter((s) => s.hawkish > s.dovish).map((s) => s.index),
      dovishSentences: signals.filter((s) => s.dovish > s.hawkish).map((s) => s.index),
    },
    guidance: {
      type: guidanceIdx.length === 0 ? 'none' : explicit > conditional ? 'explicit' : 'conditional',
      bias: guidanceSignal > 0 ? 'hawkish' : guidanceSignal < 0 ? 'dovish' : 'neutral',
      sentenceIndexes: guidanceIdx,
    },
    ...(direction ? { rateDecision: { direction, figures: rateFigures } } : {}),
    dissent: { count: dissentIdx.length, sentenceIndexes: dissentIdx },
    keySentences,
    sentences: analysis.sentences.map((s) => s.text),
    ...(delta ? { delta } : {}),
    events,
  };
}
