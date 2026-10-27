/** Module 2 — Economic News Radar: live feed (PRD §5.1) + analyzer (§5.2). */
import { useMemo, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import type { ProcessedArticle } from '../../nlp/analyze';
import { TOPIC_LABELS } from '../../nlp/classify';
import { getCountry } from '../../shared/countries';
import type { SourceTier, Topic } from '../../shared/types';
import {
  Badge,
  Button,
  Card,
  Empty,
  Segmented,
  Select,
  SentimentDot,
  SourceLine,
  TierBadge,
} from '../components/primitives';
import { relativeTime } from '../lib/format';
import { useAppData } from '../state/AppData';
import { Analyzer, type AnalyzerInput } from './Analyzer';

type TopicFilter = 'all' | Topic;
type Range = '1' | '7' | '30';
type Scope = 'country' | 'watchlist' | 'all';
type Sort = 'recency' | 'credibility' | 'sentiment';

const TIER_ORDER: Record<SourceTier, number> = { TIER_1: 0, TIER_2: 1, TIER_3: 2, TIER_4: 3 };

function ArticleCard({ a, onAnalyze }: { a: ProcessedArticle; onAnalyze: () => void }) {
  const chips = a.analysis.entities.filter((e) => e.kind !== 'country').slice(0, 4);
  return (
    <li className="border-b border-line py-2 last:border-0">
      <a
        href={a.link}
        target="_blank"
        rel="noreferrer"
        className="text-[13px] leading-snug font-medium hover:underline"
      >
        {a.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <SentimentDot value={a.analysis.sentiment.label} />
        <span>{a.source}</span>
        <TierBadge value={a.tier} />
        <span>{relativeTime(a.publishedAt)}</span>
        {a.country && <Badge>{getCountry(a.country).name}</Badge>}
        {a.analysis.topics.primary && (
          <Badge tone="accent">{TOPIC_LABELS[a.analysis.topics.primary]}</Badge>
        )}
        {chips.map((e) => (
          <Badge key={e.start}>{e.normalized}</Badge>
        ))}
        <button
          onClick={onAnalyze}
          className="ml-auto inline-flex items-center gap-0.5 text-accent hover:underline"
        >
          <ScanSearch className="size-3" /> Analyze
        </button>
      </div>
      {a.tier === 'TIER_4' && (
        <p className="mt-1 text-[10.5px] text-down">Unverified source — excluded from scoring.</p>
      )}
    </li>
  );
}

export default function NewsRadar() {
  const { articles, feeds, settings, newsLoadedAt } = useAppData();
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [range, setRange] = useState<Range>('7');
  const [scope, setScope] = useState<Scope>('country');
  const [sort, setSort] = useState<Sort>('recency');
  const [showUnverified, setShowUnverified] = useState(false);
  const [analyzing, setAnalyzing] = useState<AnalyzerInput | null>(null);

  const visible = useMemo(() => {
    // Windows are relative to the last news load, keeping render pure.
    const cutoff = (newsLoadedAt ?? 0) - Number(range) * 86_400_000;
    const inScope = (a: ProcessedArticle) =>
      scope === 'all' ||
      (scope === 'country'
        ? a.country === settings.country
        : a.country !== undefined && settings.watchlist.includes(a.country));
    const list = articles.filter(
      (a) =>
        Date.parse(a.publishedAt) >= cutoff &&
        inScope(a) &&
        (topic === 'all' || a.analysis.topics.topics.includes(topic)) &&
        (showUnverified || a.tier !== 'TIER_4'),
    );
    if (sort === 'credibility')
      list.sort(
        (x, y) =>
          TIER_ORDER[x.tier] - TIER_ORDER[y.tier] || y.publishedAt.localeCompare(x.publishedAt),
      );
    if (sort === 'sentiment')
      list.sort((x, y) => y.analysis.sentiment.monetaryScore - x.analysis.sentiment.monetaryScore);
    return list.slice(0, 150);
  }, [
    articles,
    range,
    scope,
    topic,
    sort,
    showUnverified,
    settings.country,
    settings.watchlist,
    newsLoadedAt,
  ]);

  if (analyzing !== null) {
    return (
      <Analyzer
        key={analyzing.title}
        initial={analyzing.title ? analyzing : undefined}
        onClose={() => setAnalyzing(null)}
      />
    );
  }

  const liveFeeds = feeds.filter((f) => f.ok).length;

  return (
    <div className="space-y-3">
      <Card
        title="Economic news radar"
        action={
          <Button onClick={() => setAnalyzing({ title: '', text: '' })}>
            <ScanSearch className="size-3.5" /> Analyze article
          </Button>
        }
      >
        <div className="space-y-2">
          <Segmented<TopicFilter>
            label="Topic"
            value={topic}
            onChange={setTopic}
            options={[
              { value: 'all', label: 'All' },
              ...(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => ({
                value: t,
                label: TOPIC_LABELS[t],
              })),
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select<Scope>
              label="Scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'country', label: getCountry(settings.country).name },
                { value: 'watchlist', label: 'Watchlist' },
                { value: 'all', label: 'All economies' },
              ]}
            />
            <Select<Range>
              label="Date range"
              value={range}
              onChange={setRange}
              options={[
                { value: '1', label: 'Last 24h' },
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
              ]}
            />
            <Select<Sort>
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recency', label: 'Newest' },
                { value: 'credibility', label: 'Credibility' },
                { value: 'sentiment', label: 'Most hawkish' },
              ]}
            />
            <label className="flex items-center gap-1 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={showUnverified}
                onChange={(e) => setShowUnverified(e.target.checked)}
              />{' '}
              Show unverified
            </label>
          </div>
        </div>
      </Card>

      <Card>
        {visible.length === 0 ? (
          <Empty>No articles match these filters yet.</Empty>
        ) : (
          <ul>
            {visible.map((a) => (
              <ArticleCard
                key={a.id}
                a={a}
                onAnalyze={() =>
                  setAnalyzing({ title: a.title, text: a.summary, url: a.link, source: a.source })
                }
              />
            ))}
          </ul>
        )}
        <SourceLine>
          {liveFeeds}/{feeds.length} live feeds reachable
          {newsLoadedAt ? `, updated ${relativeTime(newsLoadedAt)}` : ''}; the published snapshot
          fills any gaps. Headlines link to the original publisher.
        </SourceLine>
      </Card>
    </div>
  );
}
