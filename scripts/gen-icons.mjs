/** 產生 PWA 圖示（純 Node + zlib，無外部依賴）。執行：node scripts/gen-icons.mjs */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(path, size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const scale = (maskable ? 0.74 : 0.88) * size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c;
      const r = Math.hypot(dx, dy) / scale;
      const a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      let col = [4, 19, 35, 255];
      if (r < 1.0) {
        const glow = Math.max(0, 1 - r);
        col = [4 + 8 * glow, 19 + 30 * glow, 35 + 42 * glow, 255];
      }
      const ring = (rr, w) => Math.abs(r - rr) < w;
      const spoke = r > 0.42 && r < 0.92 && (Math.abs(((a + 22.5) % 45) - 22.5) < 1.2);
      if (r <= 0.98 && ring(0.95, 0.012)) col = [114, 213, 255, 255];
      if (r <= 0.98 && ring(0.72, 0.009)) col = [114, 213, 255, 210];
      if (r <= 0.98 && ring(0.40, 0.01)) col = [114, 213, 255, 190];
      if (spoke) col = [114, 213, 255, 170];
      if (r <= 0.98 && a < 20 && r > 0.42 && r < 0.95) col = [54, 235, 192, 235];
      if (r < 0.13) col = [217, 243, 255, 245];
      if (r < 0.055) col = [4, 19, 35, 255];
      const i = (y * size + x) * 4;
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = col[3];
    }
  }
  return buf;
}

writePNG(join(OUT, 'icon-192.png'), 192, render(192, false));
writePNG(join(OUT, 'icon-512.png'), 512, render(512, false));
writePNG(join(OUT, 'icon-maskable-512.png'), 512, render(512, true));
console.log('icons generated');
