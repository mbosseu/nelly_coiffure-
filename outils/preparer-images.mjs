import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'C:/Users/PC/Desktop/nelly_coiffe';
const SRC = `${ROOT}/image et video`;
const IMG = `${ROOT}/site/img`;
const index = Object.fromEntries(
  (await readFile(`${ROOT}/photos_traitees/test/index_planche.txt`, 'utf8'))
    .trim().split('\n').map((l) => l.split('\t')).map(([n, f]) => [n, f.trim()])
);

for (const d of ['', '/realisations', '/provisoire', '/marque']) await mkdir(IMG + d, { recursive: true });

const warm = (s) => s.modulate({ brightness: 1.03, saturation: 1.06 }).linear([1.03, 1.0, 0.96], [0, 0, 0]);

async function photo(num, out, { crop, trimTop = 0, widths = [600, 1200], ratio = 3 / 4 } = {}) {
  let s = sharp(path.join(SRC, index[num])).rotate();
  if (trimTop) {
    const { width, height } = await sharp(path.join(SRC, index[num])).rotate().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const top = Math.round(height * trimTop);
    s = sharp(await s.extract({ left: 0, top, width, height: height - top }).toBuffer());
  }
  if (crop) s = s.extract(crop);
  const base = await warm(s).toBuffer();
  for (const w of widths) {
    await sharp(base)
      .resize({ width: w, height: Math.round(w / ratio), fit: 'cover', position: 'attention' })
      .webp({ quality: 78 })
      .toFile(`${out}-${w}.webp`);
  }
}

// Vraies réalisations de Nelly (même cliente, deux angles)
await photo('22', `${IMG}/realisations/tresses-collees-rouges-1`, { crop: { left: 380, top: 430, width: 975, height: 1300 } });
await photo('30', `${IMG}/realisations/tresses-collees-rouges-2`);

// Images provisoires : à remplacer avant mise en ligne
const provisoires = {
  12: 'hero', 28: 'apropos',
  20: 'knotless', 35: 'box-braids', 5: 'fulani', 23: 'nattes-collees', 19: 'boho', 33: 'enfants',
  1: 'galerie-01', 11: 'galerie-02', 21: 'galerie-03', 26: 'galerie-04', 29: 'galerie-05',
  34: 'galerie-06', 36: 'galerie-07', 37: 'galerie-08', 4: 'galerie-09', 31: 'galerie-10',
};
for (const [num, name] of Object.entries(provisoires)) {
  // Rogne le haut des captures pour retirer les icônes d'applis (croix, flèches, menus)
  const opts = name === 'hero' ? { widths: [800, 1400], ratio: 4 / 5 } : { trimTop: 0.08 };
  await photo(num, `${IMG}/provisoire/${name}`, opts);
}

// Logo : recadrage + détourage du fond crème
const logoSrc = `${ROOT}/logo/Logo luxueux Nelly Coiffure métallisé.png`;
const logoCrop = await sharp(logoSrc).extract({ left: 180, top: 80, width: 1240, height: 780 }).png().toBuffer();
const cut = await removeBackground(new Blob([logoCrop], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
const logoPng = Buffer.from(await cut.arrayBuffer());
await sharp(logoPng).trim().resize({ width: 480 }).webp({ quality: 90 }).toFile(`${IMG}/marque/logo.webp`);
await sharp(logoPng).trim().resize({ width: 480 }).png({ compressionLevel: 9 }).toFile(`${IMG}/marque/logo.png`);

// Favicon et image de partage
const n = await sharp(logoPng).extract({ left: 40, top: 20, width: 560, height: 640 }).trim().toBuffer();
await sharp(n).resize(512, 512, { fit: 'contain', background: { r: 246, g: 238, b: 228, alpha: 1 } }).png().toFile(`${IMG}/marque/favicon-512.png`);
await sharp(n).resize(180, 180, { fit: 'contain', background: { r: 246, g: 238, b: 228, alpha: 1 } }).png().toFile(`${IMG}/marque/apple-touch-icon.png`);
await sharp(n).resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${IMG}/marque/favicon-32.png`);
await sharp(logoSrc).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(`${IMG}/marque/partage.jpg`);

console.log('images prêtes');
