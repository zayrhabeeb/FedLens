import { lazy, Suspense, useState, type ComponentType } from 'react';
import {
  BarChart3,
  CalendarClock,
  ExternalLink,
  FileText,
  GitCompare,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  ScrollText,
  Settings as SettingsIcon,
  Star,
} from 'lucide-react';
import { COUNTRIES, getCountry } from '../shared/countries';
import { DISCLAIMER } from '../shared/disclaimer';
import type { CountryCode } from '../shared/types';
import { Button, Spinner } from './components/primitives';
import { relativeTime } from './lib/format';
import { useAppData } from './state/AppData';
import { Dashboard } from './modules/Dashboard';

// Secondary modules are code-split so the panel opens fast.
const NewsRadar = lazy(() => import('./modules/NewsRadar'));
const Events = lazy(() => import('./modules/Events'));
const Documents = lazy(() => import('./modules/Documents'));
const ForecastLab = lazy(() => import('./modules/ForecastLab'));
const Compare = lazy(() => import('./modules/Compare'));
const Brief = lazy(() => import('./modules/Brief'));
const SettingsPage = lazy(() => import('./modules/Settings'));

type TabId =
  'dashboard' | 'news' | 'events' | 'docs' | 'forecast' | 'compare' | 'brief' | 'settings';

const TABS: {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  view: ComponentType;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: Dashboard },
  { id: 'news', label: 'News', icon: Newspaper, view: NewsRadar },
  { id: 'events', label: 'Events', icon: CalendarClock, view: Events },
  { id: 'docs', label: 'Docs', icon: FileText, view: Documents },
  { id: 'forecast', label: 'Forecast', icon: BarChart3, view: ForecastLab },
  { id: 'compare', label: 'Compare', icon: GitCompare, view: Compare },
  { id: 'brief', label: 'Brief', icon: ScrollText, view: Brief },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, view: SettingsPage },
];

function CountryPicker() {
  const { settings, updateSettings } = useAppData();
  const starred = settings.watchlist.includes(settings.country);
  const ordered = [...COUNTRIES].sort(
    (a, b) =>
      Number(settings.watchlist.includes(b.code)) - Number(settings.watchlist.includes(a.code)),
  );
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Country"
        value={settings.country}
        onChange={(e) => updateSettings({ country: e.target.value as CountryCode })}
        className="max-w-40 rounded-md border border-line bg-surface px-2 py-1 text-[12px]"
      >
        {ordered.map((c) => (
          <option key={c.code} value={c.code}>
            {settings.watchlist.includes(c.code) ? '★ ' : ''}
            {c.name}
          </option>
        ))}
      </select>
      <button
        aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'}
        title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
        onClick={() =>
          updateSettings({
            watchlist: starred
              ? settings.watchlist.filter((c) => c !== settings.country)
              : [...settings.watchlist, settings.country],
          })
        }
        className="rounded p-1 text-muted hover:text-accent"
      >
        <Star className={`size-4 ${starred ? 'fill-accent text-accent' : ''}`} />
      </button>
    </div>
  );
}

function DisclaimerGate() {
  const { updateSettings } = useAppData();
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-3xl font-semibold">FedLens</h1>
      <p className="text-muted">
        Global macro intelligence for 12 economies — free, keyless and deterministic-first.
      </p>
      <p className="rounded-md border border-line bg-surface p-3 text-[12px] leading-relaxed">
        {DISCLAIMER}
      </p>
      <Button variant="primary" onClick={() => updateSettings({ disclaimerAccepted: true })}>
        I understand — continue
      </Button>
    </div>
  );
}

export function App() {
  const data = useAppData();
  const [tab, setTab] = useState<TabId>('dashboard');
  if (!data.settings.disclaimerAccepted) return <DisclaimerGate />;
  const View = TABS.find((t) => t.id === tab)!.view;
  const isPanel = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold">FedLens</span>
          <span className="text-[11px] text-muted">
            {getCountry(data.settings.country).centralBankShort}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <CountryPicker />
          <button
            aria-label="Refresh data"
            title={
              data.snapshotMeta
                ? `Data from ${data.snapshotMeta.origin}, ${relativeTime(data.snapshotMeta.storedAt)}`
                : 'Refresh'
            }
            onClick={() => void data.refresh(true)}
            className="rounded p-1 text-muted hover:text-ink"
          >
            <RefreshCw className={`size-4 ${data.refreshing ? 'animate-spin' : ''}`} />
          </button>
          {isPanel && (
            <a
              aria-label="Open in a tab"
              title="Open in a full tab"
              href="index.html"
              target="_blank"
              className="rounded p-1 text-muted hover:text-ink"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </header>

      <nav
        aria-label="Modules"
        className="no-print flex gap-0.5 overflow-x-auto [scrollbar-width:none] border-b border-line bg-surface px-2"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1 border-b-2 px-2 py-2 text-[12px] ${tab === id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <main className="print-area flex-1 overflow-y-auto p-3">
        {data.status === 'loading' && <Spinner label="Loading data snapshot…" />}
        {data.status === 'error' && (
          <p className="p-4 text-down">Could not load data: {data.error}</p>
        )}
        {data.status === 'ready' && (
          <Suspense fallback={<Spinner />}>
            <View />
          </Suspense>
        )}
      </main>

      <footer className="no-print border-t border-line bg-surface px-3 py-1.5 text-[10.5px] text-muted">
        Not financial advice · Data from third-party public sources
      </footer>
    </div>
  );
}
