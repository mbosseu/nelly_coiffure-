import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'C:/Users/PC/Desktop/nelly_coiffe/image et video';
const OUT = 'C:/Users/PC/Desktop/nelly_coiffe/photos_traitees/test';
const files = (await readdir(SRC)).filter((f) => f.endsWith('.jpeg')).sort();
await writeFile(path.join(OUT, 'index_planche.txt'), files.map((f, i) => `${i + 1}\t${f}`).join('\n'));

const W = 300, H = 400, COLS = 5, PER = 20;
for (let p = 0; p * PER < files.length; p++) {
  const batch = files.slice(p * PER, (p + 1) * PER);
  const rows = Math.ceil(batch.length / COLS);
  const tiles = await Promise.all(batch.map(async (f, i) => {
    const n = p * PER + i + 1;
    const img = await sharp(path.join(SRC, f)).resize(W, H, { fit: 'cover' }).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="${H}"><rect width="70" height="50" fill="black"/><text x="10" y="38" font-size="34" font-family="Arial" fill="yellow">${n}</text></svg>`);
    const tile = await sharp(img).composite([{ input: label }]).toBuffer();
    return { input: tile, left: (i % COLS) * W, top: Math.floor(i / COLS) * H };
  }));
  await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: '#222' } })
    .composite(tiles).jpeg({ quality: 85 }).toFile(path.join(OUT, `planche_${p + 1}.jpg`));
}
console.log(files.length, 'photos');
