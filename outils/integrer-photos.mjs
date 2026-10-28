import sharp from 'sharp';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Prépare les photos de Nelly utilisées dans le design (accueil, en-têtes, coiffures, trouveur)
// à partir du dossier coiffure/. Sorties : site/img/nelly/<nom>.webp (+ <nom>-sm.webp pour les grandes).
// Usage : node outils/integrer-photos.mjs

const ROOT = path.resolve(import.meta.dirname, '..');
const C = (dir, f) => path.join(ROOT, 'coiffure', dir, `WhatsApp Image 2026-10-28 at ${f}.jpeg`);
const OUT = path.join(ROOT, 'site/img/nelly');

const SRC = {
  A: C('knotless braids 60euro', '18.59.19 (1)'),
  B: C('knotless braids 60euro', '18.59.19 (2)'),
  C: C('knotless braids 60euro', '18.59.19 (3)'),
  D: C('knotless braids 60euro', '18.59.19 (5)'),
  E: C('knotless braids 60euro', '18.59.20'),
  F: C('lock_80euro', '19.11.05 (1)'),
  H: C('lock_80euro', '19.11.07 (2)'),
  J: C('natte_colle_30euro', '19.20.54 (3)'),
  K: C('short_braids_50euro', '22.13.01'),
  L: C('tresse_coucher_50euro', '21.53.54 (1)'),
};

// [nom, photo, largeur, hauteur, position du recadrage, variante réduite]
const SORTIES = [
  ['hero', 'J', 1100, 1360, 'attention', true],
  ['card-knotless', 'A', 650, 660, 'north'],
  ['card-couchees', 'L', 650, 660, 'north'],
  ['card-nattes', 'J', 650, 660, 'attention'],
  ['univers', 'A', 1120, 860, 'centre', true],
  ['mosaic-1', 'H', 520, 700, 'north'],
  ['mosaic-2', 'C', 520, 300, 'centre'],
  ['mosaic-3', 'E', 440, 500, 'north'],
  ['mosaic-4', 'D', 440, 360, 'centre'],
  ['mosaic-5', 'F', 620, 310, 'north'],
  ['mosaic-6', 'K', 620, 560, 'north'],
  ['arch-coiffures', 'A', 800, 1000, 'north'],
  ['arch-tarifs', 'L', 800, 1000, 'north'],
  ['arch-realisations', 'H', 736, 920, 'north'],
  ['style-knotless', 'E', 700, 756, 'north'],
  ['style-couchees', 'L', 700, 756, 'north'],
  ['style-nattes', 'J', 700, 756, 'attention'],
  ['finder-locks', 'H', 340, 420, 'north'],
  ['finder-short', 'K', 340, 420, 'north'],
];

// Étalonnage commun : chaud et doux, cohérent avec la palette crème et cuivre ; légère netteté
const etalonner = (img) => img.rotate().modulate({ saturation: 0.95, brightness: 1.02 }).linear([1.03, 1, 0.95], [2, 0, -3]).sharpen({ sigma: 0.6 });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [nom, k, w, h, position, petite] of SORTIES) {
  const base = sharp(SRC[k]).resize(w, h, { fit: 'cover', position });
  await etalonner(base.clone()).webp({ quality: 80 }).toFile(path.join(OUT, `${nom}.webp`));
  if (petite) await etalonner(sharp(SRC[k]).resize(Math.round(w / 2), Math.round(h / 2), { fit: 'cover', position })).webp({ quality: 78 }).toFile(path.join(OUT, `${nom}-sm.webp`));
}
console.log(`${SORTIES.length} visuels préparés dans site/img/nelly/`);
