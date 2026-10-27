/**
 * Source credibility tiers (PRD §11). A hard-coded list is deliberate: it is
 * transparent and reviewable in a PR, which a learned reputation score is not.
 *
 * TIER_1 full weight · TIER_2 80% · TIER_3 50% (flagged) · TIER_4 excluded.
 */
import type { SourceTier } from '../shared/types';

const TIER_1 = [
  'reuters',
  'bloomberg',
  'financial times',
  'ft',
  'wall street journal',
  'wsj',
  'the economist',
  'associated press',
  'ap news',
  'federal reserve',
  'european central bank',
  'bank of england',
  'bank of japan',
  'bank of canada',
  'reserve bank of australia',
  'reserve bank of india',
  "people's bank of china",
  'bank of korea',
  'banco de mexico',
  'banxico',
  'south african reserve bank',
  'banco central do brasil',
  'imf',
  'international monetary fund',
  'world bank',
  'bis',
  'oecd',
  'nikkei asia',
];

const TIER_2 = [
  'cnbc',
  'marketwatch',
  "barron's",
  'bbc',
  'the guardian',
  'new york times',
  'the new york times',
  'washington post',
  'the washington post',
  'fortune',
  'axios',
  'politico',
  'npr',
  'cnn',
  'le monde',
  'handelsblatt',
  'der spiegel',
  'the globe and mail',
  'cbc',
  'financial post',
  'afr',
  'australian financial review',
  'abc news',
  'the sydney morning herald',
  'the economic times',
  'business standard',
  'mint',
  'livemint',
  'the hindu',
  'the hindu businessline',
  'hindustan times',
  'south china morning post',
  'caixin global',
  'xinhua',
  'the japan times',
  'kyodo news',
  'nhk',
  'the korea herald',
  'yonhap',
  'korea joongang daily',
  'the korea times',
  'chosun ilbo',
  'el financiero',
  'el economista',
  'mexico news daily',
  'folha',
  'valor',
  'news24',
  'business day',
  'daily maverick',
  'euronews',
  'dw',
  'france 24',
  'al jazeera',
  'morningstar',
  'ing think',
  'cme group',
  'the times',
  'the telegraph',
  'sky news',
  'the independent',
  'forbes',
  'business insider',
  'yahoo finance',
  'yahoo! finance canada',
  'firstpost',
  'moneycontrol',
];

const TIER_3 = [
  'investing.com',
  'fxstreet',
  'seeking alpha',
  'tradingview',
  'forex factory',
  'kitco',
  'zerohedge',
  'benzinga',
  'msn',
  'gurufocus',
  '24/7 wall st.',
  'the motley fool',
  'motley fool',
  'finimize',
  'pound sterling live',
  'kalkine',
  'investinglive',
  'traders union',
  'indexbox',
  'moomoo',
  'tradingkey',
  'ani news',
  'daily sabah',
  'chosunbiz',
  'mortgage professional america',
  'thenational.co.za',
  'tradingpedia',
  'fxempire',
  'action forex',
  'babypips',
];

function normalize(source: string): string {
  return source
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.(com|co\.uk|org|net)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TIERS = new Map<string, SourceTier>([
  ...TIER_3.map((s) => [s, 'TIER_3'] as const),
  ...TIER_2.map((s) => [s, 'TIER_2'] as const),
  ...TIER_1.map((s) => [s, 'TIER_1'] as const),
]);

export function tierFor(source: string): SourceTier {
  const key = normalize(source);
  const exact = TIERS.get(key);
  if (exact) return exact;
  // "Bloomberg.com", "Reuters UK", "bfsi.economictimes.indiatimes.com" etc.
  if (/reuters|bloomberg/.test(key)) return 'TIER_1';
  if (/economictimes|cnbc|bbc|nikkei/.test(key)) return 'TIER_2';
  return 'TIER_4';
}

export const TIER_WEIGHT: Record<SourceTier, number> = {
  TIER_1: 1,
  TIER_2: 0.8,
  TIER_3: 0.5,
  TIER_4: 0,
};
