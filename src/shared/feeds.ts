import { COUNTRIES } from './countries';
import type { CountryCode } from './types';

export interface FeedDefinition {
  id: string;
  label: string;
  url: string;
  kind: 'central-bank' | 'news';
  /** Publisher name used for credibility tiering when items lack one. */
  publisher: string;
  country?: CountryCode;
}

/** Official central-bank feeds. All verified keyless and publicly available. */
const CENTRAL_BANK_FEEDS: FeedDefinition[] = [
  {
    id: 'fed-monetary',
    label: 'Federal Reserve — Monetary policy',
    url: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
    kind: 'central-bank',
    publisher: 'Federal Reserve',
    country: 'US',
  },
  {
    id: 'ecb-press',
    label: 'ECB — Press',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    kind: 'central-bank',
    publisher: 'European Central Bank',
    country: 'EA',
  },
  {
    id: 'boe-news',
    label: 'Bank of England — News',
    url: 'https://www.bankofengland.co.uk/rss/news',
    kind: 'central-bank',
    publisher: 'Bank of England',
    country: 'GB',
  },
  {
    id: 'boj-whatsnew',
    label: "Bank of Japan — What's new",
    url: 'https://www.boj.or.jp/en/rss/whatsnew.xml',
    kind: 'central-bank',
    publisher: 'Bank of Japan',
    country: 'JP',
  },
  {
    id: 'boc-press',
    label: 'Bank of Canada — Press releases',
    url: 'https://www.bankofcanada.ca/content_type/press-releases/feed/',
    kind: 'central-bank',
    publisher: 'Bank of Canada',
    country: 'CA',
  },
  {
    id: 'rba-media',
    label: 'Reserve Bank of Australia — Media releases',
    url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml',
    kind: 'central-bank',
    publisher: 'Reserve Bank of Australia',
    country: 'AU',
  },
];

const MACRO_TERMS = '(inflation OR "interest rate" OR GDP OR "central bank" OR tariff OR currency)';

/** One Google News RSS search per economy (public RSS, no key). */
const NEWS_FEEDS: FeedDefinition[] = COUNTRIES.map((c) => ({
  id: `gnews-${c.code.toLowerCase()}`,
  label: `Google News — ${c.name}`,
  url:
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(`(${c.newsQuery}) ${MACRO_TERMS} when:7d`) +
    '&hl=en-US&gl=US&ceid=US:en',
  kind: 'news',
  publisher: 'Google News',
  country: c.code,
}));

export const FEEDS: readonly FeedDefinition[] = [...CENTRAL_BANK_FEEDS, ...NEWS_FEEDS];

/** Hosts the extension must be allowed to fetch from (mirrored in the manifest). */
export const FEED_HOSTS: readonly string[] = [...new Set(FEEDS.map((f) => new URL(f.url).host))];
