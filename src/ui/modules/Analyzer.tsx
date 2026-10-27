/** Module 2.2 — URL / Article Analyzer (PRD §5.2). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Download, ScanText } from 'lucide-react';
import { findParallels } from '../../analytics/parallels';
import { extractActiveTab, PageAccessError, requestPageAccess } from '../../data/pageText';
import { analyzeText } from '../../nlp/analyze';
import { TOPIC_LABELS } from '../../nlp/classify';
import { tierFor } from '../../nlp/credibility';
import { detectEvents, EVENT_LABELS } from '../../nlp/events';
import { mapImplications } from '../../nlp/implications';
import type { Entity, TextAnalysis } from '../../nlp/types';
import { getCountry } from '../../shared/countries';
import { synthesize, type SynthesisResult } from '../../synthesis';
import { articleRequest } from '../../synthesis/drafts';
import {
  Badge,
  Button,
  Card,
  ConfidenceBadge,
  Empty,
  Note,
  Segmented,
  SentimentDot,
  SourceLine,
  TierBadge,
} from '../components/primitives';
import { downloadText } from '../lib/format';
import { useAppData } from '../state/AppData';

export interface AnalyzerInput {
  title: string;
  text: string;
  url?: string;
  source?: string;
}

const ENTITY_STYLE: Record<Entity['kind'], string> = {
  figure: 'bg-accent-soft text-accent',
  institution: 'bg-up/10 text-up',
  country: 'bg-surface-2',
  action: 'bg-down/10 text-down',
};

/** Article text with entity highlights; claim sentences are underlined. */
function HighlightedText({ text, analysis }: { text: string; analysis: TextAnalysis }) {
  const claimSentences = new Set(analysis.claims.map((c) => c.sentenceIndex));
  const out: ReactNode[] = [];
  for (const s of analysis.sentences) {
    const ents = analysis.entities
      .filter((e) => e.sentenceIndex === s.index)
      .sort((a, b) => a.start - b.start || b.length - a.length);
    const parts: ReactNode[] = [];
    let cursor = s.start;
    for (const e of ents) {
      if (e.start < cursor) continue; // overlapping lower-priority match
      parts.push(text.slice(cursor, e.start));
      const claim = analysis.claims.find((c) => c.sentenceIndex === s.index);
      parts.push(
        <mark
          key={e.start}
          className={`rounded px-0.5 ${ENTITY_STYLE[e.kind]}`}
          title={`${e.kind}: ${e.normalized}${e.metric ? ` (${e.metric})` : ''}${claim ? ` · claim ${claim.confidence}` : ''}`}
        >
          {text.slice(e.start, e.start + e.length)}
        </mark>,
      );
      cursor = e.start + e.length;
    }
    parts.push(text.slice(cursor, s.start + s.text.length));
    out.push(
      <span
        key={s.index}
        className={
          claimSentences.has(s.index)
            ? 'underline decoration-accent/50 decoration-dotted underline-offset-2'
            : ''
        }
      >
        {parts}{' '}
      </span>,
    );
  }
  return <p className="leading-relaxed whitespace-pre-line">{out}</p>;
}

type PanelTab = 'entities' | 'implications' | 'parallels' | 'related' | 'memo';

export function Analyzer({ initial, onClose }: { initial?: AnalyzerInput; onClose: () => void }) {
  const { snapshot, articles, settings } = useAppData();
  const [input, setInput] = useState<AnalyzerInput | undefined>(initial);
  const [draftText, setDraftText] = useState('');
  const [pageError, setPageError] = useState<string>();
  const [tab, setTab] = useState<PanelTab>('entities');
  const [memo, setMemo] = useState<SynthesisResult>();

  const result = useMemo(() => {
    if (!input) return undefined;
    const text = `${input.title}.\n${input.text}`;
    const analysis = analyzeText(text, { headlineSentences: 1 });
    const tier = input.source
      ? tierFor(input.source)
      : input.url
        ? tierFor(new URL(input.url).hostname)
        : 'TIER_3';
    const events = detectEvents(text, analysis, tier);
    const country = analysis.primaryCountry;
    const primary = events[0];
    const implications =
      primary && country
        ? mapImplications({
            country,
            type: primary.type,
            stance: analysis.sentiment.stance,
            ...(primary.direction ? { direction: primary.direction } : {}),
          })
        : undefined;
    const parallels =
      primary && country && snapshot
        ? findParallels(snapshot, country, primary.type, primary.direction)
        : null;
    const related = articles
      .filter(
        (a) =>
          a.country === country &&
          a.link !== input.url &&
          (!analysis.topics.primary || a.analysis.topics.topics.includes(analysis.topics.primary)),
      )
      .slice(0, 5);
    return {
      text,
      analysis,
      tier,
      events,
      implications,
      parallels,
      related,
      request: articleRequest(analysis, events, implications),
    };
  }, [input, snapshot, articles]);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    void synthesize(result.request, settings).then((r) => !cancelled && setMemo(r));
    return () => {
      cancelled = true;
      setMemo(undefined);
    };
  }, [result, settings]);

  async function analyzeTab() {
    setPageError(undefined);
    try {
      const page = await extractActiveTab();
      setInput({ title: page.title, text: page.text, url: page.url });
    } catch (err) {
      setPageError(err instanceof PageAccessError ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-3">
      <Card
        title="Article analyzer"
        action={
          <button onClick={onClose} className="text-[12px] text-muted hover:text-ink">
            Close
          </button>
        }
      >
        <Button variant="primary" onClick={() => void analyzeTab()}>
          <ScanText className="size-3.5" /> Analyze current tab
        </Button>
        {pageError && (
          <div className="mt-2 space-y-1">
            <Note>{pageError}</Note>
            <Button
              onClick={() => void requestPageAccess().then((ok) => (ok ? analyzeTab() : undefined))}
            >
              Allow page access
            </Button>
          </div>
        )}
        <textarea
          aria-label="Paste article text"
          placeholder="…or paste article text here"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          className="mt-2 h-20 w-full rounded-md border border-line bg-surface p-2 text-[12px]"
        />
        <Button
          disabled={draftText.trim().length < 40}
          onClick={() =>
            setInput({ title: draftText.split('\n')[0]!.slice(0, 140), text: draftText })
          }
        >
          Analyze pasted text
        </Button>
      </Card>

      {result && input && (
        <>
          <Card title="Intelligence panel">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
              {result.analysis.primaryCountry && (
                <Badge tone="accent">{getCountry(result.analysis.primaryCountry).name}</Badge>
              )}
              {result.analysis.topics.primary && (
                <Badge>{TOPIC_LABELS[result.analysis.topics.primary]}</Badge>
              )}
              <span className="inline-flex items-center gap-1">
                <SentimentDot value={result.analysis.sentiment.label} />{' '}
                {result.analysis.sentiment.label}
              </span>
              <TierBadge value={result.tier} />
              {result.events.map((e) => (
                <Badge key={e.type} tone="shock">
                  {EVENT_LABELS[e.type]}
                  {e.direction ? ` · ${e.direction}` : ''}
                </Badge>
              ))}
            </div>
            <Segmented<PanelTab>
              label="Analysis view"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'entities', label: 'Entities' },
                { value: 'implications', label: 'Implications' },
                { value: 'parallels', label: 'Parallels' },
                { value: 'related', label: 'Related' },
                { value: 'memo', label: 'Memo' },
              ]}
            />
            <div className="mt-3">
              {tab === 'entities' && <EntitiesTab analysis={result.analysis} />}
              {tab === 'implications' &&
                (result.implications ? (
                  <dl className="space-y-2 text-[12px]">
                    {(
                      [
                        ['Macro impact', result.implications.macroImpact],
                        ['Policy implication', result.implications.policyImplication],
                        ['Market signals', result.implications.marketSignals],
                        ['Risks', result.implications.risks],
                        ['What to watch', result.implications.whatToWatch],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-medium">{k}</dt>
                        <dd className="text-muted">{v}</dd>
                      </div>
                    ))}
                    <SourceLine>
                      Rule-based scenario tree. Framed as implications if the article is accurate —
                      not predictions.
                    </SourceLine>
                  </dl>
                ) : (
                  <Empty>No macro event detected, so no implication rules apply.</Empty>
                ))}
              {tab === 'parallels' &&
                (result.parallels ? (
                  <div className="text-[12px]">
                    <p className="mb-2 text-muted">{result.parallels.description}</p>
                    <table className="w-full text-[11.5px]">
                      <thead className="text-left text-muted">
                        <tr>
                          <th className="font-medium">Month</th>
                          <th className="font-medium">Trigger</th>
                          {Object.keys(result.parallels.summary).map((k) => (
                            <th key={k} className="font-medium">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.parallels.episodes.map((ep) => (
                          <tr key={ep.period} className="border-t border-line">
                            <td>{ep.period}</td>
                            <td>{ep.trigger}</td>
                            {Object.keys(result.parallels!.summary).map((k) => (
                              <td key={k} className="tabular-nums">
                                {ep.after[k]?.toFixed(2) ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="border-t border-line font-medium">
                          <td colSpan={2}>Median</td>
                          {Object.values(result.parallels.summary).map((v, i) => (
                            <td key={i} className="tabular-nums">
                              {v.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <SourceLine>
                      Pattern-matched against stored BIS / ECB / FRED history. Past episodes are
                      context, not a forecast.
                    </SourceLine>
                  </div>
                ) : (
                  <Empty>
                    Historical parallels are available for rate decisions (hike/cut) and inflation
                    prints.
                  </Empty>
                ))}
              {tab === 'related' &&
                (result.related.length ? (
                  <ul className="space-y-1.5 text-[12px]">
                    {result.related.map((a) => (
                      <li key={a.id} className="flex items-start gap-1.5">
                        <SentimentDot value={a.analysis.sentiment.label} />
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {a.title} <span className="text-muted">— {a.source}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No related articles in the archive.</Empty>
                ))}
              {tab === 'memo' &&
                (memo ? (
                  <div className="space-y-2 text-[12.5px]">
                    <p className="leading-relaxed">{memo.text}</p>
                    <SourceLine>
                      Written by:{' '}
                      {memo.provider === 'template'
                        ? 'deterministic template'
                        : memo.provider === 'local'
                          ? 'local model (shield-verified)'
                          : 'your endpoint (shield-verified)'}
                      {memo.fellBack ? ` · fell back to template: ${memo.fellBack}` : ''}
                    </SourceLine>
                    <div className="flex gap-2">
                      <Button onClick={() => void navigator.clipboard.writeText(memo.text)}>
                        <Copy className="size-3.5" /> Copy
                      </Button>
                      <Button
                        onClick={() =>
                          downloadText(
                            'fedlens-memo.md',
                            `# ${input.title}\n\n${memo.text}\n\n${input.url ? `Source: ${input.url}\n` : ''}`,
                            'text/markdown',
                          )
                        }
                      >
                        <Download className="size-3.5" /> Export .md
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Empty>Writing memo…</Empty>
                ))}
            </div>
          </Card>

          <Card title="Source text with grounding highlights">
            <div className="max-h-80 overflow-y-auto text-[12px]">
              <HighlightedText text={result.text} analysis={result.analysis} />
            </div>
            <SourceLine>
              Gold = figures, green = institutions, red = policy actions. Dotted underline =
              sentence backing a claim.
            </SourceLine>
          </Card>
        </>
      )}
    </div>
  );
}

function EntitiesTab({ analysis }: { analysis: TextAnalysis }) {
  return (
    <>
      {analysis.claims.length > 0 && (
        <ul className="mb-3 space-y-1">
          {analysis.claims.slice(0, 8).map((c) => (
            <li key={c.sentenceIndex} className="flex gap-2 text-[12px]">
              <ConfidenceBadge value={c.confidence} />
              <span title={c.basis}>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      {analysis.entities.length === 0 ? (
        <Empty>No entities extracted.</Empty>
      ) : (
        <table className="w-full text-[11.5px]">
          <thead className="text-left text-muted">
            <tr>
              <th className="font-medium">Type</th>
              <th className="font-medium">Value</th>
              <th className="font-medium">Metric / detail</th>
            </tr>
          </thead>
          <tbody>
            {analysis.entities.slice(0, 40).map((e) => (
              <tr key={`${e.start}-${e.kind}`} className="border-t border-line">
                <td className="py-0.5 capitalize">{e.kind}</td>
                <td>{e.normalized}</td>
                <td className="text-muted">{e.metric ?? e.country ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
