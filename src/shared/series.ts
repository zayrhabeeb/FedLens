import type { Point, Series } from './types';

/** Convert a monthly period "YYYY-MM" to a month index for arithmetic. */
export function monthIndex(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return (y ?? 0) * 12 + ((m ?? 1) - 1);
}

export function periodFromMonthIndex(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function latest(series: Series | undefined): Point | undefined {
  return series?.points.at(-1);
}

/** The latest point and the one before it, for "delta vs prior period" tiles. */
export function latestPair(series: Series | undefined): { current?: Point; prior?: Point } {
  const pts = series?.points ?? [];
  return { current: pts.at(-1), prior: pts.at(-2) };
}

/** Value of a monthly series at (or most recently before) a given month index. */
export function valueAtOrBefore(points: readonly Point[], target: number): number | undefined {
  let found: number | undefined;
  for (const [period, value] of points) {
    if (monthIndex(period) > target) break;
    found = value;
  }
  return found;
}

/** Map period -> value, convenient for aligning two monthly series. */
export function toMonthMap(points: readonly Point[]): Map<number, number> {
  return new Map(points.map(([p, v]) => [monthIndex(p), v]));
}

/** Year-over-year % change for a monthly index series (e.g. CPI level -> inflation). */
export function yoyPercent(points: readonly Point[]): Point[] {
  const byMonth = toMonthMap(points);
  const out: Point[] = [];
  for (const [period, value] of points) {
    const prior = byMonth.get(monthIndex(period) - 12);
    if (prior !== undefined && prior !== 0) {
      out.push([period, Math.round((value / prior - 1) * 100 * 100) / 100]);
    }
  }
  return out;
}
