/**
 * Deterministic entity extraction: economic figures (%, bp, currency amounts),
 * institutions, countries and policy actions. Every entity carries the sentence
 * it came from so the UI can highlight its source ("claim grounding").
 */
import { COUNTRIES } from '../shared/countries';
import type { Confidence, CountryCode } from '../shared/types';
import { HEDGES, INSTITUTIONS, METRIC_CUES, POLICY_ACTIONS } from './lexicon';
import { findPhrases, type Sentence } from './text';
import type { Claim, Entity } from './types';

const RANGE_PCT =
  /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s?%?\s?(?:-|–|to)\s?(\d{1,2}(?:\.\d{1,2})?)\s?(?:%|percent|per cent)/gi;
const PCT = /(?<![\d.])([-+−]?\d{1,3}(?:\.\d{1,2})?)\s?(?:%|percent|per cent)/gi;
const BASIS_POINTS = /(?<![\d.])(\d{1,3})(?:\s|-)?(?:basis[- ]points?|bps|bp)\b/gi;
const NAMED_BP: Record<string, number> = {
  'quarter-point': 25,
  'quarter point': 25,
  'half-point': 50,
  'half point': 50,
  'three-quarter-point': 75,
};
const NAMED_BP_RE = /\b(three-quarter-point|quarter[- ]point|half[- ]point)\b/gi;
const CURRENCY =
  /(US\$|R\$|[$€£¥₹])\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|tn|bn|mn)?\b/gi;

/**
 * Nearest metric cue to a figure, looking mostly backwards within the sentence.
 * "88% of GDP" is a ratio, not growth, so it is labelled separately.
 */
function metricFor(
  sentence: string,
  offsetInSentence: number,
  matchLength = 0,
): string | undefined {
  if (/^\s*of\s+(gdp|output)\b/i.test(sentence.slice(offsetInSentence + matchLength)))
    return 'share of gdp';
  let best: { metric: string; distance: number } | undefined;
  for (const [metric, cues] of Object.entries(METRIC_CUES)) {
    for (const m of findPhrases(sentence, cues)) {
      const before = offsetInSentence - (m.index + m.length);
      const after = m.index - offsetInSentence;
      // Cues usually precede the number ("inflation rose to 3.2%"); allow a short look-ahead too.
      const distance = before >= 0 ? before : after >= 0 && after < 40 ? after + 20 : Infinity;
      if (distance < 90 && (!best || distance < best.distance)) best = { metric, distance };
    }
  }
  return best?.metric;
}

function figureEntities(sentence: Sentence): Entity[] {
  const out: Entity[] = [];
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  const add = (
    m: RegExpMatchArray,
    e: Omit<Entity, 'kind' | 'text' | 'sentenceIndex' | 'start' | 'length'>,
  ) => {
    const s = m.index ?? 0;
    if (overlaps(s, s + m[0].length)) return;
    taken.push([s, s + m[0].length]);
    out.push({
      kind: 'figure',
      text: m[0],
      sentenceIndex: sentence.index,
      start: sentence.start + s,
      length: m[0].length,
      ...e,
    });
  };

  for (const m of sentence.text.matchAll(RANGE_PCT)) {
    const metric = metricFor(sentence.text, m.index ?? 0, m[0].length);
    add(m, {
      normalized: `${m[1]}–${m[2]}%`,
      value: Number(m[2]),
      unit: '%',
      ...(metric ? { metric } : {}),
    });
  }
  for (const m of sentence.text.matchAll(PCT)) {
    const value = Number(m[1]!.replace('−', '-'));
    const metric = metricFor(sentence.text, m.index ?? 0, m[0].length);
    add(m, { normalized: `${value}%`, value, unit: '%', ...(metric ? { metric } : {}) });
  }
  for (const m of sentence.text.matchAll(BASIS_POINTS)) {
    add(m, { normalized: `${m[1]}bp`, value: Number(m[1]), unit: 'bp', metric: 'policy rate' });
  }
  for (const m of sentence.text.matchAll(NAMED_BP_RE)) {
    const bp = NAMED_BP[m[1]!.toLowerCase().replace(' ', '-')] ?? NAMED_BP[m[1]!.toLowerCase()];
    if (bp) add(m, { normalized: `${bp}bp`, value: bp, unit: 'bp', metric: 'policy rate' });
  }
  for (const m of sentence.text.matchAll(CURRENCY)) {
    const scale = (m[3] ?? '').toLowerCase();
    add(m, {
      normalized: `${m[1]}${m[2]}${scale ? ' ' + scale : ''}`,
      value: Number(m[2]!.replace(/,/g, '')),
      unit: 'currency',
    });
  }
  return out;
}

function institutionEntities(sentence: Sentence): Entity[] {
  const out: Entity[] = [];
  for (const inst of INSTITUTIONS) {
    const matches = [
      ...findPhrases(sentence.text, inst.aliases),
      ...findPhrases(sentence.text, inst.acronyms, true),
    ];
    for (const m of matches) {
      out.push({
        kind: 'institution',
        text: sentence.text.slice(m.index, m.index + m.length),
        normalized: inst.name,
        sentenceIndex: sentence.index,
        start: sentence.start + m.index,
        length: m.length,
        ...(inst.country ? { country: inst.country } : {}),
      });
    }
  }
  return out;
}

function countryEntities(sentence: Sentence): Entity[] {
  const out: Entity[] = [];
  for (const c of COUNTRIES) {
    const matches = [
      ...findPhrases(sentence.text, c.aliases),
      ...findPhrases(sentence.text, c.acronyms, true),
    ];
    for (const m of matches) {
      out.push({
        kind: 'country',
        text: sentence.text.slice(m.index, m.index + m.length),
        normalized: c.code,
        sentenceIndex: sentence.index,
        start: sentence.start + m.index,
        length: m.length,
        country: c.code,
      });
    }
  }
  return out;
}

function actionEntities(sentence: Sentence): Entity[] {
  const out: Entity[] = [];
  for (const [action, phrases] of Object.entries(POLICY_ACTIONS)) {
    for (const m of findPhrases(sentence.text, phrases)) {
      out.push({
        kind: 'action',
        text: sentence.text.slice(m.index, m.index + m.length),
        normalized: action,
        sentenceIndex: sentence.index,
        start: sentence.start + m.index,
        length: m.length,
      });
    }
  }
  return out;
}

/** Remove entities fully contained in another of the same kind (e.g. "rate cut" inside "rate cuts"). */
function dedupe(entities: Entity[]): Entity[] {
  return entities.filter(
    (e, i) =>
      !entities.some(
        (o, j) =>
          j !== i &&
          o.kind === e.kind &&
          o.start <= e.start &&
          o.start + o.length >= e.start + e.length &&
          (o.length > e.length || j < i),
      ),
  );
}

export function extractEntities(sentences: readonly Sentence[]): Entity[] {
  const all = sentences.flatMap((s) => [
    ...figureEntities(s),
    ...institutionEntities(s),
    ...countryEntities(s),
    ...actionEntities(s),
  ]);
  return dedupe(all).sort((a, b) => a.start - b.start);
}

/**
 * Build grounded claims: one per sentence that contains a figure or a policy
 * action. Confidence is categorical and based on extraction quality:
 * HIGH = exact figure tied to a metric, MODERATE = implied direction,
 * LOW = hedged / analyst opinion.
 */
export function extractClaims(
  sentences: readonly Sentence[],
  entities: readonly Entity[],
): Claim[] {
  const claims: Claim[] = [];
  for (const s of sentences) {
    const own = entities.filter((e) => e.sentenceIndex === s.index);
    const hasMetricFigure = own.some((e) => e.kind === 'figure' && e.metric);
    const hasAction = own.some((e) => e.kind === 'action');
    if (!hasMetricFigure && !hasAction) continue;
    const hedged = findPhrases(s.text, HEDGES).length > 0;
    const [confidence, basis]: [Confidence, Claim['basis']] = hedged
      ? ['LOW', 'analyst opinion']
      : hasMetricFigure
        ? ['HIGH', 'exact figure']
        : ['MODERATE', 'implied direction'];
    claims.push({ sentenceIndex: s.index, text: s.text, confidence, basis });
  }
  return claims;
}

/** Score which economies a text is about. Headline hits and institutions count double. */
export function scoreCountries(
  entities: readonly Entity[],
  headlineSentenceCount: number,
  hint?: CountryCode,
): { code: CountryCode; score: number }[] {
  const scores = new Map<CountryCode, number>();
  for (const e of entities) {
    if (!e.country || (e.kind !== 'country' && e.kind !== 'institution')) continue;
    const weight =
      (e.kind === 'institution' ? 2 : 1) * (e.sentenceIndex < headlineSentenceCount ? 2 : 1);
    scores.set(e.country, (scores.get(e.country) ?? 0) + weight);
  }
  // The feed was a country-specific query: a modest prior, not an override.
  if (hint) scores.set(hint, (scores.get(hint) ?? 0) + 1.5);
  return [...scores].map(([code, score]) => ({ code, score })).sort((a, b) => b.score - a.score);
}
