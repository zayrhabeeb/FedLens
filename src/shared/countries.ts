import type { CountryCode, Region } from './types';

export interface Country {
  code: CountryCode;
  name: string;
  region: Region;
  centralBank: string;
  centralBankShort: string;
  /** Point inflation target (midpoint where the mandate is a band). */
  inflationTarget: number;
  currency: string;
  /** World Bank API economy code. */
  worldBank: string;
  /** BIS reference area code. */
  bis: string;
  /** Google News RSS query fragment. */
  newsQuery: string;
  /** Lower-case phrases that indicate the article is about this economy. */
  aliases: string[];
  /** Case-sensitive tokens (acronyms) that would be ambiguous if lower-cased. */
  acronyms: string[];
}

export const COUNTRIES: readonly Country[] = [
  {
    code: 'US',
    name: 'United States',
    region: 'Americas',
    centralBank: 'Federal Reserve',
    centralBankShort: 'Fed',
    inflationTarget: 2,
    currency: 'USD',
    worldBank: 'USA',
    bis: 'US',
    newsQuery: '"Federal Reserve" OR "U.S. economy" OR "U.S. inflation"',
    aliases: [
      'united states',
      'american economy',
      'federal reserve',
      'fomc',
      'powell',
      'wall street',
    ],
    acronyms: ['U.S.', 'US', 'USA', 'Fed'],
  },
  {
    code: 'EA',
    name: 'Euro Area',
    region: 'Europe',
    centralBank: 'European Central Bank',
    centralBankShort: 'ECB',
    inflationTarget: 2,
    currency: 'EUR',
    worldBank: 'EMU',
    bis: 'XM',
    newsQuery: '"European Central Bank" OR eurozone OR "euro zone"',
    aliases: [
      'euro area',
      'eurozone',
      'euro zone',
      'european central bank',
      'lagarde',
      'germany',
      'france',
      'italy',
      'spain',
    ],
    acronyms: ['ECB', 'EU'],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    region: 'Europe',
    centralBank: 'Bank of England',
    centralBankShort: 'BoE',
    inflationTarget: 2,
    currency: 'GBP',
    worldBank: 'GBR',
    bis: 'GB',
    newsQuery: '"Bank of England" OR "UK economy" OR "UK inflation"',
    aliases: [
      'united kingdom',
      'britain',
      'british',
      'bank of england',
      'sterling',
      'bailey',
      'england',
    ],
    acronyms: ['UK', 'U.K.', 'BoE', 'BOE'],
  },
  {
    code: 'JP',
    name: 'Japan',
    region: 'Asia-Pacific',
    centralBank: 'Bank of Japan',
    centralBankShort: 'BoJ',
    inflationTarget: 2,
    currency: 'JPY',
    worldBank: 'JPN',
    bis: 'JP',
    newsQuery: '"Bank of Japan" OR "Japan economy" OR "Japan inflation"',
    aliases: ['japan', 'japanese', 'bank of japan', 'tokyo', 'ueda', 'yen'],
    acronyms: ['BoJ', 'BOJ'],
  },
  {
    code: 'CN',
    name: 'China',
    region: 'Asia-Pacific',
    centralBank: "People's Bank of China",
    centralBankShort: 'PBoC',
    inflationTarget: 2,
    currency: 'CNY',
    worldBank: 'CHN',
    bis: 'CN',
    newsQuery: '"People\'s Bank of China" OR "China economy" OR "China inflation"',
    aliases: ['china', 'chinese', "people's bank of china", 'beijing', 'yuan', 'renminbi'],
    acronyms: ['PBOC', 'PBoC'],
  },
  {
    code: 'IN',
    name: 'India',
    region: 'Asia-Pacific',
    centralBank: 'Reserve Bank of India',
    centralBankShort: 'RBI',
    inflationTarget: 4,
    currency: 'INR',
    worldBank: 'IND',
    bis: 'IN',
    newsQuery: '"Reserve Bank of India" OR "India economy" OR "India inflation"',
    aliases: ['india', 'indian', 'reserve bank of india', 'rupee', 'new delhi', 'mumbai'],
    acronyms: ['RBI'],
  },
  {
    code: 'BR',
    name: 'Brazil',
    region: 'Americas',
    centralBank: 'Banco Central do Brasil',
    centralBankShort: 'BCB',
    inflationTarget: 3,
    currency: 'BRL',
    worldBank: 'BRA',
    bis: 'BR',
    newsQuery: '"Brazil central bank" OR "Brazil economy" OR "Brazil inflation"',
    aliases: ['brazil', 'brazilian', 'banco central do brasil', 'copom', 'selic', 'brasilia'],
    acronyms: ['BCB'],
  },
  {
    code: 'CA',
    name: 'Canada',
    region: 'Americas',
    centralBank: 'Bank of Canada',
    centralBankShort: 'BoC',
    inflationTarget: 2,
    currency: 'CAD',
    worldBank: 'CAN',
    bis: 'CA',
    newsQuery: '"Bank of Canada" OR "Canada economy" OR "Canada inflation"',
    aliases: ['canada', 'canadian', 'bank of canada', 'ottawa', 'macklem', 'loonie'],
    acronyms: ['BoC', 'BOC'],
  },
  {
    code: 'AU',
    name: 'Australia',
    region: 'Asia-Pacific',
    centralBank: 'Reserve Bank of Australia',
    centralBankShort: 'RBA',
    inflationTarget: 2.5,
    currency: 'AUD',
    worldBank: 'AUS',
    bis: 'AU',
    newsQuery: '"Reserve Bank of Australia" OR "Australia economy" OR "Australia inflation"',
    aliases: [
      'australia',
      'australian',
      'reserve bank of australia',
      'canberra',
      'bullock',
      'aussie',
    ],
    acronyms: ['RBA'],
  },
  {
    code: 'KR',
    name: 'South Korea',
    region: 'Asia-Pacific',
    centralBank: 'Bank of Korea',
    centralBankShort: 'BoK',
    inflationTarget: 2,
    currency: 'KRW',
    worldBank: 'KOR',
    bis: 'KR',
    newsQuery: '"Bank of Korea" OR "South Korea economy" OR "Korea inflation"',
    aliases: ['south korea', 'korea', 'korean', 'bank of korea', 'seoul'],
    acronyms: ['BoK', 'BOK'],
  },
  {
    code: 'MX',
    name: 'Mexico',
    region: 'Americas',
    centralBank: 'Banco de México',
    centralBankShort: 'Banxico',
    inflationTarget: 3,
    currency: 'MXN',
    worldBank: 'MEX',
    bis: 'MX',
    newsQuery: 'Banxico OR "Mexico economy" OR "Mexico inflation"',
    aliases: ['mexico', 'mexican', 'banxico', 'bank of mexico', 'banco de mexico', 'peso'],
    acronyms: [],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    region: 'Africa',
    centralBank: 'South African Reserve Bank',
    centralBankShort: 'SARB',
    inflationTarget: 3,
    currency: 'ZAR',
    worldBank: 'ZAF',
    bis: 'ZA',
    newsQuery: '"South African Reserve Bank" OR "South Africa economy" OR "South Africa inflation"',
    aliases: [
      'south africa',
      'south african',
      'reserve bank of south africa',
      'pretoria',
      'kganyago',
      'rand',
    ],
    acronyms: ['SARB'],
  },
];

export const COUNTRY_CODES: readonly CountryCode[] = COUNTRIES.map((c) => c.code);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: CountryCode): Country {
  const country = BY_CODE.get(code);
  if (!country) throw new Error(`Unknown country code: ${code}`);
  return country;
}
