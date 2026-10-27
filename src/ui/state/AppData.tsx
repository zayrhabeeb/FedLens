/**
 * App-wide data context: loads snapshots, news, documents and settings once,
 * runs the deterministic pipeline, and exposes derived results to modules.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Cached } from '../../data/cache';
import { listDocuments } from '../../data/documents';
import { loadNews, type FeedStatus } from '../../data/news';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../../data/settings';
import { loadIndicatorSnapshot } from '../../data/snapshot';
import { calibrate, poolSamples } from '../../forecast/backtest';
import { DEFAULT_CALIBRATION, type Calibration } from '../../forecast/model';
import { processArticle, type ProcessedArticle } from '../../nlp/analyze';
import type { DocumentAnalysis } from '../../nlp/document';
import {
  buildEvents,
  findHighActivityWindows,
  type ActivityWindow,
  type MacroEvent,
} from '../../nlp/events';
import type { IndicatorSnapshot } from '../../shared/types';

export interface AppData {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  refreshing: boolean;
  snapshot?: IndicatorSnapshot;
  snapshotMeta?: Omit<Cached<unknown>, 'value'>;
  articles: ProcessedArticle[];
  feeds: FeedStatus[];
  newsLoadedAt?: number;
  events: MacroEvent[];
  activityWindows: ActivityWindow[];
  documents: DocumentAnalysis[];
  setDocuments: (docs: DocumentAnalysis[]) => void;
  calibration: Calibration;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  refresh: (force?: boolean) => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

/**
 * Indicators first (one request, drives most of the UI), then news, which
 * fans out to many feeds and runs the NLP pipeline.
 */
async function fetchAppData(
  force: boolean,
  onIndicators: (snap: Cached<IndicatorSnapshot>) => void,
) {
  onIndicators(await loadIndicatorSnapshot(force));
  const news = await loadNews(force);
  return { articles: news.articles.map(processArticle), feeds: news.feeds, loadedAt: Date.now() };
}

export function useAppData(): AppData {
  const value = use(Ctx);
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>');
  return value;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppData['status']>('loading');
  const [error, setError] = useState<string>();
  // Starts true: the initial load begins on mount.
  const [refreshing, setRefreshing] = useState(true);
  const [snapshot, setSnapshot] = useState<Cached<IndicatorSnapshot>>();
  const [articles, setArticles] = useState<ProcessedArticle[]>([]);
  const [feeds, setFeeds] = useState<FeedStatus[]>([]);
  const [newsLoadedAt, setNewsLoadedAt] = useState<number>();
  const [documents, setDocuments] = useState<DocumentAnalysis[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  /** Fetch indicators then news; results are applied in promise callbacks. */
  const load = useCallback((force: boolean) => {
    const onIndicators = (snap: Cached<IndicatorSnapshot>) => {
      setSnapshot(snap);
      setStatus('ready');
    };
    return fetchAppData(force, onIndicators)
      .then(
        (news) => {
          setArticles(news.articles);
          setFeeds(news.feeds);
          setNewsLoadedAt(news.loadedAt);
        },
        (err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
          setStatus((st) => (st === 'ready' ? st : 'error'));
        },
      )
      .finally(() => setRefreshing(false));
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      setRefreshing(true);
      await load(force);
    },
    [load],
  );

  useEffect(() => {
    void loadSettings().then(setSettings);
    void listDocuments().then(setDocuments);
    void load(false);
  }, [load]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const events = useMemo(
    () =>
      [...buildEvents(articles), ...documents.flatMap((d) => d.events)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [articles, documents],
  );
  const activityWindows = useMemo(() => findHighActivityWindows(events), [events]);

  // Platt calibration fitted on the full historical panel (see forecast/backtest.ts).
  const calibration = useMemo(() => {
    if (!snapshot) return DEFAULT_CALIBRATION;
    const samples = poolSamples(snapshot.value);
    return samples.length >= 100
      ? calibrate(samples, `pooled panel, ${samples.length} country-months`)
      : DEFAULT_CALIBRATION;
  }, [snapshot]);

  const value: AppData = {
    status,
    ...(error ? { error } : {}),
    refreshing,
    ...(snapshot
      ? {
          snapshot: snapshot.value,
          snapshotMeta: {
            storedAt: snapshot.storedAt,
            origin: snapshot.origin,
            ...(snapshot.error ? { error: snapshot.error } : {}),
          },
        }
      : {}),
    articles,
    feeds,
    ...(newsLoadedAt ? { newsLoadedAt } : {}),
    events,
    activityWindows,
    documents,
    setDocuments,
    calibration,
    settings,
    updateSettings,
    refresh,
  };
  return <Ctx value={value}>{children}</Ctx>;
}
