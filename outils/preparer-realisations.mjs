import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

// Prépare les photos de réalisations de Nelly pour le site.
// 1. Ranger les photos dans coiffure/<nom de la coiffure>_<prix>euro/ (ex. coiffure/lock_80euro/photo.jpg)
// 2. Lister dans coiffure/VALIDEES.txt les photos réellement réalisées par Nelly (une par ligne, ex. lock_80euro/photo.jpg)
// 3. node outils/preparer-realisations.mjs, puis node outils/construire-pages.mjs
// Seules les photos listées dans VALIDEES.txt sont traitées et publiées.

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'coiffure');
const OUT = path.join(ROOT, 'site/img/realisations');
const DATA = path.join(ROOT, 'outils/realisations.json');
const VALID = path.join(SRC, 'VALIDEES.txt');

// Noms affichés : les dossiers donnent le style et le prix
const NOMS = {
  lock: 'Locks', lock_court: 'Locks courtes', natte_colle: 'Nattes collées', short_braids: 'Short braids',
  tissage: 'Tissage', tresse_coucher: 'Tresses couchées', tresse_coucher_enfant: 'Tresses couchées enfant',
  tresse_homme_coller: 'Tresses collées homme', twist_homme: 'Twists homme', twists: 'Twists', knotless_braids: 'Knotless braids',
};
// Nom de dossier : <style>_<prix>euro, avec un complément facultatif après le prix (ex. tresse coucher_30euro_enfant)
const parse = (dir) => {
  const m = dir.match(/^(.*?)[ _]*(\d+)\s*euros?(?:[ _]+(.+))?$/i);
  const key = (m ? `${m[1]}${m[3] ? `_${m[3]}` : ''}` : dir).trim().toLowerCase().replace(/\s+/g, '_');
  const nom = NOMS[key] || key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return { key, nom, prix: m ? Number(m[2]) : null };
};
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const validees = existsSync(VALID)
  ? readFileSync(VALID, 'utf8').split(/\r?\n/).map((l) => l.trim().replace(/\\/g, '/')).filter((l) => l && !l.startsWith('#'))
  : [];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Étalonnage commun : chaud, doux, cohérent avec la palette crème et cuivre du site
const etalonner = (img) => img.rotate().modulate({ saturation: 0.94, brightness: 1.02 }).linear([1.03, 1, 0.95], [2, 0, -3]);

const items = [];
const compteur = {};
for (const rel of validees) {
  const file = path.join(SRC, rel);
  if (!existsSync(file)) { console.warn('introuvable :', rel); continue; }
  const style = parse(path.dirname(rel).split('/').pop());
  const n = (compteur[style.key] = (compteur[style.key] || 0) + 1);
  const base = `${slug(style.nom)}-${n}`;
  const { width, height } = await sharp(file).metadata();
  if (Math.min(width, height) < 500) console.warn(`attention, photo petite (${width} x ${height}) : ${rel}`);
  // Portrait 4:5, recadrage centré sur le sujet
  for (const [w, suffix] of [[1000, ''], [500, '-sm']]) {
    await etalonner(sharp(file).resize(w, Math.round(w * 1.25), { fit: 'cover', position: 'attention', withoutEnlargement: false }))
      .webp({ quality: 80 }).toFile(path.join(OUT, `${base}${suffix}.webp`));
  }
  items.push({ src: `img/realisations/${base}.webp`, sm: `img/realisations/${base}-sm.webp`, cat: slug(style.nom), style: style.nom, prix: style.prix });
}

writeFileSync(DATA, JSON.stringify(items, null, 2));
console.log(`${items.length} photo(s) validée(s) préparée(s) sur ${validees.length} listée(s).`);
