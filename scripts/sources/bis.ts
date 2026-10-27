import { parseCsvRecords } from '../../src/shared/csv';
import type { Point } from '../../src/shared/types';
import { fetchText } from '../lib/http';

const BASE = 'https://stats.bis.org/api/v2/data/dataflow/BIS';

/**
 * Fetch a monthly BIS SDMX series for several reference areas in one request.
 * Keyless. Docs: https://stats.bis.org/api-doc/v2/
 *
 * @param dataflow e.g. "WS_CBPOL" (policy rates) or "WS_LONG_CPI" (consumer prices)
 * @param keySuffix extra key dimensions after the area, e.g. ".771" (YoY %)
 */
export async function fetchBisMonthly(
  dataflow: string,
  areas: readonly string[],
  startPeriod: string,
  keySuffix = '',
): Promise<Map<string, Point[]>> {
  const key = `M.${areas.join('+')}${keySuffix}`;
  const url = `${BASE}/${dataflow}/1.0/${key}?format=csv&startPeriod=${startPeriod}`;
  return parseBisCsv(await fetchText(url));
}

export function parseBisCsv(csv: string): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  for (const row of parseCsvRecords(csv)) {
    const area = row.REF_AREA;
    const value = Number(row.OBS_VALUE);
    if (!area || !row.TIME_PERIOD || row.OBS_VALUE === '' || !Number.isFinite(value)) continue;
    const list = out.get(area) ?? [];
    list.push([row.TIME_PERIOD, value]);
    out.set(area, list);
  }
  for (const list of out.values()) list.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}
