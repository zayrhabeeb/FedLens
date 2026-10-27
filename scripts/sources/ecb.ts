import { parseCsvRecords } from '../../src/shared/csv';
import type { Point } from '../../src/shared/types';
import { fetchText } from '../lib/http';

const BASE = 'https://data-api.ecb.europa.eu/service/data';

/** Generic ECB Data Portal series fetch (keyless). Returns points keyed by series key. */
async function fetchEcb(
  flowAndKey: string,
  startPeriod: string,
): Promise<Record<string, string>[]> {
  const csv = await fetchText(`${BASE}/${flowAndKey}?format=csvdata&startPeriod=${startPeriod}`);
  return parseCsvRecords(csv);
}

/**
 * Monthly average reference rates, re-based to "units of local currency per USD"
 * using the EUR cross. For the euro area itself we return USD per EUR (EUR/USD),
 * the conventional quote.
 */
export async function fetchFxPerUsd(
  currencies: readonly string[],
  startPeriod: string,
): Promise<Map<string, Point[]>> {
  const nonEur = [...new Set([...currencies.filter((c) => c !== 'EUR'), 'USD'])];
  const rows = await fetchEcb(`EXR/M.${nonEur.join('+')}.EUR.SP00.A`, startPeriod);
  return rebaseToUsd(rows);
}

export function rebaseToUsd(rows: Record<string, string>[]): Map<string, Point[]> {
  const perEur = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const value = Number(row.OBS_VALUE);
    if (!row.CURRENCY || !row.TIME_PERIOD || !Number.isFinite(value) || row.OBS_VALUE === '')
      continue;
    const series = perEur.get(row.CURRENCY) ?? new Map<string, number>();
    series.set(row.TIME_PERIOD, value);
    perEur.set(row.CURRENCY, series);
  }
  const usd = perEur.get('USD');
  const out = new Map<string, Point[]>();
  if (!usd) return out;

  out.set(
    'EUR',
    [...usd]
      .map(([period, v]): Point => [period, round4(v)])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
  for (const [currency, series] of perEur) {
    if (currency === 'USD') continue;
    const points: Point[] = [];
    for (const [period, v] of series) {
      const usdPerEur = usd.get(period);
      if (usdPerEur) points.push([period, round4(v / usdPerEur)]);
    }
    out.set(
      currency,
      points.sort((a, b) => a[0].localeCompare(b[0])),
    );
  }
  return out;
}

/** Euro-area HICP, annual rate of change (%), monthly. */
export async function fetchEuroAreaHicp(startPeriod: string): Promise<Point[]> {
  const rows = await fetchEcb('ICP/M.U2.N.000000.4.ANR', startPeriod);
  return rows
    .filter((r) => r.TIME_PERIOD && r.OBS_VALUE !== '' && Number.isFinite(Number(r.OBS_VALUE)))
    .map((r): Point => [r.TIME_PERIOD!, Number(r.OBS_VALUE)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;
