/**
 * Small dependency-free SVG charts. Kept deliberately simple: the data is
 * small, and hand-rolled SVG avoids shipping a charting library.
 */
import type { CalibrationBin } from '../../forecast/backtest';

export function Sparkline({
  values,
  width = 96,
  height = 24,
  className = 'text-accent',
  label,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
  label: string;
}) {
  if (values.length < 2)
    return (
      <svg width={width} height={height} aria-label={`${label}: not enough data`} role="img" />
    );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map(
    (v, i) =>
      `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 1 - ((v - min) / span) * (height - 2)).toFixed(1)}`,
  );
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface LineSeries {
  label: string;
  color: string;
  values: readonly (number | undefined)[];
}

/** Multi-series line chart over a shared x-axis of labels. */
export function LineChart({
  labels,
  series,
  height = 140,
  unit = '',
}: {
  labels: readonly string[];
  series: readonly LineSeries[];
  height?: number;
  unit?: string;
}) {
  const width = 320;
  const pad = { l: 30, r: 6, t: 6, b: 18 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== undefined));
  if (all.length === 0 || labels.length < 2)
    return <p className="text-[12px] text-muted">No data for this window.</p>;
  const min = Math.min(...all, 0);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / (labels.length - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={series.map((s) => s.label).join(', ')}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth={0.5}
            />
            <text x={pad.l - 3} y={y(t) + 3} textAnchor="end" fontSize={8} fill="var(--muted)">
              {t.toFixed(span < 3 ? 1 : 0)}
              {unit}
            </text>
          </g>
        ))}
        {[0, labels.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 5}
            textAnchor={i === 0 ? 'start' : 'end'}
            fontSize={8}
            fill="var(--muted)"
          >
            {labels[i]}
          </text>
        ))}
        {series.map((s) => {
          const d = s.values
            .map((v, i) => (v === undefined ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
            .reduce<string[]>(
              (acc, p, i, arr) =>
                p === null ? acc : [...acc, `${arr[i - 1] == null ? 'M' : 'L'}${p}`],
              [],
            )
            .join(' ');
          return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={1.5} />;
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Horizontal bars, values normalised to the max (or to `scaleMax`). */
export function BarList({
  items,
  scaleMax,
  format = (v) => String(v),
}: {
  items: readonly { label: string; value: number; color?: string; hint?: string }[];
  scaleMax?: number;
  format?: (v: number) => string;
}) {
  const max = scaleMax ?? Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} title={item.hint}>
          <div className="flex justify-between text-[11.5px]">
            <span>{item.label}</span>
            <span className="text-muted tabular-nums">{format(item.value)}</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded bg-surface-2">
            <div
              className="h-1.5 rounded"
              style={{
                width: `${Math.min(100, (Math.abs(item.value) / max) * 100)}%`,
                background: item.color ?? 'var(--accent)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Reliability diagram: predicted vs observed frequency with the ideal diagonal. */
export function CalibrationChart({ bins }: { bins: readonly CalibrationBin[] }) {
  const s = 150;
  const p = 20;
  const pos = (v: number) => p + v * (s - 2 * p);
  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      className="w-40"
      role="img"
      aria-label="Calibration curve: predicted versus observed tightening frequency"
    >
      <rect x={p} y={p} width={s - 2 * p} height={s - 2 * p} fill="none" stroke="var(--line)" />
      <line
        x1={pos(0)}
        y1={s - pos(0)}
        x2={pos(1)}
        y2={s - pos(1)}
        stroke="var(--muted)"
        strokeDasharray="3 3"
        strokeWidth={0.75}
      />
      {bins.map((b) => (
        <circle
          key={b.from}
          cx={pos(b.predicted)}
          cy={s - pos(b.observed)}
          r={Math.min(6, 2 + Math.sqrt(b.n) / 3)}
          fill="var(--accent)"
          fillOpacity={0.8}
        >
          <title>{`Predicted ${(b.predicted * 100).toFixed(0)}% → observed ${(b.observed * 100).toFixed(0)}% (n=${b.n})`}</title>
        </circle>
      ))}
      <text x={s / 2} y={s - 4} textAnchor="middle" fontSize={8} fill="var(--muted)">
        predicted
      </text>
      <text
        x={7}
        y={s / 2}
        textAnchor="middle"
        fontSize={8}
        fill="var(--muted)"
        transform={`rotate(-90 7 ${s / 2})`}
      >
        observed
      </text>
    </svg>
  );
}

export function ProbabilityBar({ tighten, ease }: { tighten: number; ease: number }) {
  const hold = Math.max(0, 1 - tighten - ease);
  const seg = (v: number, color: string, label: string) =>
    v > 0 ? (
      <div
        style={{ width: `${v * 100}%`, background: color }}
        className="flex h-5 items-center justify-center overflow-hidden text-[10.5px] font-medium text-white"
        title={`${label}: ${(v * 100).toFixed(0)}%`}
      >
        {v >= 0.12 ? `${label} ${(v * 100).toFixed(0)}%` : ''}
      </div>
    ) : null;
  return (
    <div
      className="flex overflow-hidden rounded"
      role="img"
      aria-label={`Tighten ${(tighten * 100).toFixed(0)}%, hold ${(hold * 100).toFixed(0)}%, ease ${(ease * 100).toFixed(0)}%`}
    >
      {seg(tighten, 'var(--down)', 'Tighten')}
      {seg(hold, 'var(--muted)', 'Hold')}
      {seg(ease, 'var(--up)', 'Ease')}
    </div>
  );
}
