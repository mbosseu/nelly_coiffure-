import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = 'C:/Users/PC/Desktop/nelly_coiffe';
const MQ = `${ROOT}/maquete/${readdirSync(`${ROOT}/maquete`)[0]}`;
const TMP = `${ROOT}/outils/tmp-maquette`;
const UP = `${TMP}/x4`;
const OUT = `${ROOT}/site/img/maquette`;
const ESRGAN = `${ROOT}/outils/realesrgan/realesrgan-ncnn-vulkan.exe`;
rmSync(TMP, { recursive: true, force: true });
for (const d of [TMP, UP, OUT]) mkdirSync(d, { recursive: true });

// Zones en pixels de la maquette (773 px de large). erase = zones de texte incrusté à effacer.
const crops = {
  // Recadré pour exclure l'arc et la bande cuivrés (redessinés en SVG animé)
  hero: { left: 372, top: 58, width: 312, height: 384, erase: [{ left: 652, top: 118, width: 32, height: 130 }] },
  'coiffure-knotless': { left: 45, top: 637, width: 162, height: 163 },
  'coiffure-box': { left: 222, top: 637, width: 161, height: 163 },
  'coiffure-fulani': { left: 401, top: 637, width: 161, height: 163 },
  'coiffure-cornrows': { left: 579, top: 637, width: 151, height: 163 },
  univers: { left: 392, top: 868, width: 381, height: 292, erase: [{ left: 662, top: 878, width: 108, height: 156 }] },
  'real-a': { left: 318, top: 1181, width: 128, height: 172 },
  'real-b': { left: 455, top: 1181, width: 110, height: 125 },
  'real-c': { left: 574, top: 1181, width: 155, height: 77 },
  'real-d': { left: 455, top: 1315, width: 110, height: 89 },
  'real-e': { left: 574, top: 1268, width: 155, height: 138 },
  'real-f': { left: 318, top: 1363, width: 128, height: 42 },
  espace: { left: 0, top: 1445, width: 310, height: 217, erase: [{ left: 208, top: 1474, width: 102, height: 122 }] },
  'cta-tresses': { left: 368, top: 1684, width: 196, height: 182 },
};

for (const [name, { erase = [], ...box }] of Object.entries(crops)) {
  let img = sharp(MQ).extract(box);
  if (erase.length) {
    const base = await img.png().toBuffer();
    const layers = [];
    for (const e of erase) {
      const rel = { left: e.left - box.left, top: e.top - box.top, width: e.width, height: e.height };
      // Comble la zone avec une version très floutée de son voisinage, puis fond les bords
      const pad = 18;
      const ctx = {
        left: Math.max(0, rel.left - pad), top: Math.max(0, rel.top - pad),
      };
      ctx.width = Math.min(box.width - ctx.left, rel.width + pad * 2);
      ctx.height = Math.min(box.height - ctx.top, rel.height + pad * 2);
      const patch = await sharp(base).extract(ctx).median(15).blur(14).toBuffer();
      const r = { x: rel.left - ctx.left - 4, y: rel.top - ctx.top - 4, w: rel.width + 8, h: rel.height + 8 };
      const mask = Buffer.from(`<svg width="${ctx.width}" height="${ctx.height}"><defs><filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#fff" filter="url(#f)"/></svg>`);
      const feathered = await sharp(patch).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      layers.push({ input: feathered, left: ctx.left, top: ctx.top });
    }
    img = sharp(await sharp(base).composite(layers).png().toBuffer());
  }
  await img.png().toFile(`${TMP}/${name}.png`);
}

execFileSync(ESRGAN, ['-i', TMP, '-o', UP, '-n', 'realesrgan-x4plus', '-f', 'png'], { stdio: 'ignore' });

for (const name of Object.keys(crops)) {
  const src = `${UP}/${name}.png`;
  const { width } = await sharp(src).metadata();
  await sharp(src).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
  if (width > 900) await sharp(src).resize({ width: Math.round(width / 2) }).webp({ quality: 80 }).toFile(`${OUT}/${name}-sm.webp`);
}
console.log('ok');
