/**
 * Draws the app icons (the Chrome.jsx logo polygon, gold on the dark theme
 * background) as PNGs with no dependencies: a tiny rasteriser plus zlib.
 * Run by hand when the logo changes: node scripts/make-icons.mjs
 * The output in public/ is committed, so builds do not need this.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [0x0a, 0x0a, 0x08];
const GOLD = [0xff, 0xc2, 0x0e];
// Absolute points of the 16x16 logo path in Chrome.jsx.
const POLY = [[2,1],[5,4],[11,4],[14,1],[14,8],[12,10],[13,15],[9,13],[7,13],[3,15],[4,10],[2,8]];

function inside(x, y) {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** `fill` is the share of the icon the 16-unit logo box covers. */
function png(size, fill) {
  const scale = (size * fill) / 16, off = (size - size * fill) / 2, SS = 3;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        if (inside((x + (sx + 0.5) / SS - off) / scale, (y + (sy + 0.5) / SS - off) / scale)) hit++;
      }
      const t = hit / (SS * SS);
      for (let k = 0; k < 3; k++) raw[y * (size * 3 + 1) + 1 + x * 3 + k] = Math.round(BG[k] + (GOLD[k] - BG[k]) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(out, { recursive: true });
// Maskable icons are cropped by the OS to a circle or squircle, so the logo
// stays inside the central 60% safe zone.
for (const [name, size, fill] of [['icon-192.png', 192, 0.7], ['icon-512.png', 512, 0.7], ['icon-maskable-512.png', 512, 0.55]]) {
  fs.writeFileSync(path.join(out, name), png(size, fill));
  console.log('wrote', name);
}
