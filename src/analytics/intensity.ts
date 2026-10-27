import type { CountryCode } from '../shared/types';
import type { ProcessedArticle } from '../nlp/analyze';

const DAY = 86_400_000;

export interface NewsIntensity {
  /** Article counts per day, oldest first, for the last `days` days. */
  daily: number[];
  last7: number;
  /** Average weekly count over the whole window. */
  weeklyAverage: number;
  /** PRD §4.4: last 7 days > 1.5× the 30-day weekly average. */
  spike: boolean;
}

export function newsIntensity(
  articles: readonly ProcessedArticle[],
  code: CountryCode,
  days = 30,
  now = Date.now(),
): NewsIntensity {
  const daily = new Array<number>(days).fill(0);
  const todayStart = Math.floor(now / DAY) * DAY;
  for (const a of articles) {
    if (a.country !== code) continue;
    const age = Math.floor((todayStart - Math.floor(Date.parse(a.publishedAt) / DAY) * DAY) / DAY);
    if (age >= 0 && age < days) daily[days - 1 - age]! += 1;
  }
  const total = daily.reduce((s, n) => s + n, 0);
  const last7 = daily.slice(-7).reduce((s, n) => s + n, 0);
  const weeklyAverage = (total / days) * 7;
  return { daily, last7, weeklyAverage, spike: total >= 5 && last7 > 1.5 * weeklyAverage };
}
