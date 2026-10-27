/**
 * Generates the extension icons (PNG) using only Node built-ins, so the repo
 * contains no third-party or licensed artwork.
 * Design: navy tile, gold lens ring with a handle, gold corner brackets.
 *
 * Usage: npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [21, 34, 50];
const GOLD = [201, 162, 39];
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
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

/** Colour of a point in unit coordinates (0..1), or null for transparent. */
function shade(x, y, size) {
  const r = 0.18; // tile corner radius
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  if (dx * dx + dy * dy > r * r) return null;

  const stroke = Math.max(0.07, 1.6 / size);
  // Lens ring
  const cx = 0.45;
  const cy = 0.45;
  const d = Math.hypot(x - cx, y - cy);
  if (Math.abs(d - 0.22) < stroke / 2) return GOLD;
  // Handle (diagonal bar from ring edge to lower right)
  const t = (x - cx + (y - cy)) / 2;
  const off = Math.abs(x - cx - (y - cy)) / Math.SQRT2;
  if (t > 0.17 && t < 0.31 && off < stroke * 0.7) return GOLD;
  // Corner brackets (omitted at 16px where they would be noise)
  if (size >= 32) {
    const m = 0.12;
    const len = 0.16;
    const near = (v, edge) => Math.abs(v - edge) < stroke / 2;
    for (const [ex, ey] of [
      [m, m],
      [1 - m, m],
      [m, 1 - m],
      [1 - m, 1 - m],
    ]) {
      const sx = ex < 0.5 ? 1 : -1;
      const sy = ey < 0.5 ? 1 : -1;
      const alongX = (x - ex) * sx >= 0 && (x - ex) * sx <= len;
      const alongY = (y - ey) * sy >= 0 && (y - ey) * sy <= len;
      if ((near(y, ey) && alongX) || (near(x, ex) && alongY)) return GOLD;
    }
  }
  return NAVY;
}

function render(size) {
  const out = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;
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
