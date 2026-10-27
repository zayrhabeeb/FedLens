export function formatValue(value: number | undefined, digits = 2): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const maximumFractionDigits = abs >= 1000 ? 0 : abs >= 100 ? 1 : digits;
  return value.toLocaleString('en-US', { maximumFractionDigits, minimumFractionDigits: 0 });
}

export function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function relativeTime(iso: string | number, now = Date.now()): string {
  const ms = now - (typeof iso === 'number' ? iso : Date.parse(iso));
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180 CSV serialisation. */
export function toCsv(rows: readonly (readonly (string | number | undefined)[])[]): string {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
