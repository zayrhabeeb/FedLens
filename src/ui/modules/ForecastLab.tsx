/** Module 5 — Policy Forecast Lab with backtest (PRD §8). */
import { useEffect, useMemo, useState } from 'react';
import { runBacktest } from '../../forecast/backtest';
import { getCountry } from '../../shared/countries';
import { synthesize, type SynthesisResult } from '../../synthesis';
import { forecastRequest } from '../../synthesis/drafts';
import { CalibrationChart, ProbabilityBar } from '../components/charts';
import { Card, ConfidenceBadge, Empty, Note, SourceLine } from '../components/primitives';
import { useAppData } from '../state/AppData';
import { useCountryView } from '../state/derived';

export default function ForecastLab() {
  const { snapshot, settings } = useAppData();
  const code = settings.country;
  const country = getCountry(code);
  const view = useCountryView(code);
  const [explanation, setExplanation] = useState<SynthesisResult>();
  const report = useMemo(() => (snapshot ? runBacktest(snapshot, code) : null), [snapshot, code]);

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    void synthesize(forecastRequest(code, view.forecast), settings).then(
      (r) => !cancelled && setExplanation(r),
    );
    return () => {
      cancelled = true;
    };
  }, [view, code, settings]);

  if (!view) return null;
  const f = view.forecast;

  return (
    <div className="space-y-3">
      <Card title={`Policy tightening probability — ${country.name}`}>
        <ProbabilityBar tighten={f.pTighten} ease={f.pEase} />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="font-semibold">{f.direction}</span>
          <ConfidenceBadge value={f.confidence} />
          <span className="text-muted">
            Raw score {f.raw > 0 ? '+' : ''}
            {f.raw} / ±100
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed">{explanation?.text ?? '…'}</p>
        <SourceLine>
          Horizon ≈ next 3 months (1–3 {country.centralBankShort} meetings). Calibration:{' '}
          {f.calibration.fittedOn}.
        </SourceLine>
      </Card>

      <Card title="Input breakdown">
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] text-muted">
            <tr>
              <th className="font-medium">Input</th>
              <th className="text-right font-medium">Weight</th>
              <th className="text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {f.inputs.map((i) => (
              <tr key={i.key} className={`border-t border-line ${i.available ? '' : 'text-muted'}`}>
                <td className="py-1">
                  {i.label}
                  <div className="text-[11px] text-muted">{i.detail}</div>
                </td>
                <td className="text-right tabular-nums">{i.weight}%</td>
                <td
                  className={`text-right tabular-nums ${i.points > 0 ? 'text-down' : i.points < 0 ? 'text-up' : ''}`}
                >
                  {i.available ? `${i.points > 0 ? '+' : ''}${i.points}` : 'n/a'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <SourceLine>
          Unavailable inputs are dropped and the remaining weights rescaled. Positive points push
          toward tightening.
        </SourceLine>
      </Card>

      <Card title="Backtest (out-of-sample)">
        {!report ? (
          <Empty>Not enough monthly history for {country.name} to backtest.</Empty>
        ) : (
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-surface-2 p-2">
                <div className="text-[18px] font-semibold tabular-nums">
                  {Math.round(report.accuracy * 100)}%
                </div>
                <div className="text-[11px] text-muted">directional accuracy</div>
              </div>
              <div className="rounded-md bg-surface-2 p-2">
                <div className="text-[18px] font-semibold tabular-nums">
                  {Math.round(report.baselineAccuracy * 100)}%
                </div>
                <div className="text-[11px] text-muted">naive baseline</div>
              </div>
              <div className="rounded-md bg-surface-2 p-2">
                <div className="text-[18px] font-semibold tabular-nums">
                  {report.brierTighten.toFixed(3)}
                </div>
                <div className="text-[11px] text-muted">Brier (tighten)</div>
              </div>
            </div>
            {report.accuracy <= report.baselineAccuracy && (
              <Note>
                For {country.name} the model does not beat always predicting the most common
                outcome. Treat this forecast with extra caution.
              </Note>
            )}
            <div className="flex flex-wrap items-start gap-4">
              <CalibrationChart bins={report.calibrationBins} />
              <table className="text-[11.5px]">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="pr-3 font-medium">Confidence</th>
                    <th className="pr-3 font-medium">n</th>
                    <th className="font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {(['HIGH', 'MODERATE', 'LOW'] as const).map((t) => (
                    <tr key={t}>
                      <td className="pr-3">{t}</td>
                      <td className="pr-3 tabular-nums">{report.byConfidence[t].n}</td>
                      <td className="tabular-nums">
                        {report.byConfidence[t].n
                          ? `${Math.round(report.byConfidence[t].accuracy * 100)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SourceLine>
              {report.testSamples} monthly windows since {report.testStart}; calibration fitted on
              the pooled 12-economy panel before {report.testStart} (no look-ahead). Only
              indicator-based inputs (inflation gap, CPI trend, rate history
              {code === 'US' ? ', 2y yield' : ''}) exist historically — document tone and news
              sentiment are not backtested.
            </SourceLine>
          </div>
        )}
      </Card>
    </div>
  );
}
