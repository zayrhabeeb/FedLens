import type { Point } from '../../src/shared/types';
import { fetchJson } from '../lib/http';

interface WorldBankRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

/**
 * Annual World Bank indicator for several economies. Keyless.
 * Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
 */
export async function fetchWorldBank(
  indicator: string,
  economies: readonly string[],
  fromYear: number,
): Promise<Map<string, Point[]>> {
  const url =
    `https://api.worldbank.org/v2/country/${economies.join(';')}/indicator/${indicator}` +
    `?format=json&per_page=2000&date=${fromYear}:${new Date().getUTCFullYear()}`;
  const body = await fetchJson<[unknown, WorldBankRow[] | null]>(url);
  return parseWorldBank(body);
}

export function parseWorldBank(body: [unknown, WorldBankRow[] | null]): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  for (const row of body[1] ?? []) {
    if (row.value === null) continue;
    const list = out.get(row.countryiso3code) ?? [];
    list.push([row.date, Math.round(row.value * 100) / 100]);
    out.set(row.countryiso3code, list);
  }
  for (const list of out.values()) list.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}
