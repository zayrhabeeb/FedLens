import { describe, expect, it } from 'vitest';
import { articleId, mergeArticles, toRawArticle, withinDays } from './articles';
import { parseCsv, parseCsvRecords } from './csv';
import { FEEDS } from './feeds';
import { decodeEntities, parseFeed, stripHtml } from './rss';
import { yoyPercent } from './series';

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes, CRLF and BOM', () => {
    const csv = '﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,"multi\nline"\n';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'say "hi"'],
      ['2', '', 'multi\nline'],
    ]);
  });

  it('maps rows to records by header (BIS-style export)', () => {
    const csv = 'FREQ,REF_AREA,TITLE,TIME_PERIOD,OBS_VALUE\nM,MX,"Policy rate, Mexico",2025-06,8\n';
    expect(parseCsvRecords(csv)).toEqual([
      {
        FREQ: 'M',
        REF_AREA: 'MX',
        TITLE: 'Policy rate, Mexico',
        TIME_PERIOD: '2025-06',
        OBS_VALUE: '8',
      },
    ]);
  });
});

describe('parseFeed', () => {
  it('parses RSS 2.0 with CDATA and entities', () => {
    const xml = `<rss><channel><item><title><![CDATA[Fed holds rates &amp; signals patience]]></title>
      <link>https://example.com/a</link><pubDate>Thu, 22 Oct 2026 21:00:00 +0100</pubDate>
      <description>&lt;p&gt;Rates were &lt;b&gt;unchanged&lt;/b&gt;.&lt;/p&gt;</description>
      <source url="https://reuters.com">Reuters</source></item></channel></rss>`;
    const [item] = parseFeed(xml);
    expect(item).toEqual({
      title: 'Fed holds rates & signals patience',
      link: 'https://example.com/a',
      publishedAt: '2026-10-22T20:00:00.000Z',
      description: 'Rates were unchanged .',
      source: 'Reuters',
    });
  });

  it('parses RSS 1.0 (RDF) items with dc:date', () => {
    const xml = `<rdf:RDF><item rdf:about="x"><title>RBA statement</title><link>https://www.rba.gov.au/mr</link>
      <dc:date>2026-10-14T14:00:00+11:00</dc:date></item></rdf:RDF>`;
    expect(parseFeed(xml)[0]?.publishedAt).toBe('2026-10-14T03:00:00.000Z');
  });

  it('parses Atom entries and skips items without a valid link', () => {
    const xml = `<feed><entry><title>Atom post</title><link rel="alternate" href="https://ex.com/p"/><updated>2026-01-01T00:00:00Z</updated></entry>
      <entry><title>No link</title><link>javascript:alert(1)</link></entry></feed>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toBe('https://ex.com/p');
  });

  it('decodes numeric entities and strips markup', () => {
    expect(decodeEntities('&#8364;5 &#x2014; ok')).toBe('€5 — ok');
    expect(stripHtml('<script>x</script> a <i>b</i>')).toBe('x a b');
  });
});

describe('articles', () => {
  const gnews = FEEDS.find((f) => f.id === 'gnews-us')!;

  it('splits the Google News publisher suffix and drops the redundant description', () => {
    const raw = toRawArticle(
      {
        title: 'Fed holds rates - Reuters',
        link: 'https://n.g/x',
        publishedAt: '2026-10-01T00:00:00.000Z',
        description: 'Fed holds rates Reuters',
        source: 'Reuters',
      },
      gnews,
    );
    expect(raw.title).toBe('Fed holds rates');
    expect(raw.source).toBe('Reuters');
    expect(raw.summary).toBe('');
    expect(raw.countryHint).toBe('US');
  });

  it('produces stable dedup ids regardless of punctuation and time of day', () => {
    expect(articleId('Fed Holds!', 'Reuters', '2026-10-01T01:00:00Z')).toBe(
      articleId('fed holds', 'reuters', '2026-10-01T23:00:00Z'),
    );
  });

  it('merges newest-first without duplicates and enforces retention', () => {
    const a = {
      id: '1',
      title: 'a',
      link: 'https://x',
      source: 's',
      publishedAt: '2026-10-02T00:00:00Z',
      summary: '',
      feedId: 'f',
    };
    const b = { ...a, id: '2', publishedAt: '2026-10-03T00:00:00Z' };
    const old = { ...a, id: '3', publishedAt: '2026-08-01T00:00:00Z' };
    const merged = mergeArticles([a], [b, a], [old]);
    expect(merged.map((x) => x.id)).toEqual(['2', '1', '3']);
    expect(withinDays(merged, 30, Date.parse('2026-10-04T00:00:00Z')).map((x) => x.id)).toEqual([
      '2',
      '1',
    ]);
  });
});

describe('yoyPercent', () => {
  it('computes year-over-year change for monthly index levels', () => {
    expect(
      yoyPercent([
        ['2025-01', 100],
        ['2025-02', 101],
        ['2026-01', 103],
      ]),
    ).toEqual([['2026-01', 3]]);
  });
});
