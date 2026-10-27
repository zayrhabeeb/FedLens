/** Module 1 — Country Intelligence Dashboard (PRD §4). */
import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Flame } from 'lucide-react';
import { newsIntensity } from '../../analytics/intensity';
import { EVENT_LABELS } from '../../nlp/events';
import { getCountry } from '../../shared/countries';
import { latestPair } from '../../shared/series';
import type { CountryCode, IndicatorKey, Series } from '../../shared/types';
import { BarList, ProbabilityBar, Sparkline } from '../components/charts';
import {
  Badge,
  Card,
  ConfidenceBadge,
  Empty,
  SourceLine,
  StanceBadge,
} from '../components/primitives';
import { formatValue, relativeTime } from '../lib/format';
import { SOURCE_LABELS } from '../lib/sources';
import { useAppData } from '../state/AppData';
import { useCountryView } from '../state/derived';

type Trend = 'up' | 'flat' | 'down';

/** Whether a move is good (up), mixed (flat) or bad (down) depends on the indicator. */
function judge(key: IndicatorKey, code: CountryCode, current: number, prior: number): Trend {
  const d = current - prior;
  switch (key) {
    case 'gdpGrowth':
    case 'tradeBalance':
      return Math.abs(d) < 0.1 ? 'flat' : d > 0 ? 'up' : 'down';
    case 'unemployment':
      return Math.abs(d) < 0.1 ? 'flat' : d < 0 ? 'up' : 'down';
    case 'cpi': {
      const target = getCountry(code).inflationTarget;
      const gap = Math.abs(current - target) - Math.abs(prior - target);
      return Math.abs(gap) < 0.1 ? 'flat' : gap < 0 ? 'up' : 'down';
    }
    case 'fx': {
      // Stored as local per USD (USD per EUR for the euro area): rising = depreciation, except EA.
      const pctMove = (d / prior) * 100 * (code === 'EA' ? -1 : 1);
      return Math.abs(pctMove) < 1 ? 'flat' : pctMove > 0 ? 'down' : 'up';
    }
    default:
      return 'flat';
  }
}

/** Colour encodes the judgement (good / mixed / bad); the arrow encodes the numeric direction. */
const TREND_COLOR: Record<Trend, string> = { up: 'text-up', flat: 'text-flat', down: 'text-down' };

function Tile({
  code,
  k,
  label,
  series,
}: {
  code: CountryCode;
  k: IndicatorKey;
  label: string;
  series?: Series;
}) {
  const { current, prior } = latestPair(series);
  if (!series || !current) {
    return (
      <div className="rounded-md bg-surface-2 p-2">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-[15px] text-muted">—</div>
      </div>
    );
  }
  const trend = prior ? judge(k, code, current[1], prior[1]) : 'flat';
  const color = TREND_COLOR[trend];
  const delta = prior ? current[1] - prior[1] : undefined;
  const Icon =
    delta === undefined || delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className="rounded-md bg-surface-2 p-2"
      title={`${series.label} · ${SOURCE_LABELS[series.source]} · ${current[0]}`}
    >
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>{current[0]}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[16px] font-semibold tabular-nums">{formatValue(current[1])}</span>
        <span className="text-[10.5px] text-muted">{series.unit}</span>
      </div>
      {delta !== undefined && (
        <div className={`flex items-center gap-0.5 text-[11px] ${color}`}>
          <Icon className="size-3" aria-hidden />
          <span className="tabular-nums">
            {delta >= 0 ? '+' : ''}
            {formatValue(delta)}
          </span>
          <span className="text-muted">vs {prior![0]}</span>
        </div>
      )}
    </div>
  );
}

const TILES: [IndicatorKey, string][] = [
  ['gdpGrowth', 'GDP growth'],
  ['cpi', 'CPI inflation'],
  ['policyRate', 'Policy rate'],
  ['unemployment', 'Unemployment'],
  ['fx', 'FX'],
  ['tradeBalance', 'Trade balance'],
];

export function Dashboard() {
  const { snapshot, articles, events, activityWindows, settings } = useAppData();
  const code = settings.country;
  const country = getCountry(code);
  const view = useCountryView(code);
  const [openEvent, setOpenEvent] = useState<string>();
  if (!snapshot || !view) return null;

  const series = snapshot.countries[code]?.series ?? {};
  const intensity = newsIntensity(articles, code);
  const recentEvents = events.filter((e) => e.country === code).slice(0, 5);
  const highActivity = activityWindows.find((w) => w.country === code);
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const usedSources = [...new Set(Object.values(series).map((s) => SOURCE_LABELS[s.source]))];

  return (
    <div className="space-y-3">
      <Card title={`${country.name} · macro snapshot`} action={<Badge>{country.region}</Badge>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* The US dollar is the FX base currency, so the US shows no FX tile. */}
          {TILES.filter(([k]) => !(code === 'US' && k === 'fx')).map(([k, label]) => (
            <Tile key={k} code={code} k={k} label={label} series={series[k]} />
          ))}
          {series.yield2y && (
            <Tile code={code} k="yield2y" label="2y Treasury" series={series.yield2y} />
          )}
          {series.publicDebt && (
            <Tile code={code} k="publicDebt" label="Public debt" series={series.publicDebt} />
          )}
        </div>
        <SourceLine>
          Sources: {usedSources.join(', ')} · snapshot {snapshot.generatedAt.slice(0, 10)}. Annual
          series (World Bank) lag by up to a year.
        </SourceLine>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Policy outlook (next ~3 months)">
          <ProbabilityBar tighten={view.forecast.pTighten} ease={view.forecast.pEase} />
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <span className="font-medium">{view.forecast.direction}</span>
            <ConfidenceBadge value={view.forecast.confidence} />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[12px]">
            <span className="text-muted">{country.centralBankShort} stance</span>
            {view.document ? (
              <span className="flex items-center gap-1.5" title={`From "${view.document.title}"`}>
                <StanceBadge value={view.document.stance.label} />
                <span className="text-[11px] text-muted">
                  {relativeTime(view.document.analyzedAt)}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-muted">
                No recent document — analyse one in Docs
              </span>
            )}
          </div>
        </Card>

        <Card
          title="News intensity (30 days)"
          action={
            intensity.spike && (
              <Badge tone="shock">
                <Flame className="size-3" /> Spike
              </Badge>
            )
          }
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[20px] font-semibold tabular-nums">{intensity.last7}</div>
              <div className="text-[11px] text-muted">
                articles, last 7 days (avg {intensity.weeklyAverage.toFixed(1)}/wk)
              </div>
            </div>
            <Sparkline
              values={intensity.daily}
              width={120}
              height={32}
              label="Daily article count, last 30 days"
            />
          </div>
        </Card>
      </div>

      <Card
        title="Policy risk score"
        action={
          <Badge
            tone={
              view.risk.level === 'High' ? 'down' : view.risk.level === 'Elevated' ? 'flat' : 'up'
            }
          >
            {view.risk.score}/100 · {view.risk.level}
          </Badge>
        }
      >
        <BarList
          scaleMax={1}
          format={(v) => `${Math.round(v * 100)}%`}
          items={view.risk.components.map((c) => ({
            label: `${c.label} (${c.weight}%)`,
            value: c.value,
            hint: c.detail,
          }))}
        />
        <SourceLine>Rule-based weighted sum; hover a bar for its inputs.</SourceLine>
      </Card>

      <Card
        title="Recent events"
        action={highActivity && <Badge tone="shock">High-activity window</Badge>}
      >
        {recentEvents.length === 0 ? (
          <Empty>No events detected for {country.name} in the current news window.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {recentEvents.map((e) => (
              <li key={e.id} className="py-1.5">
                <button
                  className="w-full text-left"
                  onClick={() => setOpenEvent(openEvent === e.id ? undefined : e.id)}
                  aria-expanded={openEvent === e.id}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge tone="accent">{EVENT_LABELS[e.type]}</Badge>
                    <span className="text-[11px] text-muted">{e.date}</span>
                    <ConfidenceBadge value={e.confidence} />
                  </div>
                  <div className="mt-0.5 text-[12.5px]">{e.headline}</div>
                </button>
                {openEvent === e.id && (
                  <ul className="mt-1 space-y-0.5 pl-2 text-[11.5px]">
                    {e.sourceArticleIds
                      .map((id) => articleById.get(id))
                      .filter(Boolean)
                      .map((a) => (
                        <li key={a!.id}>
                          <a
                            href={a!.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            {a!.source}
                          </a>{' '}
                          <span className="text-muted">— {a!.title}</span>
                        </li>
                      ))}
                    {e.linkedDocumentId && (
                      <li className="text-muted">From an analysed central bank document.</li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
