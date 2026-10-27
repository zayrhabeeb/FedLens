import type { Sentiment, Stance } from '../shared/types';
import { DOVISH, HAWKISH, NEGATIVE, NEGATORS, POSITIVE, SHOCK } from './lexicon';
import { findPhrases, isNegated, type Sentence } from './text';
import type { SentenceSignal, SentimentResult } from './types';

/**
 * Score one sentence. Negation ("did not raise rates", "no recession") flips
 * hawkish↔dovish and positive↔negative; shocks are never flipped.
 */
export function scoreSentence(sentence: Sentence): SentenceSignal {
  const signal: SentenceSignal = {
    index: sentence.index,
    hawkish: 0,
    dovish: 0,
    shock: 0,
    positive: 0,
    negative: 0,
  };
  const count = (
    phrases: readonly string[],
    key: keyof SentenceSignal,
    opposite?: keyof SentenceSignal,
  ) => {
    for (const m of findPhrases(sentence.text, phrases)) {
      const target = opposite && isNegated(sentence.text, m.index, NEGATORS) ? opposite : key;
      (signal[target] as number) += 1;
    }
  };
  count(HAWKISH, 'hawkish', 'dovish');
  count(DOVISH, 'dovish', 'hawkish');
  count(POSITIVE, 'positive', 'negative');
  count(NEGATIVE, 'negative', 'positive');
  count(SHOCK, 'shock');
  return signal;
}

/** (a - b) / (a + b + 1): bounded in (-1, 1) and damped for small counts. */
const balance = (a: number, b: number) => (a - b) / (a + b + 1);

export function stanceFromScore(score: number): Stance {
  return score > 0.15 ? 'hawkish' : score < -0.15 ? 'dovish' : 'neutral';
}

export function analyzeSentiment(sentences: readonly Sentence[]): SentimentResult {
  const perSentence = sentences.map(scoreSentence);
  const total = perSentence.reduce(
    (acc, s) => ({
      hawkish: acc.hawkish + s.hawkish,
      dovish: acc.dovish + s.dovish,
      shock: acc.shock + s.shock,
      positive: acc.positive + s.positive,
      negative: acc.negative + s.negative,
    }),
    { hawkish: 0, dovish: 0, shock: 0, positive: 0, negative: 0 },
  );
  const monetaryScore = balance(total.hawkish, total.dovish);
  const growthScore = balance(total.positive, total.negative);
  const stance = stanceFromScore(monetaryScore);

  // Priority: shocks dominate, then monetary tone, then growth tone.
  let label: Sentiment = 'neutral';
  if (total.shock >= 2 || (total.shock === 1 && total.shock >= total.hawkish + total.dovish))
    label = 'shock';
  else if (stance !== 'neutral') label = stance;
  else if (growthScore > 0.15) label = 'positive';
  else if (growthScore < -0.15) label = 'negative';

  return { label, stance, monetaryScore, growthScore, shockCount: total.shock, perSentence };
}
