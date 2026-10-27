/** Text utilities: sentence splitting and word-bounded phrase matching. */

export interface Sentence {
  index: number;
  text: string;
  /** Character offset of the sentence within the full document. */
  start: number;
}

export interface PhraseMatch {
  phrase: string;
  /** Offset within the searched text. */
  index: number;
  length: number;
}

const ABBREVIATIONS =
  /\b(?:U\.S|U\.K|Mr|Mrs|Ms|Dr|Inc|Ltd|Corp|Co|St|vs|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|e\.g|i\.e)\.$/i;

/**
 * Split text into sentences. A boundary is terminal punctuation followed by
 * whitespace, or a newline. Punctuation not followed by whitespace (decimals
 * like "3.5%", "U.S.") never splits, and abbreviations / initials are skipped.
 */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const boundary = /[.!?]+["')\]]*(?=\s)|\n+/g;
  let start = 0;
  for (const m of text.matchAll(boundary)) {
    const end = m.index + m[0].length;
    if (m[0][0] !== '\n') {
      const candidate = text.slice(start, end);
      if (ABBREVIATIONS.test(candidate) || /(?:^|\s)[A-Z]\.$/.test(candidate)) continue;
    }
    pushSentence(sentences, text.slice(start, end), start);
    start = end;
  }
  pushSentence(sentences, text.slice(start), start);
  return sentences;
}

function pushSentence(out: Sentence[], raw: string, start: number) {
  const leading = raw.length - raw.trimStart().length;
  const text = raw.trim();
  if (text.length > 1) out.push({ index: out.length, text, start: start + leading });
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = {
  i: new WeakMap<readonly string[], RegExp>(),
  s: new WeakMap<readonly string[], RegExp>(),
};

/** One alternation regex per dictionary, longest phrases first so they win. */
function compile(phrases: readonly string[], caseSensitive: boolean): RegExp {
  const cache = caseSensitive ? compiled.s : compiled.i;
  let re = cache.get(phrases);
  if (!re) {
    const body = [...phrases]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|');
    // Lookarounds instead of \b so phrases ending in punctuation ("opec+") still match.
    re = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`,
      caseSensitive ? 'gu' : 'giu',
    );
    cache.set(phrases, re);
  }
  re.lastIndex = 0;
  return re;
}

/**
 * Find dictionary phrases in text. Case-insensitive by default; pass
 * `caseSensitive` for acronyms. Returned `phrase` is lower-cased either way.
 */
export function findPhrases(
  text: string,
  phrases: readonly string[],
  caseSensitive = false,
): PhraseMatch[] {
  if (phrases.length === 0) return [];
  const out: PhraseMatch[] = [];
  for (const m of text.matchAll(compile(phrases, caseSensitive))) {
    out.push({ phrase: m[0].toLowerCase(), index: m.index, length: m[0].length });
  }
  return out;
}

/** Count of distinct dictionary phrases present in the text. */
export function distinctHits(text: string, phrases: readonly string[]): string[] {
  return [...new Set(findPhrases(text, phrases).map((m) => m.phrase))];
}

/** True if a negator appears within `window` words before `index`. */
export function isNegated(
  text: string,
  index: number,
  negators: readonly string[],
  window = 3,
): boolean {
  const before = text.slice(Math.max(0, index - 60), index).toLowerCase();
  const words = before
    .split(/[^\p{L}']+/u)
    .filter(Boolean)
    .slice(-window);
  return words.some((w) => negators.includes(w));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
