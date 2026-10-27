/**
 * Hallucination shield. Generated text is accepted only if it introduces no
 * numbers, economies or advice that the deterministic layer did not supply.
 * When it fails, callers fall back to the template draft.
 */
import { COUNTRIES } from '../shared/countries';
import type { SynthesisRequest } from './types';

export interface ShieldReport {
  passed: boolean;
  unsupportedNumbers: string[];
  unsupportedCountries: string[];
  adviceLanguage: string[];
  tooLong: boolean;
}

const NUMBER = /-?\d+(?:[.,]\d+)?/g;
const ADVICE =
  /\b(you should (?:buy|sell)|buy now|sell now|guaranteed?|risk-free|will definitely|certain to|investment advice|strong buy)\b/gi;

function numbers(text: string): Set<string> {
  return new Set((text.match(NUMBER) ?? []).map((n) => String(Number(n.replace(',', '.')))));
}

export function shield(output: string, request: SynthesisRequest): ShieldReport {
  const source = [request.draft, ...request.facts].join(' ');
  const known = numbers(source);
  const unsupportedNumbers = [...numbers(output)].filter((n) => !known.has(n));
  const lowerSource = source.toLowerCase();
  const lowerOut = output.toLowerCase();
  const unsupportedCountries = COUNTRIES.filter(
    (c) => lowerOut.includes(c.name.toLowerCase()) && !lowerSource.includes(c.name.toLowerCase()),
  ).map((c) => c.name);
  const adviceLanguage = [...new Set((output.match(ADVICE) ?? []).map((m) => m.toLowerCase()))];
  const tooLong = output.length > request.draft.length * 2 + 200;
  return {
    passed:
      unsupportedNumbers.length === 0 &&
      unsupportedCountries.length === 0 &&
      adviceLanguage.length === 0 &&
      !tooLong &&
      output.trim().length > 0,
    unsupportedNumbers,
    unsupportedCountries,
    adviceLanguage,
    tooLong,
  };
}

export function describeFailure(report: ShieldReport): string {
  const parts: string[] = [];
  if (report.unsupportedNumbers.length)
    parts.push(`unsupported numbers: ${report.unsupportedNumbers.join(', ')}`);
  if (report.unsupportedCountries.length)
    parts.push(`unsupported economies: ${report.unsupportedCountries.join(', ')}`);
  if (report.adviceLanguage.length)
    parts.push(`advice language: ${report.adviceLanguage.join(', ')}`);
  if (report.tooLong) parts.push('output too long');
  return parts.join('; ') || 'empty output';
}

/** Shared prompt for both optional providers. */
export function rewritePrompt(request: SynthesisRequest): string {
  return [
    'Rewrite the DRAFT below as one clear paragraph for a non-expert reader.',
    'Use only the FACTS and the DRAFT. Do not add numbers, countries, predictions or investment advice.',
    `FACTS:\n- ${request.facts.join('\n- ')}`,
    `DRAFT:\n${request.draft}`,
  ].join('\n\n');
}
