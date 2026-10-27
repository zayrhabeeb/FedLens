import type { Point } from '../../src/shared/types';
import { fetchJson } from '../lib/http';

interface BlsResponse {
  status: string;
  message?: string[];
  Results?: {
    series: { seriesID: string; data: { year: string; period: string; value: string }[] }[];
  };
}

/**
 * Fetch monthly BLS series. API v1 is keyless (~3 years of history, 25 req/day);
 * with the BLS_API_KEY secret we use v2 and request 20 years.
 */
export async function fetchBls(
  seriesIds: readonly string[],
  apiKey?: string,
): Promise<Map<string, Point[]>> {
  const endYear = new Date().getUTCFullYear();
  const version = apiKey ? 'v2' : 'v1';
  const payload = apiKey
    ? {
        seriesid: seriesIds,
        startyear: String(endYear - 19),
        endyear: String(endYear),
        registrationkey: apiKey,
      }
    : { seriesid: seriesIds };
  const body = await fetchJson<BlsResponse>(
    `https://api.bls.gov/publicAPI/${version}/timeseries/data/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
  );
  if (body.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS ${version}: ${body.status} ${body.message?.join('; ') ?? ''}`);
  }
  return parseBls(body);
}

export function parseBls(body: BlsResponse): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  for (const s of body.Results?.series ?? []) {
    const points = s.data
      .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-')
      .map((d): Point => [`${d.year}-${d.period.slice(1)}`, Number(d.value)])
      .sort((a, b) => a[0].localeCompare(b[0]));
    out.set(s.seriesID, points);
  }
  return out;
}
