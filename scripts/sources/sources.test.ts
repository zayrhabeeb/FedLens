import { describe, expect, it } from 'vitest';
import { redact } from '../lib/http';
import { parseBeaGdp } from './bea';
import { parseBisCsv } from './bis';
import { parseBls } from './bls';
import { rebaseToUsd } from './ecb';
import { parseFredGraphCsv } from './fred';
import { monthEnd } from './treasury';
import { parseWorldBank } from './worldbank';

describe('snapshot source parsers', () => {
  it('BIS: groups by area, skips blanks, sorts by period', () => {
    const csv =
      'FREQ,REF_AREA,TITLE,TIME_PERIOD,OBS_VALUE\nM,US,"Rate, US",2025-02,4.5\nM,US,"Rate, US",2025-01,4.25\nM,JP,x,2025-01,\n';
    expect(Object.fromEntries(parseBisCsv(csv))).toEqual({
      US: [
        ['2025-01', 4.25],
        ['2025-02', 4.5],
      ],
    });
  });

  it('World Bank: drops nulls and keys by ISO3', () => {
    const body: [unknown, { countryiso3code: string; date: string; value: number | null }[]] = [
      {},
      [
        { countryiso3code: 'EMU', date: '2024', value: 0.876 },
        { countryiso3code: 'EMU', date: '2025', value: null },
      ],
    ];
    expect(parseWorldBank(body).get('EMU')).toEqual([['2024', 0.88]]);
  });

  it('ECB: rebases EUR crosses to local-per-USD and keeps EUR/USD for the euro area', () => {
    const rows = [
      { CURRENCY: 'USD', TIME_PERIOD: '2026-01', OBS_VALUE: '1.10' },
      { CURRENCY: 'JPY', TIME_PERIOD: '2026-01', OBS_VALUE: '165' },
    ];
    const fx = rebaseToUsd(rows);
    expect(fx.get('EUR')).toEqual([['2026-01', 1.1]]);
    expect(fx.get('JPY')).toEqual([['2026-01', 150]]);
  });

  it('FRED fredgraph.csv: handles missing "." values', () => {
    expect(
      parseFredGraphCsv('observation_date,GS2\n2026-01-01,4.1\n2026-02-01,.\n', 'GS2'),
    ).toEqual([['2026-01', 4.1]]);
  });

  it('BLS: keeps monthly periods only', () => {
    const body = {
      status: 'REQUEST_SUCCEEDED',
      Results: {
        series: [
          {
            seriesID: 'X',
            data: [
              { year: '2026', period: 'M02', value: '4.2' },
              { year: '2026', period: 'M13', value: '4.0' },
              { year: '2026', period: 'M01', value: '4.1' },
            ],
          },
        ],
      },
    };
    expect(parseBls(body).get('X')).toEqual([
      ['2026-01', 4.1],
      ['2026-02', 4.2],
    ]);
  });

  it('BEA: picks line 1 and normalises quarter labels', () => {
    const body = {
      BEAAPI: {
        Results: {
          Data: [
            { LineNumber: '1', TimePeriod: '2026Q2', DataValue: '2.8' },
            { LineNumber: '2', TimePeriod: '2026Q2', DataValue: '9.9' },
          ],
        },
      },
    };
    expect(parseBeaGdp(body)).toEqual([['2026-Q2', 2.8]]);
  });

  it('Treasury: keeps the last record per month in USD trillions', () => {
    expect(
      monthEnd([
        { record_date: '2026-01-02', tot_pub_debt_out_amt: '38000000000000' },
        { record_date: '2026-01-30', tot_pub_debt_out_amt: '38500000000000' },
      ]),
    ).toEqual([['2026-01', 38.5]]);
  });

  it('never logs API keys', () => {
    expect(redact('https://x?series_id=A&api_key=SECRET&UserID=K2')).toBe(
      'https://x?series_id=A&api_key=***&UserID=***',
    );
  });
});
