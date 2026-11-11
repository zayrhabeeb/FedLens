/**
 * Generates the extension icons (PNG) using only Node built-ins, so the repo
 * needs no binary artwork sources.
 * Design: the FedLens mark — an asterisk with a corner bracket — in deep teal
 * on a cream rounded tile. Geometry is shared with src/ui/components/Logo.tsx.
 *
 * Usage: npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CREAM = [255, 255, 242];
const TEAL = [2, 54, 49];
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

/** Mark strokes in a 250×250 box: [x1, y1, x2, y2, width] with butt caps. */
const STROKES = [
  [109.5, 35, 109.5, 247, 23], // vertical
  [0, 141, 219, 141, 26], // horizontal
  [34.5, 66, 185.5, 216, 24], // diagonal ↘
  [28, 219, 109.5, 141, 24], // half diagonal ↙ (upper half replaced by the bracket)
  [133, 15.5, 250, 15.5, 25], // bracket top
  [237.5, 3, 237.5, 113, 25], // bracket side
];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** True if (x, y) lies on a thick segment with butt (square-cut) ends. */
function onStroke(x, y, [x1, y1, x2, y2, w]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  if (t < 0 || t > 1) return false;
  const px = x1 + t * dx - x;
  const py = y1 + t * dy - y;
  return px * px + py * py <= (w / 2) ** 2;
}

/** Colour at unit coordinates (0..1), or null for transparent. */
function shade(x, y, size) {
  const r = 0.2; // tile corner radius
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  if (dx * dx + dy * dy > r * r) return null;
  // Small icons get less padding and bolder strokes so the mark stays legible.
  const pad = size <= 32 ? 0.12 : 0.18;
  const boost = size <= 16 ? 1.5 : size <= 32 ? 1.2 : 1;
  const mx = ((x - pad) / (1 - 2 * pad)) * 250;
  const my = ((y - pad) / (1 - 2 * pad)) * 250;
  return STROKES.some(([x1, y1, x2, y2, w]) => onStroke(mx, my, [x1, y1, x2, y2, w * boost]))
    ? TEAL
    : CREAM;
}

function render(size) {
  const out = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = shade((px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size, size);
          if (!c) continue;
          rSum += c[0];
          gSum += c[1];
          bSum += c[2];
          aSum += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (aSum > 0) {
        out[i] = Math.round(rSum / aSum);
        out[i + 1] = Math.round(gSum / aSum);
        out[i + 2] = Math.round(bSum / aSum);
      }
      out[i + 3] = Math.round((aSum / (n * n)) * 255);
    }
  }
  return out;
}

mkdirSync('public/icons', { recursive: true });
for (const size of SIZES) {
  writeFileSync(`public/icons/icon-${size}.png`, encodePng(size, render(size)));
  console.log(`public/icons/icon-${size}.png`);
}
