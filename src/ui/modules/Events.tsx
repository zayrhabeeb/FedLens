/** Module 3 — Macro Event Extractor timeline (PRD §6). */
import { useMemo, useState } from 'react';
import { EVENT_LABELS } from '../../nlp/events';
import { COUNTRIES, getCountry } from '../../shared/countries';
import type { Confidence, CountryCode, EventType } from '../../shared/types';
import {
  Badge,
  Card,
  ConfidenceBadge,
  Empty,
  Select,
  SentimentDot,
  SourceLine,
} from '../components/primitives';
import { useAppData } from '../state/AppData';

const CONFIDENCE_RANK: Record<Confidence, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

export default function Events() {
  const { events, activityWindows, articles, settings } = useAppData();
  const [country, setCountry] = useState<'all' | CountryCode>(settings.country);
  const [type, setType] = useState<'all' | EventType>('all');
  const [minConfidence, setMinConfidence] = useState<Confidence>('LOW');

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (country === 'all' || e.country === country) &&
          (type === 'all' || e.type === type) &&
          CONFIDENCE_RANK[e.confidence] >= CONFIDENCE_RANK[minConfidence],
      ),
    [events, country, type, minConfidence],
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const e of filtered) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
    return [...groups];
  }, [filtered]);

  const windows = activityWindows.filter((w) => country === 'all' || w.country === country);
  const articleById = new Map(articles.map((a) => [a.id, a]));

  return (
    <div className="space-y-3">
      <Card title="Event timeline">
        <div className="flex flex-wrap gap-2">
          <Select<'all' | CountryCode>
            label="Country"
            value={country}
            onChange={setCountry}
            options={[
              { value: 'all', label: 'All economies' },
              ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
            ]}
          />
          <Select<'all' | EventType>
            label="Event type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All types' },
              ...(Object.keys(EVENT_LABELS) as EventType[]).map((t) => ({
                value: t,
                label: EVENT_LABELS[t],
              })),
            ]}
          />
          <Select<Confidence>
            label="Minimum confidence"
            value={minConfidence}
            onChange={setMinConfidence}
            options={[
              { value: 'LOW', label: 'Any confidence' },
              { value: 'MODERATE', label: 'Moderate+' },
              { value: 'HIGH', label: 'High only' },
            ]}
          />
        </div>
        {windows.length > 0 && (
          <ul className="mt-2 space-y-1">
            {windows.map((w) => (
              <li key={`${w.country}-${w.start}`}>
                <Badge tone="shock">
                  High-activity window · {getCountry(w.country).name} · {w.start} → {w.end} (
                  {w.eventIds.length} events)
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        {byDate.length === 0 ? (
          <Empty>
            No events match. Events are detected from credible (Tier 1–3) news and from analysed
            documents.
          </Empty>
        ) : (
          <ol className="relative border-l border-line pl-4">
            {byDate.map(([date, list]) => (
              <li key={date} className="mb-3">
                <span className="absolute -left-1 mt-1 size-2 rounded-full bg-accent" aria-hidden />
                <div className="text-[11px] font-semibold text-muted">{date}</div>
                <ul className="mt-1 space-y-2">
                  {list.map((e) => (
                    <li key={e.id} className="rounded-md bg-surface-2 p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="accent">{EVENT_LABELS[e.type]}</Badge>
                        {e.direction && <Badge>{e.direction}</Badge>}
                        <Badge>{getCountry(e.country).name}</Badge>
                        <ConfidenceBadge value={e.confidence} />
                        <SentimentDot value={e.sentiment} />
                      </div>
                      <p className="mt-1 text-[12.5px]">{e.headline}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {e.linkedDocumentId
                          ? 'Source: analysed central bank document'
                          : `Sources: ${e.sourceArticleIds
                              .map((id) => articleById.get(id)?.source)
                              .filter(Boolean)
                              .join(', ')}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        <SourceLine>
          Same economy + type within 3 days counts as one event. Corroboration by 3+ sources incl. a
          Tier 1 outlet upgrades confidence to HIGH.
        </SourceLine>
      </Card>
    </div>
  );
}
