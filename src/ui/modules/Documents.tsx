/** Module 4 — Central Bank Document Analysis (PRD §7). */
import { useEffect, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { deleteDocument, latestFor, saveDocument } from '../../data/documents';
import { extractPdfText } from '../../data/pdf';
import { analyzeDocument, MIN_DOCUMENT_CHARS, type DocumentAnalysis } from '../../nlp/document';
import { COUNTRIES, getCountry } from '../../shared/countries';
import type { CountryCode } from '../../shared/types';
import { synthesize, type SynthesisResult } from '../../synthesis';
import { documentRequest } from '../../synthesis/drafts';
import {
  Badge,
  Button,
  Card,
  Empty,
  Note,
  Select,
  SourceLine,
  StanceBadge,
} from '../components/primitives';
import { relativeTime } from '../lib/format';
import { useAppData } from '../state/AppData';

function DocumentResult({ doc }: { doc: DocumentAnalysis }) {
  const { settings } = useAppData();
  const [summary, setSummary] = useState<SynthesisResult>();
  useEffect(() => {
    let cancelled = false;
    void synthesize(documentRequest(doc), settings).then((r) => !cancelled && setSummary(r));
    return () => {
      cancelled = true;
    };
  }, [doc, settings]);
  const sentence = (i: number) => doc.sentences[i] ?? '';

  return (
    <div className="space-y-3">
      <Card title={doc.title} action={<StanceBadge value={doc.stance.label} />}>
        <p className="text-[12.5px] leading-relaxed">{summary?.text ?? '…'}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <dt className="text-muted">Stance score</dt>
            <dd className="tabular-nums">{doc.stance.score.toFixed(2)} (−1 dovish … +1 hawkish)</dd>
          </div>
          <div>
            <dt className="text-muted">Forward guidance</dt>
            <dd>
              {doc.guidance.type} · {doc.guidance.bias}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Rate decision</dt>
            <dd>
              {doc.rateDecision
                ? `${doc.rateDecision.direction} ${doc.rateDecision.figures.join(', ')}`
                : 'not stated'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Dissent mentions</dt>
            <dd>{doc.dissent.count}</dd>
          </div>
        </dl>
        {doc.quality.issues.length > 0 && (
          <div className="mt-2">
            <Note>{doc.quality.issues.join(' ')}</Note>
          </div>
        )}
        <SourceLine>
          Quality score {doc.quality.score}/100 · {doc.quality.chars.toLocaleString()} chars ·{' '}
          {doc.quality.macroKeywordHits} macro keywords · events created: {doc.events.length}
        </SourceLine>
      </Card>

      {doc.delta && (
        <Card title="Delta vs previous document">
          <p className="mb-2 text-[12px]">
            Stance shift:{' '}
            <span
              className={
                doc.delta.stanceShift > 0 ? 'text-down' : doc.delta.stanceShift < 0 ? 'text-up' : ''
              }
            >
              {doc.delta.stanceShift > 0 ? '+' : ''}
              {doc.delta.stanceShift.toFixed(2)}
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold text-up">Added phrases</h3>
              <ul className="text-[11.5px]">
                {doc.delta.added.map((p) => (
                  <li key={p}>+ {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold text-down">Removed phrases</h3>
              <ul className="text-[11.5px]">
                {doc.delta.removed.map((p) => (
                  <li key={p}>− {p}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card title="Key sentences (grounding)">
        <ul className="space-y-1.5 text-[12px]">
          {doc.keySentences.map((i) => (
            <li key={i} className="flex gap-2">
              <Badge
                tone={
                  doc.stance.hawkishSentences.includes(i)
                    ? 'down'
                    : doc.stance.dovishSentences.includes(i)
                      ? 'up'
                      : 'neutral'
                }
              >
                {doc.stance.hawkishSentences.includes(i)
                  ? 'hawk'
                  : doc.stance.dovishSentences.includes(i)
                    ? 'dove'
                    : 'fact'}
              </Badge>
              <span>{sentence(i)}</span>
            </li>
          ))}
          {doc.guidance.sentenceIndexes.slice(0, 3).map((i) => (
            <li key={`g${i}`} className="flex gap-2">
              <Badge tone="accent">guidance</Badge>
              <span>{sentence(i)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function Documents() {
  const { documents, setDocuments, settings } = useAppData();
  const [country, setCountry] = useState<CountryCode>(settings.country);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>();

  async function onFile(file: File) {
    setError(undefined);
    setBusy(true);
    try {
      const content = file.name.toLowerCase().endsWith('.pdf')
        ? await extractPdfText(file)
        : await file.text();
      setText(content);
      setTitle(file.name.replace(/\.(pdf|txt)$/i, ''));
    } catch (err) {
      setError(`Could not read file: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setError(undefined);
    try {
      const prior = latestFor(documents, country);
      const doc = analyzeDocument(
        text,
        country,
        title.trim() || `${getCountry(country).centralBankShort} document`,
        prior,
      );
      setDocuments(await saveDocument(doc));
      setSelected(doc.id);
      setText('');
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const current = documents.find((d) => d.id === selected) ?? latestFor(documents, country);

  return (
    <div className="space-y-3">
      <Card title="Analyse a central bank document">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select<CountryCode>
              label="Central bank"
              value={country}
              onChange={setCountry}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.centralBank }))}
            />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] hover:bg-surface-2">
              <Upload className="size-3.5" /> {busy ? 'Reading…' : 'Upload PDF / TXT'}
              <input
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
              />
            </label>
          </div>
          <input
            aria-label="Document title"
            placeholder="Title (e.g. FOMC statement, October 2026)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-[12px]"
          />
          <textarea
            aria-label="Document text"
            placeholder="…or paste a policy statement, minutes or speech"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-28 w-full rounded-md border border-line bg-surface p-2 text-[12px]"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              disabled={text.trim().length < MIN_DOCUMENT_CHARS}
              onClick={() => void analyze()}
            >
              Analyse
            </Button>
            <span className="text-[11px] text-muted">
              {text.length.toLocaleString()} chars · processed locally, never uploaded
            </span>
          </div>
          {error && <Note>{error}</Note>}
        </div>
      </Card>

      {current ? (
        <DocumentResult key={current.id} doc={current} />
      ) : (
        <Card>
          <Empty>No documents analysed for {getCountry(country).centralBank} yet.</Empty>
        </Card>
      )}

      {documents.length > 0 && (
        <Card title="History">
          <ul className="divide-y divide-line text-[12px]">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-1.5">
                <button
                  className="flex-1 text-left hover:underline"
                  onClick={() => {
                    setCountry(d.country);
                    setSelected(d.id);
                  }}
                >
                  {d.title}{' '}
                  <span className="text-muted">
                    · {getCountry(d.country).centralBankShort} · {relativeTime(d.analyzedAt)}
                  </span>
                </button>
                <StanceBadge value={d.stance.label} />
                <button
                  aria-label={`Delete ${d.title}`}
                  className="text-muted hover:text-down"
                  onClick={() => void deleteDocument(d.id).then(setDocuments)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
