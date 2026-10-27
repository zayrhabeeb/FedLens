import { useMemo } from 'react';
import { latestFor } from '../../data/documents';
import { policyRiskScore, type RiskScore } from '../../analytics/risk';
import { liveSignals } from '../../forecast/inputs';
import { forecast, type ForecastResult } from '../../forecast/model';
import type { DocumentAnalysis } from '../../nlp/document';
import type { CountryCode } from '../../shared/types';
import { useAppData } from './AppData';

export interface CountryView {
  forecast: ForecastResult;
  risk: RiskScore;
  document?: DocumentAnalysis;
}

/** Forecast, risk score and latest document for several economies at once. */
export function useCountryViews(
  codes: readonly CountryCode[],
): Partial<Record<CountryCode, CountryView>> {
  const { snapshot, articles, events, documents, calibration } = useAppData();
  const key = codes.join(',');
  return useMemo(() => {
    if (!snapshot) return {};
    const out: Partial<Record<CountryCode, CountryView>> = {};
    for (const code of key.split(',') as CountryCode[]) {
      const document = latestFor(documents, code);
      out[code] = {
        forecast: forecast(liveSignals(code, snapshot, articles, document), calibration),
        risk: policyRiskScore(code, snapshot, articles, events, document),
        ...(document ? { document } : {}),
      };
    }
    return out;
  }, [key, snapshot, articles, events, documents, calibration]);
}

export function useCountryView(code: CountryCode): CountryView | undefined {
  return useCountryViews([code])[code];
}
