/** Settings: synthesis mode (template / local model / BYOK), data status, about. */
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SNAPSHOT_BASE_URL } from '../../config';
import type { ByokSettings, SynthesisMode } from '../../data/settings';
import { isExtension, store } from '../../data/storage';
import { FEED_HOSTS } from '../../shared/feeds';
import { DISCLAIMER } from '../../shared/disclaimer';
import { endpointOrigin } from '../../synthesis/byok';
import { LOCAL_MODEL_ID, LOCAL_MODEL_SIZE_HINT, type ProgressInfo } from '../../synthesis/local';
import { Button, Card, Note, SourceLine } from '../components/primitives';
import { relativeTime } from '../lib/format';
import { SOURCE_LABELS } from '../lib/sources';
import { useAppData } from '../state/AppData';

const MODES: { value: SynthesisMode; label: string; help: string }[] = [
  {
    value: 'template',
    label: 'Deterministic templates (default)',
    help: 'Rule-based text built from extracted facts. Instant, offline, fully reproducible.',
  },
  {
    value: 'local',
    label: 'Local model (optional)',
    help: `Runs ${LOCAL_MODEL_ID} on your device via Transformers.js. ${LOCAL_MODEL_SIZE_HINT}. Nothing leaves your browser.`,
  },
  {
    value: 'byok',
    label: 'Your own endpoint (optional)',
    help: 'Any OpenAI-compatible API — e.g. free local Ollama or LM Studio. Your key stays in this browser only.',
  },
];

function LocalModelPanel() {
  const [progress, setProgress] = useState<ProgressInfo>();
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string>();
  async function load() {
    setState('loading');
    try {
      const { loadLocalModel } = await import('../../synthesis/local');
      await loadLocalModel(setProgress);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }
  return (
    <div className="mt-2 space-y-1 text-[12px]">
      <Button onClick={() => void load()} disabled={state === 'loading' || state === 'ready'}>
        {state === 'ready'
          ? 'Model ready'
          : state === 'loading'
            ? 'Downloading…'
            : 'Download & load model'}
      </Button>
      {state === 'loading' && progress && (
        <p className="text-muted">
          {progress.status} {progress.file ?? ''}{' '}
          {progress.progress !== undefined ? `${Math.round(progress.progress)}%` : ''}
        </p>
      )}
      {error && <Note>{error}</Note>}
      <p className="text-[11px] text-muted">
        Generated text must pass the hallucination shield (no new numbers, economies or advice) or
        the template is used instead.
      </p>
    </div>
  );
}

function ByokPanel({ value, onSave }: { value: ByokSettings; onSave: (v: ByokSettings) => void }) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<string>();
  async function save() {
    try {
      const granted = await chrome.permissions.request({
        origins: [endpointOrigin(draft.endpoint)],
      });
      if (!granted) {
        setStatus('Permission to contact this endpoint was declined.');
        return;
      }
      onSave(draft);
      setStatus('Saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }
  const field = (key: keyof ByokSettings, label: string, type = 'text') => (
    <label className="block text-[11.5px] text-muted">
      {label}
      <input
        type={type}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink"
        autoComplete="off"
      />
    </label>
  );
  return (
    <div className="mt-2 space-y-2">
      {field('endpoint', 'Base URL (OpenAI-compatible)')}
      {field('model', 'Model')}
      {field(
        'apiKey',
        'API key (optional; stored only in chrome.storage.local on this device)',
        'password',
      )}
      <Button onClick={() => void save()}>Save endpoint</Button>
      {status && <p className="text-[11.5px] text-muted">{status}</p>}
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, snapshot, snapshotMeta, feeds, refresh } = useAppData();
  const [feedAccess, setFeedAccess] = useState<boolean>();
  const feedOrigins = FEED_HOSTS.map((h) => `https://${h}/*`);

  useEffect(() => {
    if (isExtension) void chrome.permissions.contains({ origins: feedOrigins }).then(setFeedAccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <Card title="Synthesis layer">
        <fieldset className="space-y-2">
          <legend className="sr-only">Synthesis mode</legend>
          {MODES.map((m) => (
            <label key={m.value} className="flex gap-2 text-[12px]">
              <input
                type="radio"
                name="synthesis"
                checked={settings.synthesis === m.value}
                onChange={() => updateSettings({ synthesis: m.value })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{m.label}</span>
                <span className="block text-[11.5px] text-muted">{m.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {settings.synthesis === 'local' && <LocalModelPanel />}
        {settings.synthesis === 'byok' && (
          <ByokPanel value={settings.byok} onSave={(byok) => updateSettings({ byok })} />
        )}
      </Card>

      <Card title="Data">
        {snapshot && snapshotMeta && (
          <p className="text-[12px]">
            Indicator snapshot generated {snapshot.generatedAt.slice(0, 16).replace('T', ' ')} UTC ·
            served from <b>{snapshotMeta.origin}</b>, {relativeTime(snapshotMeta.storedAt)}
            {snapshotMeta.error ? ` · last refresh failed: ${snapshotMeta.error}` : ''}
          </p>
        )}
        <ul className="mt-2 grid grid-cols-2 gap-1 text-[11.5px]">
          {snapshot?.sources.map((s, i) => (
            <li key={i} className="flex items-center gap-1" title={s.detail}>
              {s.ok ? (
                <CheckCircle2 className="size-3 text-up" />
              ) : (
                <XCircle className="size-3 text-down" />
              )}{' '}
              {SOURCE_LABELS[s.id]}: {s.detail?.split(':')[0]}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px]">
          Live feeds: {feeds.filter((f) => f.ok).length}/{feeds.length} reachable
        </p>
        {feedAccess === false && (
          <div className="mt-2 space-y-1">
            <Note>
              Live feed access has not been granted (Firefox asks for host access separately).
            </Note>
            <Button
              onClick={() =>
                void chrome.permissions.request({ origins: feedOrigins }).then((ok) => {
                  setFeedAccess(ok);
                  if (ok) void refresh(true);
                })
              }
            >
              Grant feed access
            </Button>
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <Button onClick={() => void refresh(true)}>Refresh now</Button>
          <Button onClick={() => void store.clearPrefix('cache:').then(() => refresh(true))}>
            Clear cache
          </Button>
        </div>
        <SourceLine>
          Snapshots: {SNAPSHOT_BASE_URL} · cached locally with timestamps; throttled hosts are
          backed off automatically.
        </SourceLine>
      </Card>

      <Card title="About">
        <p className="text-[12px]">
          FedLens v{isExtension ? chrome.runtime.getManifest().version : 'dev'} · MIT License · no
          accounts, no tracking, no API keys required.
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{DISCLAIMER}</p>
      </Card>
    </div>
  );
}
