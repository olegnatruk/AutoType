import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

// Dependency-free PNG writer for an authored geometric T/caret mark.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function pixel(x, y) {
  const inRound = x >= 2 && x < 30 && y >= 2 && y < 30 && Math.hypot(Math.max(7 - x, 0, x - 25), Math.max(7 - y, 0, y - 25)) < 5;
  if (!inRound) return [0, 0, 0, 0];
  const mark = (x >= 8 && x <= 24 && y >= 8 && y <= 10.3)
    || (x >= 14.8 && x <= 17.2 && y >= 8 && y <= 23)
    || (x >= 11.5 && x <= 20.5 && y >= 22 && y <= 24)
    || (x >= 8 && x <= 10 && y >= 8 && y <= 13)
    || (x >= 22 && x <= 24 && y >= 8 && y <= 13);
  return mark ? [247, 245, 238, 255] : [50, 76, 65, 255];
}
await mkdir('extension/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      pixel((x + (sx + 0.5) / 4) / size * 32, (y + (sy + 0.5) / 4) / size * 32).forEach((channel, i) => { sum[i] += channel; });
    }
    sum.forEach((channel, i) => { rows[y * (size * 4 + 1) + 1 + x * 4 + i] = Math.round(channel / 16); });
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  await writeFile(`extension/icons/icon${size}.png`, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))
  ]));
}
console.log('Generated 16, 32, 48, and 128px extension icons.');
