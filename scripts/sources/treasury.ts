import type { Point } from '../../src/shared/types';
import { fetchJson } from '../lib/http';

interface DebtRow {
  record_date: string;
  tot_pub_debt_out_amt: string;
}

/**
 * Total US public debt outstanding (USD trillions), month-end values.
 * US Treasury FiscalData "Debt to the Penny" — keyless.
 */
export async function fetchPublicDebt(fromDate: string): Promise<Point[]> {
  const url =
    'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny' +
    `?fields=record_date,tot_pub_debt_out_amt&filter=record_date:gte:${fromDate}` +
    '&sort=record_date&page%5Bsize%5D=10000';
  const body = await fetchJson<{ data: DebtRow[] }>(url);
  return monthEnd(body.data);
}

export function monthEnd(rows: readonly DebtRow[]): Point[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.tot_pub_debt_out_amt);
    if (Number.isFinite(value))
      byMonth.set(row.record_date.slice(0, 7), Math.round(value / 1e10) / 100);
  }
  return [...byMonth].sort((a, b) => a[0].localeCompare(b[0]));
}
