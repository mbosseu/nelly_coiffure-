import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import path from 'node:path';
// Planche contact des photos réelles (une vignette par photo, avec dossier et numéro)
const R = '../coiffure';
const items = [];
for (const d of readdirSync(R).sort()) for (const f of readdirSync(path.join(R, d)).sort()) if (/\.(jpe?g|png)$/i.test(f)) items.push({ d, f });
const T = 230, cols = 6, rows = Math.ceil(items.length / cols);
const tiles = await Promise.all(items.map(async ({ d, f }, i) => {
  const img = await sharp(path.join(R, d, f)).resize(T, T, { fit: 'cover', position: 'attention' }).toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity=".7"/><text x="6" y="14" font-size="12" fill="#fff" font-family="Arial">${i + 1}. ${d.replace(/&/g, '')}</text><text x="6" y="28" font-size="10" fill="#ccc" font-family="Arial">${f.slice(0, 34).replace(/&/g, '')}</text></svg>`);
  return { input: await sharp(img).composite([{ input: label, top: T - 34, left: 0 }]).toBuffer(), left: (i % cols) * (T + 6), top: Math.floor(i / cols) * (T + 6) };
}));
await sharp({ create: { width: cols * (T + 6), height: rows * (T + 6), channels: 3, background: '#fff' } }).composite(tiles).jpeg({ quality: 80 }).toFile('captures/planche-reelles.jpg');
console.log(items.length);
