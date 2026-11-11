/**
 * The FedLens mark: an asterisk with a corner bracket. Same geometry as the
 * PNG icons (scripts/generate-icons.mjs), drawn in a 250×250 box.
 */
const STROKES: [number, number, number, number, number][] = [
  [109.5, 35, 109.5, 247, 23],
  [0, 141, 219, 141, 26],
  [34.5, 66, 185.5, 216, 24],
  [28, 219, 109.5, 141, 24],
  [133, 15.5, 250, 15.5, 25],
  [237.5, 3, 237.5, 113, 25],
];

export function LogoMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 250" className={className} aria-hidden fill="none" stroke="currentColor">
      {STROKES.map(([x1, y1, x2, y2, w]) => (
        <line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          strokeWidth={w}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}
