import type { Point } from '../../src/shared/types';
import { fetchJson } from '../lib/http';

interface BeaResponse {
  BEAAPI: {
    Results?: { Data?: { LineNumber: string; TimePeriod: string; DataValue: string }[] };
    Error?: { APIErrorDescription?: string };
  };
}

/**
 * US real GDP growth, quarterly, seasonally adjusted annual rate (NIPA table
 * T10101 line 1). Requires the free BEA_API_KEY secret; skipped otherwise.
 */
export async function fetchUsRealGdpGrowth(apiKey: string, years = 8): Promise<Point[]> {
  const end = new Date().getUTCFullYear();
  const yearList = Array.from({ length: years }, (_, i) => end - years + 1 + i).join(',');
  const url =
    `https://apps.bea.gov/api/data?UserID=${apiKey}&method=GetData&DataSetName=NIPA` +
    `&TableName=T10101&Frequency=Q&Year=${yearList}&ResultFormat=JSON`;
  const body = await fetchJson<BeaResponse>(url);
  if (body.BEAAPI.Error)
    throw new Error(`BEA: ${body.BEAAPI.Error.APIErrorDescription ?? 'error'}`);
  return parseBeaGdp(body);
}

export function parseBeaGdp(body: BeaResponse): Point[] {
  return (body.BEAAPI.Results?.Data ?? [])
    .filter((d) => d.LineNumber === '1')
    .map((d): Point => [
      d.TimePeriod.replace(/^(\d{4})Q(\d)$/, '$1-Q$2'),
      Number(d.DataValue.replace(/,/g, '')),
    ])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => a[0].localeCompare(b[0]));
}
