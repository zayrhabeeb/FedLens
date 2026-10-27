import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Confidence, Sentiment, SourceTier, Stance } from '../../shared/types';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-3 ${className}`}>
      {(title || action) && (
        <header className="mb-2 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = 'neutral' | 'accent' | 'up' | 'flat' | 'down' | 'shock';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  up: 'bg-up/10 text-up',
  flat: 'bg-flat/10 text-flat',
  down: 'bg-down/10 text-down',
  shock: 'bg-shock/10 text-shock',
};

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

const CONFIDENCE_TONE: Record<Confidence, Tone> = { HIGH: 'up', MODERATE: 'flat', LOW: 'neutral' };
export const ConfidenceBadge = ({ value }: { value: Confidence }) => (
  <Badge
    tone={CONFIDENCE_TONE[value]}
    title="Confidence is categorical and based on extraction quality, not model certainty."
  >
    {value}
  </Badge>
);

const STANCE_TONE: Record<Stance, Tone> = { hawkish: 'down', neutral: 'neutral', dovish: 'up' };
export const StanceBadge = ({ value }: { value: Stance }) => (
  <Badge tone={STANCE_TONE[value]}>{value}</Badge>
);

export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: 'bg-up',
  dovish: 'bg-up',
  neutral: 'bg-muted',
  negative: 'bg-down',
  hawkish: 'bg-flat',
  shock: 'bg-shock',
};

export const SentimentDot = ({ value }: { value: Sentiment }) => (
  <span
    title={`Sentiment: ${value}`}
    className={`inline-block size-2 shrink-0 rounded-full ${SENTIMENT_COLOR[value]}`}
  />
);

const TIER_TONE: Record<SourceTier, Tone> = {
  TIER_1: 'up',
  TIER_2: 'neutral',
  TIER_3: 'flat',
  TIER_4: 'down',
};
const TIER_HELP: Record<SourceTier, string> = {
  TIER_1: 'Tier 1: full weight in scoring',
  TIER_2: 'Tier 2: 80% weight',
  TIER_3: 'Tier 3: 50% weight',
  TIER_4: 'Tier 4: unknown source — excluded from scoring',
};
export const TierBadge = ({ value }: { value: SourceTier }) => (
  <Badge tone={TIER_TONE[value]} title={TIER_HELP[value]}>
    T{value.slice(-1)}
  </Badge>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2 py-1 text-[12px] ${o.value === value ? 'bg-ink text-surface' : 'bg-surface-2 text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  title?: string;
}) {
  const style =
    variant === 'primary'
      ? 'bg-ink text-surface hover:opacity-90'
      : 'border border-line bg-surface text-ink hover:bg-surface-2';
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center gap-2 p-4 text-muted">
    <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-3 text-center text-[12px] text-muted">{children}</p>
);

export const Note = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-1.5 rounded-md bg-flat/10 p-2 text-[12px] text-flat">
    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
    <span>{children}</span>
  </p>
);

export const SourceLine = ({ children }: { children: ReactNode }) => (
  <p className="mt-2 text-[10.5px] text-muted">{children}</p>
);
