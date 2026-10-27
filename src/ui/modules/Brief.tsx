/** Module 7 — Research Memo Export: Country Macro Brief (PRD §10). */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Printer } from 'lucide-react';
import { buildCountryBrief } from '../../brief/brief';
import { COUNTRIES, getCountry } from '../../shared/countries';
import type { CountryCode } from '../../shared/types';
import { synthesize, type SynthesisResult } from '../../synthesis';
import { forecastRequest } from '../../synthesis/drafts';
import { Button, Card, Select, SourceLine } from '../components/primitives';
import { downloadText } from '../lib/format';
import { useAppData } from '../state/AppData';
import { useCountryViews } from '../state/derived';

export default function Brief() {
  const { snapshot, events, articles, settings } = useAppData();
  const code = settings.country;
  const [benchmark, setBenchmark] = useState<CountryCode | 'none'>(code === 'US' ? 'EA' : 'US');
  const views = useCountryViews([code]);
  const view = views[code];
  const [narrative, setNarrative] = useState<SynthesisResult>();

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    void synthesize(forecastRequest(code, view.forecast), settings).then(
      (r) => !cancelled && setNarrative(r),
    );
    return () => {
      cancelled = true;
    };
  }, [view, code, settings]);

  const markdown = useMemo(() => {
    if (!snapshot || !view || !narrative) return '';
    return buildCountryBrief({
      code,
      ...(benchmark !== 'none' ? { benchmark } : {}),
      snapshot,
      events,
      articles,
      forecast: view.forecast,
      risk: view.risk,
      ...(view.document ? { document: view.document } : {}),
      narrative: narrative.text,
    });
  }, [snapshot, view, narrative, code, benchmark, events, articles]);

  const filename = `fedlens-brief-${code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;

  return (
    <div className="space-y-3">
      <Card title={`Country macro brief — ${getCountry(code).name}`}>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Select<CountryCode | 'none'>
            label="Benchmark"
            value={benchmark}
            onChange={setBenchmark}
            options={[
              { value: 'none', label: 'No benchmark' },
              ...COUNTRIES.filter((c) => c.code !== code).map((c) => ({
                value: c.code,
                label: `vs ${c.name}`,
              })),
            ]}
          />
          <Button
            disabled={!markdown}
            onClick={() => downloadText(filename, markdown, 'text/markdown')}
          >
            <Download className="size-3.5" /> Markdown
          </Button>
          <Button
            disabled={!markdown}
            onClick={() => window.print()}
            title="Use 'Save as PDF' in the print dialog"
          >
            <Printer className="size-3.5" /> PDF
          </Button>
          <Button disabled={!markdown} onClick={() => void navigator.clipboard.writeText(markdown)}>
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
        <SourceLine>
          Shareable links need a server, so FedLens exports files instead — no backend, no accounts.
        </SourceLine>
      </Card>
      <Card>
        <pre className="font-sans text-[12px] leading-relaxed whitespace-pre-wrap">
          {markdown || 'Building brief…'}
        </pre>
      </Card>
    </div>
  );
}
