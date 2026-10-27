import { describe, expect, it } from 'vitest';
import { analyzeText, processArticle } from './analyze';
import { classifyTopics } from './classify';
import { tierFor } from './credibility';
import { analyzeDocument, diffPhrases } from './document';
import { buildEvents, detectEvents, findHighActivityWindows, type MacroEvent } from './events';
import { mapImplications } from './implications';
import { splitSentences } from './text';

describe('splitSentences', () => {
  it('does not break on decimals or U.S. abbreviations', () => {
    const s = splitSentences('U.S. inflation rose to 3.5% in May. The Fed held rates.');
    expect(s.map((x) => x.text)).toEqual([
      'U.S. inflation rose to 3.5% in May.',
      'The Fed held rates.',
    ]);
    expect(s[1]?.start).toBe(36);
  });
});

describe('entity extraction', () => {
  it('extracts figures with metrics, ranges, basis points and institutions', () => {
    const a = analyzeText(
      'The Federal Reserve held the target range at 5.25–5.50%. Inflation rose to 3.2% while the ECB cut by 25 basis points.',
    );
    const figures = a.entities.filter((e) => e.kind === 'figure');
    expect(figures.map((f) => [f.normalized, f.metric])).toEqual([
      ['5.25–5.50%', 'policy rate'],
      ['3.2%', 'inflation'],
      ['25bp', 'policy rate'],
    ]);
    expect(a.entities.filter((e) => e.kind === 'institution').map((e) => e.normalized)).toEqual([
      'Federal Reserve',
      'European Central Bank',
    ]);
  });

  it('treats "% of GDP" as a ratio, not GDP growth', () => {
    const a = analyzeText('Government debt climbed to 88.8% of GDP.');
    expect(a.entities.find((e) => e.kind === 'figure')?.metric).toBe('share of gdp');
  });

  it('matches acronyms case-sensitively', () => {
    expect(
      analyzeText('The Fed signalled patience.').entities.some(
        (e) => e.normalized === 'Federal Reserve',
      ),
    ).toBe(true);
    expect(
      analyzeText('Investors are fed up with volatility.').entities.some(
        (e) => e.normalized === 'Federal Reserve',
      ),
    ).toBe(false);
  });

  it('grades claim confidence: exact figure > implied direction > opinion', () => {
    const a = analyzeText(
      'Inflation rose to 4.1% in June. The central bank raised rates. Analysts expect inflation near 3% next year.',
    );
    expect(a.claims.map((c) => c.confidence)).toEqual(['HIGH', 'MODERATE', 'LOW']);
  });

  it('tags the primary country using institutions and the feed prior', () => {
    expect(analyzeText('Bank of Japan keeps policy steady').primaryCountry).toBe('JP');
    expect(analyzeText('Inflation cools again', { countryHint: 'IN' }).primaryCountry).toBe('IN');
  });
});

describe('topics and sentiment', () => {
  it('uses a lower keyword threshold for headlines than for articles', () => {
    expect(classifyTopics('Tariffs hit exports').topics).toContain('trade');
    const longText = `${'Markets were quiet today. '.repeat(15)} Tariffs were mentioned once.`;
    expect(classifyTopics(longText).topics).not.toContain('trade');
  });

  it('labels hawkish, dovish and shock language and handles negation', () => {
    expect(
      analyzeText('The central bank signalled further rate hikes to combat inflation.').sentiment
        .label,
    ).toBe('hawkish');
    expect(analyzeText('Officials favour a rate cut to support growth.').sentiment.label).toBe(
      'dovish',
    );
    expect(analyzeText('Currency crisis deepens as bank run spreads.').sentiment.label).toBe(
      'shock',
    );
    expect(analyzeText('The bank will not tighten policy this year.').sentiment.stance).toBe(
      'dovish',
    );
  });
});

describe('credibility tiers', () => {
  it('tiers known outlets and excludes unknown sources', () => {
    expect(tierFor('Reuters')).toBe('TIER_1');
    expect(tierFor('Bloomberg.com')).toBe('TIER_1');
    expect(tierFor('CNBC')).toBe('TIER_2');
    expect(tierFor('FXStreet')).toBe('TIER_3');
    expect(tierFor('Some Random Blog')).toBe('TIER_4');
  });
});

describe('event detection', () => {
  const detect = (t: string) => detectEvents(t, analyzeText(t));

  it('detects reported rate decisions with direction', () => {
    expect(detect('Bank of Korea holds rates steady at 2.5%')).toEqual([
      { type: 'RATE_DECISION', direction: 'hold', confidence: 'HIGH' },
    ]);
  });

  it('ignores speculation, questions and opinion pieces', () => {
    expect(detect('Most BOJ watchers expect next interest rate hike in December')).toEqual([]);
    expect(detect('Is another rate hike coming at the Bank of Canada?')).toEqual([]);
    expect(detect('Opinion: The Fed raised rates too late')).toEqual([]);
    expect(
      detect('Inflation data puts a Bank of Canada rate hike back on the table').some(
        (e) => e.type === 'RATE_DECISION',
      ),
    ).toBe(false);
  });

  it('merges corroborating articles and excludes Tier 4 sources', () => {
    const base = { link: 'https://x', summary: '', feedId: 'f', countryHint: 'KR' as const };
    const articles = [
      processArticle({
        ...base,
        id: 'a',
        title: 'Bank of Korea holds rates at 2.5%',
        source: 'Reuters',
        publishedAt: '2026-10-20T01:00:00Z',
      }),
      processArticle({
        ...base,
        id: 'b',
        title: 'Bank of Korea keeps rates unchanged',
        source: 'Yonhap',
        publishedAt: '2026-10-20T05:00:00Z',
      }),
      processArticle({
        ...base,
        id: 'c',
        title: 'BoK holds rates steady',
        source: 'Bloomberg',
        publishedAt: '2026-10-21T05:00:00Z',
      }),
      processArticle({
        ...base,
        id: 'd',
        title: 'Bank of Korea holds rates',
        source: 'Unknown Blog',
        publishedAt: '2026-10-21T06:00:00Z',
      }),
    ];
    const events = buildEvents(articles);
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceArticleIds).toEqual(['a', 'b', 'c']);
    expect(events[0]?.confidence).toBe('HIGH');
  });

  it('flags high-activity windows (3+ events in 7 days)', () => {
    const ev = (id: string, date: string): MacroEvent => ({
      id,
      country: 'GB',
      type: 'FISCAL_ACTION',
      date,
      headline: '',
      entities: [],
      sentiment: 'neutral',
      sourceArticleIds: [],
      confidence: 'LOW',
    });
    const windows = findHighActivityWindows([
      ev('1', '2026-10-01'),
      ev('2', '2026-10-03'),
      ev('3', '2026-10-06'),
      ev('4', '2026-10-20'),
    ]);
    expect(windows).toEqual([
      { country: 'GB', start: '2026-10-01', end: '2026-10-06', eventIds: ['1', '2', '3'] },
    ]);
  });
});

describe('implications', () => {
  it('maps event type and direction to a conditional scenario', () => {
    const imp = mapImplications({
      country: 'BR',
      type: 'RATE_DECISION',
      direction: 'hike',
      stance: 'hawkish',
    });
    expect(imp.policyImplication).toContain('Banco Central do Brasil');
    expect(imp.marketSignals).toContain('BRL');
  });
});

describe('document analysis', () => {
  const statement = (extra: string) =>
    `${'Recent indicators suggest that economic activity has continued to expand at a solid pace. Job gains have remained strong, and the unemployment rate has remained low. Inflation remains elevated. '.repeat(4)}${extra}`;

  it('extracts stance, decision, guidance and dissent, and creates events', () => {
    const doc = analyzeDocument(
      statement(
        'The Committee decided to raise the policy rate to 5.5%. The Committee anticipates that further increases in the target range will be appropriate, depending on incoming data and inflation risks. One member dissented.',
      ),
      'US',
      'FOMC statement',
      undefined,
      new Date('2026-10-01T00:00:00Z'),
    );
    expect(doc.rateDecision?.direction).toBe('hike');
    expect(doc.stance.label).toBe('hawkish');
    expect(doc.guidance.type).not.toBe('none');
    expect(doc.dissent.count).toBe(1);
    expect(doc.events[0]).toMatchObject({
      type: 'RATE_DECISION',
      direction: 'hike',
      linkedDocumentId: doc.id,
    });
  });

  it('rejects text too short to be a document', () => {
    expect(() => analyzeDocument('Too short.', 'US', 'x')).toThrow(/too short/);
  });

  it('diffs policy phrases against the prior document', () => {
    const d = diffPhrases(
      'inflation remains elevated and rates are restrictive',
      'inflation has eased and rates are restrictive',
    );
    expect(d.added).toContain('inflation remains elevated');
    expect(d.removed).toContain('inflation has eased');
  });
});
