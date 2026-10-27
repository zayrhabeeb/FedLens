import { parseCsvRecords } from '../../src/shared/csv';
import type { Point } from '../../src/shared/types';
import { fetchJson, fetchText } from '../lib/http';

/**
 * Fetch a FRED series as monthly points.
 *
 * Without a key we use the public `fredgraph.csv` download (no registration).
 * When the FRED_API_KEY repo secret is set we use the official API instead,
 * which has documented rate limits and is the more reliable path in CI.
 */
export async function fetchFredSeries(
  seriesId: string,
  startDate: string,
  apiKey?: string,
): Promise<Point[]> {
  if (apiKey) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&observation_start=${startDate}&frequency=m&file_type=json&api_key=${apiKey}`;
    const body = await fetchJson<{ observations: { date: string; value: string }[] }>(url);
    return body.observations
      .filter((o) => o.value !== '.')
      .map((o): Point => [o.date.slice(0, 7), Number(o.value)]);
  }
  const csv = await fetchText(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${startDate}`,
  );
  return parseFredGraphCsv(csv, seriesId);
}

export function parseFredGraphCsv(csv: string, seriesId: string): Point[] {
  return parseCsvRecords(csv)
    .map((row) => [row.observation_date ?? row.DATE ?? '', row[seriesId] ?? ''] as const)
    .filter(
      ([date, value]) => date && value !== '' && value !== '.' && Number.isFinite(Number(value)),
    )
    .map(([date, value]): Point => [date.slice(0, 7), Number(value)]);
}
