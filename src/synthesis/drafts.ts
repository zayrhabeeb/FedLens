/**
 * Template-based synthesis: turns structured outputs into readable prose.
 * These drafts are the product's default text and need no model at all.
 */
import { getCountry } from '../shared/countries';
import type { CountryCode } from '../shared/types';
import type { DocumentAnalysis } from '../nlp/document';
import type { EventCandidate } from '../nlp/events';
import { EVENT_LABELS } from '../nlp/events';
import type { ImplicationSet } from '../nlp/implications';
import type { TextAnalysis } from '../nlp/types';
import { TOPIC_LABELS } from '../nlp/classify';
import type { ForecastResult } from '../forecast/model';
import type { SynthesisRequest } from './types';

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function articleRequest(
  analysis: TextAnalysis,
  events: readonly EventCandidate[],
  implications?: ImplicationSet,
): SynthesisRequest {
  const country = analysis.primaryCountry
    ? getCountry(analysis.primaryCountry).name
    : 'an unidentified economy';
  const topic = analysis.topics.primary
    ? TOPIC_LABELS[analysis.topics.primary].toLowerCase()
    : 'general macro news';
  const figures = analysis.entities.filter((e) => e.kind === 'figure' && e.metric).slice(0, 4);
  const high = analysis.claims.filter((c) => c.confidence === 'HIGH').length;

  const facts = [
    `Primary economy: ${country}`,
    `Topic: ${topic}`,
    `Tone: ${analysis.sentiment.label}`,
    ...figures.map((f) => `${f.metric}: ${f.normalized}`),
    ...events.map(
      (e) =>
        `Event: ${EVENT_LABELS[e.type]}${e.direction ? ` (${e.direction})` : ''}, ${e.confidence} confidence`,
    ),
  ];

  const parts = [
    `This article concerns ${country} and is primarily about ${topic}; its overall tone reads ${analysis.sentiment.label}.`,
    figures.length
      ? `Key figures: ${figures.map((f) => `${f.metric} ${f.normalized}`).join(', ')}.`
      : 'It contains no metric-linked figures, so its claims are directional rather than quantitative.',
    events.length
      ? `Detected event: ${events.map((e) => EVENT_LABELS[e.type].toLowerCase() + (e.direction ? ` (${e.direction})` : '')).join(' and ')}.`
      : '',
    `${analysis.claims.length} grounded claim(s) were extracted, ${high} backed by exact figures.`,
    implications
      ? `If accurate, the likely policy implication is: ${implications.policyImplication}`
      : '',
  ];
  return { kind: 'article', facts, draft: parts.filter(Boolean).join(' ') };
}

export function forecastRequest(code: CountryCode, result: ForecastResult): SynthesisRequest {
  const c = getCountry(code);
  const drivers = [...result.inputs]
    .filter((i) => i.available && i.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3);
  const missing = result.inputs.filter((i) => !i.available).map((i) => i.label);
  const facts = [
    `Economy: ${c.name}`,
    `Raw score: ${result.raw}`,
    `P(tighten): ${pct(result.pTighten)}`,
    `P(ease): ${pct(result.pEase)}`,
    `Direction: ${result.direction}`,
    `Confidence: ${result.confidence}`,
    ...drivers.map((d) => `${d.label}: ${d.points > 0 ? '+' : ''}${d.points} (${d.detail})`),
  ];
  const draft = [
    `For ${c.name}, the model scores ${result.raw > 0 ? '+' : ''}${result.raw} on a −100 to +100 scale, which maps to a ${pct(result.pTighten)} probability of tightening and ${pct(result.pEase)} of easing by ${c.centralBankShort} over roughly the next three months (${result.direction.toLowerCase()}, ${result.confidence.toLowerCase()} confidence).`,
    drivers.length
      ? `The main drivers are ${drivers.map((d) => `${d.label} (${d.points > 0 ? '+' : ''}${d.points}: ${d.detail})`).join('; ')}.`
      : '',
    missing.length ? `Not available and excluded from the weighting: ${missing.join(', ')}.` : '',
  ];
  return { kind: 'forecast', facts, draft: draft.filter(Boolean).join(' ') };
}

export function documentRequest(doc: DocumentAnalysis): SynthesisRequest {
  const c = getCountry(doc.country);
  const facts = [
    `Bank: ${c.centralBank}`,
    `Stance: ${doc.stance.label} (score ${doc.stance.score})`,
    `Forward guidance: ${doc.guidance.type}, ${doc.guidance.bias} bias`,
    ...(doc.rateDecision
      ? [`Rate decision: ${doc.rateDecision.direction} ${doc.rateDecision.figures.join(', ')}`]
      : []),
    `Dissent mentions: ${doc.dissent.count}`,
    ...(doc.delta ? [`Stance shift vs prior: ${doc.delta.stanceShift}`] : []),
  ];
  const draft = [
    `"${doc.title}" from the ${c.centralBank} reads ${doc.stance.label} overall (score ${doc.stance.score} on a −1 to +1 scale).`,
    doc.rateDecision
      ? `It reports a rate ${doc.rateDecision.direction}${doc.rateDecision.figures[0] ? ` with the policy rate at ${doc.rateDecision.figures[0]}` : ''}.`
      : '',
    doc.guidance.type === 'none'
      ? 'No explicit forward guidance was found.'
      : `Forward guidance is ${doc.guidance.type} with a ${doc.guidance.bias} bias.`,
    doc.dissent.count ? `There are ${doc.dissent.count} mention(s) of dissent.` : '',
    doc.delta
      ? `Compared with the previous document, the language moved ${doc.delta.stanceShift > 0 ? 'more hawkish' : doc.delta.stanceShift < 0 ? 'more dovish' : 'sideways'} (${doc.delta.stanceShift > 0 ? '+' : ''}${doc.delta.stanceShift}).`
      : '',
  ];
  return { kind: 'document', facts, draft: draft.filter(Boolean).join(' ') };
}
