/**
 * Snapshot pipeline — runs on a schedule in GitHub Actions (see
 * .github/workflows/refresh-data.yml) and writes static JSON into /data.
 *
 * The extension reads these files from raw.githubusercontent.com, so end users
 * never need an API key and free-tier APIs are hit a few times a day in total
 * rather than once per user. Optional keys (FRED_API_KEY, BEA_API_KEY,
 * BLS_API_KEY) come from repo secrets and only upgrade data quality; every
 * series has a keyless path or is simply skipped.
 *
 * Usage: npm run data:refresh
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { mergeArticles, toRawArticle, withinDays } from '../src/shared/articles';
import { COUNTRIES } from '../src/shared/countries';
import { FEEDS } from '../src/shared/feeds';
import { parseFeed } from '../src/shared/rss';
import { yoyPercent } from '../src/shared/series';
import type {
  CountryCode,
  CountryIndicators,
  Frequency,
  IndicatorKey,
  IndicatorSnapshot,
  NewsSnapshot,
  Point,
  SourceId,
  SourceStatus,
} from '../src/shared/types';
import { fetchText } from './lib/http';
import { fetchUsRealGdpGrowth } from './sources/bea';
import { fetchBisMonthly } from './sources/bis';
import { fetchBls } from './sources/bls';
import { fetchEuroAreaHicp, fetchFxPerUsd } from './sources/ecb';
import { fetchFredSeries } from './sources/fred';
import { fetchPublicDebt } from './sources/treasury';
import { fetchWorldBank } from './sources/worldbank';

const DATA_DIR = new URL('../data/', import.meta.url);
const START_MONTH = '2000-01';
const NEWS_RETENTION_DAYS = 30;
const NEWS_CAP = 2000;

const SERIES_META: Record<IndicatorKey, { label: string; unit: string }> = {
  gdpGrowth: { label: 'Real GDP growth', unit: '%' },
  cpi: { label: 'CPI inflation (YoY)', unit: '%' },
  policyRate: { label: 'Policy rate', unit: '%' },
  unemployment: { label: 'Unemployment rate', unit: '%' },
  fx: { label: 'Exchange rate', unit: 'per USD' },
  tradeBalance: { label: 'Trade balance', unit: '% of GDP' },
  yield2y: { label: '2-year Treasury yield', unit: '%' },
  publicDebt: { label: 'Public debt outstanding', unit: 'USD tn' },
};

const env = {
  fred: process.env.FRED_API_KEY || undefined,
  bea: process.env.BEA_API_KEY || undefined,
  bls: process.env.BLS_API_KEY || undefined,
};

class SnapshotBuilder {
  readonly countries = new Map<CountryCode, CountryIndicators>();
  readonly sources: SourceStatus[] = [];

  constructor(private readonly previous?: IndicatorSnapshot) {
    for (const c of COUNTRIES) this.countries.set(c.code, { code: c.code, series: {} });
  }

  /**
   * Store a series. When two sources provide the same indicator, the one with
   * the most recent observation wins (ties go to the later, more specific call).
   */
  set(
    code: CountryCode,
    key: IndicatorKey,
    source: SourceId,
    frequency: Frequency,
    points: Point[],
    unit?: string,
  ) {
    const newest = points.at(-1)?.[0];
    if (!newest) return;
    const existing = this.countries.get(code)!.series[key]?.points.at(-1)?.[0];
    if (existing && existing > newest) return;
    const meta = SERIES_META[key];
    this.countries.get(code)!.series[key] = {
      key,
      label: meta.label,
      unit: unit ?? meta.unit,
      frequency,
      source,
      points,
    };
  }

  /** Run one source; on failure, carry its series over from the previous snapshot. */
  async run(id: SourceId, label: string, keys: IndicatorKey[], task: () => Promise<void>) {
    const fetchedAt = new Date().toISOString();
    try {
      await task();
      this.sources.push({ id, ok: true, fetchedAt, detail: label });
      console.log(`✓ ${label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.sources.push({ id, ok: false, fetchedAt, detail: `${label}: ${message}` });
      console.warn(`✗ ${label}: ${message} — keeping previous values`);
      for (const [code, entry] of this.countries) {
        for (const key of keys) {
          const old = this.previous?.countries[code]?.series[key];
          if (old && old.source === id && !entry.series[key]) entry.series[key] = old;
        }
      }
    }
  }

  build(): IndicatorSnapshot {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      countries: Object.fromEntries(this.countries),
      sources: this.sources,
    };
  }
}

async function readJson<T>(name: string): Promise<T | undefined> {
  const url = new URL(name, DATA_DIR);
  if (!existsSync(url)) return undefined;
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

async function buildIndicators(previous?: IndicatorSnapshot): Promise<IndicatorSnapshot> {
  const b = new SnapshotBuilder(previous);
  const bisAreas = COUNTRIES.map((c) => c.bis);
  const wbCodes = COUNTRIES.map((c) => c.worldBank);
  const fromYear = new Date().getUTCFullYear() - 15;

  await b.run('bis', 'BIS central bank policy rates', ['policyRate'], async () => {
    const data = await fetchBisMonthly('WS_CBPOL', bisAreas, START_MONTH);
    for (const c of COUNTRIES) b.set(c.code, 'policyRate', 'bis', 'M', data.get(c.bis) ?? []);
  });

  await b.run('bis', 'BIS consumer prices (YoY)', ['cpi'], async () => {
    const data = await fetchBisMonthly('WS_LONG_CPI', bisAreas, START_MONTH, '.771');
    for (const c of COUNTRIES) b.set(c.code, 'cpi', 'bis', 'M', data.get(c.bis) ?? []);
  });

  await b.run('ecb', 'ECB HICP (euro area)', ['cpi'], async () => {
    b.set('EA', 'cpi', 'ecb', 'M', await fetchEuroAreaHicp(START_MONTH));
  });

  await b.run('ecb', 'ECB reference exchange rates', ['fx'], async () => {
    const fx = await fetchFxPerUsd(
      COUNTRIES.map((c) => c.currency),
      START_MONTH,
    );
    for (const c of COUNTRIES) {
      if (c.code === 'US') continue;
      const unit = c.code === 'EA' ? 'USD per EUR' : `${c.currency} per USD`;
      b.set(c.code, 'fx', 'ecb', 'M', fx.get(c.currency) ?? [], unit);
    }
  });

  await b.run(
    'worldbank',
    'World Bank annual indicators',
    ['gdpGrowth', 'unemployment', 'tradeBalance'],
    async () => {
      const indicators: [string, IndicatorKey][] = [
        ['NY.GDP.MKTP.KD.ZG', 'gdpGrowth'],
        ['SL.UEM.TOTL.ZS', 'unemployment'],
        ['NE.RSB.GNFS.ZS', 'tradeBalance'],
      ];
      for (const [indicator, key] of indicators) {
        const data = await fetchWorldBank(indicator, wbCodes, fromYear);
        for (const c of COUNTRIES)
          b.set(c.code, key, 'worldbank', 'A', data.get(c.worldBank) ?? []);
      }
    },
  );

  await b.run(
    'fred',
    `FRED 2-year Treasury yield (${env.fred ? 'API' : 'fredgraph.csv'})`,
    ['yield2y'],
    async () => {
      b.set(
        'US',
        'yield2y',
        'fred',
        'M',
        await fetchFredSeries('GS2', `${START_MONTH}-01`, env.fred),
      );
    },
  );

  await b.run('fred', 'FRED US CPI (CPIAUCSL → YoY)', ['cpi'], async () => {
    // Fresher than BIS for the US: FRED publishes CPI on BLS release day.
    const level = await fetchFredSeries('CPIAUCSL', '1999-01-01', env.fred);
    b.set(
      'US',
      'cpi',
      'fred',
      'M',
      yoyPercent(level).filter(([p]) => p >= START_MONTH),
    );
  });

  await b.run('treasury', 'US Treasury debt to the penny', ['publicDebt'], async () => {
    b.set('US', 'publicDebt', 'treasury', 'M', await fetchPublicDebt('2015-01-01'));
  });

  await b.run(
    'bls',
    `BLS unemployment (API ${env.bls ? 'v2' : 'v1'})`,
    ['unemployment'],
    async () => {
      const data = await fetchBls(['LNS14000000'], env.bls);
      b.set('US', 'unemployment', 'bls', 'M', data.get('LNS14000000') ?? []);
    },
  );

  if (env.bea) {
    await b.run('bea', 'BEA real GDP growth (quarterly, SAAR)', ['gdpGrowth'], async () => {
      b.set('US', 'gdpGrowth', 'bea', 'Q', await fetchUsRealGdpGrowth(env.bea!), '% SAAR');
    });
  }

  return b.build();
}

async function buildNews(previous?: NewsSnapshot): Promise<NewsSnapshot> {
  const fresh = [];
  for (const feed of FEEDS) {
    try {
      const items = parseFeed(await fetchText(feed.url, { retries: 1 }));
      fresh.push(...items.slice(0, 40).map((item) => toRawArticle(item, feed)));
      console.log(`✓ feed ${feed.id} (${items.length})`);
    } catch (err) {
      console.warn(`✗ feed ${feed.id}: ${err instanceof Error ? err.message : err}`);
    }
    // Space requests out; Google News throttles bursts.
    await new Promise((r) => setTimeout(r, 750));
  }
  const merged = mergeArticles(fresh, previous?.articles ?? []);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    articles: withinDays(merged, NEWS_RETENTION_DAYS).slice(0, NEWS_CAP),
  };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const indicators = await buildIndicators(await readJson<IndicatorSnapshot>('indicators.json'));
  const news = await buildNews(await readJson<NewsSnapshot>('news.json'));
  await writeFile(new URL('indicators.json', DATA_DIR), JSON.stringify(indicators) + '\n');
  await writeFile(new URL('news.json', DATA_DIR), JSON.stringify(news) + '\n');
  const failed = indicators.sources.filter((s) => !s.ok).length;
  console.log(
    `Wrote ${news.articles.length} articles; ${indicators.sources.length - failed}/${indicators.sources.length} indicator sources OK.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
