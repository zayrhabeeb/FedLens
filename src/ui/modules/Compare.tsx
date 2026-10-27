/** Module 6 — Comparative Country View with Divergence Detector (PRD §9). */
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { detectDivergences } from '../../analytics/divergence';
import { EVENT_LABELS } from '../../nlp/events';
import { COUNTRIES, getCountry } from '../../shared/countries';
import type { CountryCode, EventType, IndicatorKey } from '../../shared/types';
import { BarList, LineChart } from '../components/charts';
import {
  Badge,
  Button,
  Card,
  ConfidenceBadge,
  Empty,
  SourceLine,
  StanceBadge,
} from '../components/primitives';
import { downloadText, formatValue, toCsv } from '../lib/format';
import { useAppData } from '../state/AppData';
import { useCountryViews } from '../state/derived';

const MAX = 4;
const PALETTE = ['#c9a227', '#2563eb', '#0d9488', '#dc2626'];
const INDICATORS: [IndicatorKey, string][] = [
  ['gdpGrowth', 'GDP growth'],
  ['cpi', 'CPI inflation'],
  ['policyRate', 'Policy rate'],
  ['unemployment', 'Unemployment'],
  ['fx', 'FX'],
  ['tradeBalance', 'Trade balance'],
];
const DAY = 86_400_000;

export default function Compare() {
  const { snapshot, articles, events, settings, newsLoadedAt = 0 } = useAppData();
  const [selected, setSelected] = useState<CountryCode[]>(() =>
    [...new Set([settings.country, ...settings.watchlist])].slice(0, 3),
  );
  const [indicators, setIndicators] = useState<IndicatorKey[]>([
    'cpi',
    'policyRate',
    'gdpGrowth',
    'unemployment',
  ]);
  const [windowDays, setWindowDays] = useState(30);
  const views = useCountryViews(selected);

  const toggle = (code: CountryCode) =>
    setSelected((s) =>
      s.includes(code) ? s.filter((c) => c !== code) : s.length < MAX ? [...s, code] : s,
    );

  const sentiment = useMemo(() => {
    const days = Array.from({ length: windowDays }, (_, i) =>
      new Date(newsLoadedAt - (windowDays - 1 - i) * DAY).toISOString().slice(0, 10),
    );
    return {
      labels: days.map((d) => d.slice(5)),
      series: selected.map((code, idx) => ({
        label: getCountry(code).name,
        color: PALETTE[idx]!,
        values: days.map((day) => {
          const list = articles.filter(
            (a) => a.country === code && a.weight > 0 && a.publishedAt.startsWith(day),
          );
          if (list.length === 0) return undefined;
          const w = list.reduce((s, a) => s + a.weight, 0);
          return list.reduce((s, a) => s + a.weight * a.analysis.sentiment.monetaryScore, 0) / w;
        }),
      })),
    };
  }, [articles, selected, windowDays, newsLoadedAt]);

  const eventCounts = useMemo(() => {
    const cutoff = newsLoadedAt - windowDays * DAY;
    return selected.map((code) => {
      const counts = new Map<EventType, number>();
      for (const e of events)
        if (e.country === code && Date.parse(e.date) >= cutoff)
          counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      return { code, counts };
    });
  }, [events, selected, windowDays, newsLoadedAt]);

  const divergences = useMemo(() => {
    if (!snapshot) return [];
    const directions = Object.fromEntries(selected.map((c) => [c, views[c]?.forecast.direction]));
    return detectDivergences(selected, snapshot, directions, events);
  }, [snapshot, selected, views, events]);

  if (!snapshot) return null;
  const latest = (code: CountryCode, key: IndicatorKey) =>
    snapshot.countries[code]?.series[key]?.points.at(-1);

  function exportCsv() {
    const header = ['Indicator', ...selected.map((c) => getCountry(c).name)];
    const rows = INDICATORS.map(([key, label]) => [
      label,
      ...selected.map((c) => latest(c, key)?.[1]),
    ]);
    const extra = [
      ['Policy risk score', ...selected.map((c) => views[c]?.risk.score)],
      ['P(tighten)', ...selected.map((c) => views[c]?.forecast.pTighten.toFixed(3))],
      ['P(ease)', ...selected.map((c) => views[c]?.forecast.pEase.toFixed(3))],
    ];
    downloadText(
      `fedlens-compare-${selected.join('-')}.csv`,
      toCsv([header, ...rows, ...extra]),
      'text/csv',
    );
  }

  return (
    <div className="space-y-3">
      <Card
        title={`Compare (up to ${MAX})`}
        action={
          <Button onClick={exportCsv}>
            <Download className="size-3.5" /> CSV
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => toggle(c.code)}
              aria-pressed={selected.includes(c.code)}
              className={`rounded-md px-2 py-1 text-[11.5px] ${selected.includes(c.code) ? 'bg-ink text-surface' : 'bg-surface-2 text-muted hover:text-ink'}`}
            >
              {c.code}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {INDICATORS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-[11.5px] text-muted">
              <input
                type="checkbox"
                checked={indicators.includes(key)}
                onChange={() =>
                  setIndicators((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11.5px] text-muted">
          Window
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="rounded border border-line bg-surface px-1"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
      </Card>

      {selected.length < 2 ? (
        <Card>
          <Empty>Select at least two economies.</Empty>
        </Card>
      ) : (
        <>
          {divergences.length > 0 && (
            <Card title="Divergence detector">
              <ul className="space-y-2 text-[12px]">
                {divergences.map((d, i) => (
                  <li key={i}>
                    <Badge tone={d.kind === 'shock' ? 'shock' : 'flat'}>{d.kind}</Badge> {d.message}
                    {d.history && (
                      <p className="mt-0.5 text-[11px] text-muted">
                        History: in {d.history.episodes} similar episode(s),{' '}
                        {getCountry(d.countries[0]).currency} moved a median{' '}
                        {d.history.medianAppreciation > 0 ? '+' : ''}
                        {d.history.medianAppreciation}% vs {getCountry(d.countries[1]).currency}{' '}
                        over the next {d.history.horizonMonths} months.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Macro indicators">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-[11px] text-muted">
                  <tr>
                    <th className="font-medium">Indicator</th>
                    {selected.map((c) => (
                      <th key={c} className="text-right font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INDICATORS.filter(([k]) => indicators.includes(k)).map(([key, label]) => (
                    <tr key={key} className="border-t border-line">
                      <td className="py-1">{label}</td>
                      {selected.map((c) => {
                        const p = latest(c, key);
                        return (
                          <td
                            key={c}
                            className="text-right tabular-nums"
                            title={
                              p
                                ? `${snapshot.countries[c]?.series[key]?.unit} · ${p[0]}`
                                : undefined
                            }
                          >
                            {formatValue(p?.[1])}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <td className="py-1">CB stance</td>
                    {selected.map((c) => (
                      <td key={c} className="text-right">
                        {views[c]?.document ? (
                          <StanceBadge value={views[c]!.document!.stance.label} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Policy risk score">
            <BarList
              scaleMax={100}
              items={selected.map((c, i) => ({
                label: getCountry(c).name,
                value: views[c]?.risk.score ?? 0,
                color: PALETTE[i]!,
              }))}
            />
          </Card>

          <Card title={`News tone (${windowDays}d, −1 dovish … +1 hawkish)`}>
            <LineChart labels={sentiment.labels} series={sentiment.series} />
          </Card>

          <Card title={`Events by type (${windowDays}d)`}>
            {eventCounts.every((e) => e.counts.size === 0) ? (
              <Empty>No events in this window.</Empty>
            ) : (
              <ul className="space-y-1 text-[12px]">
                {eventCounts.map(({ code, counts }) => (
                  <li key={code}>
                    <span className="font-medium">{code}</span>{' '}
                    {counts.size === 0 ? (
                      <span className="text-muted">none</span>
                    ) : (
                      [...counts].map(([t, n]) => (
                        <Badge key={t}>
                          {EVENT_LABELS[t]} × {n}
                        </Badge>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Forecasts">
            <div className="grid grid-cols-2 gap-2">
              {selected.map((c) => {
                const f = views[c]?.forecast;
                return f ? (
                  <div key={c} className="rounded-md bg-surface-2 p-2 text-[12px]">
                    <div className="font-medium">{getCountry(c).name}</div>
                    <div className="tabular-nums">
                      ↑ {Math.round(f.pTighten * 100)}% · ↓ {Math.round(f.pEase * 100)}%
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      {f.direction} <ConfidenceBadge value={f.confidence} />
                    </div>
                  </div>
                ) : null;
              })}
            </div>
            <SourceLine>
              Divergence rules are deterministic; FX history uses ECB reference rates and BIS policy
              rates.
            </SourceLine>
          </Card>
        </>
      )}
    </div>
  );
}
