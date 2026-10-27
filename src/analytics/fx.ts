import { toMonthMap } from '../shared/series';
import type { CountryCode, IndicatorSnapshot } from '../shared/types';

/**
 * Monthly "local currency per USD" for any economy. The euro area is stored as
 * USD per EUR (the market convention) so it is inverted here; the US is 1.
 * Returns undefined for months without data.
 */
export function localPerUsd(
  snapshot: IndicatorSnapshot,
  code: CountryCode,
): (month: number) => number | undefined {
  if (code === 'US') return () => 1;
  const map = toMonthMap(snapshot.countries[code]?.series.fx?.points ?? []);
  return (month) => {
    const v = map.get(month);
    if (v === undefined || v === 0) return undefined;
    return code === 'EA' ? 1 / v : v;
  };
}

/**
 * % appreciation of A's currency against B's between two months.
 * Positive = A strengthened relative to B.
 */
export function relativeAppreciation(
  snapshot: IndicatorSnapshot,
  a: CountryCode,
  b: CountryCode,
  from: number,
  to: number,
): number | undefined {
  const fa = localPerUsd(snapshot, a);
  const fb = localPerUsd(snapshot, b);
  const [a0, a1, b0, b1] = [fa(from), fa(to), fb(from), fb(to)];
  if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined)
    return undefined;
  // Price of one unit of A in units of B = (B per USD) / (A per USD).
  return (b1 / a1 / (b0 / a0) - 1) * 100;
}
