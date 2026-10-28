import sharp from 'sharp';
import { readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Aperçu LOCAL de la galerie Réalisations avec toutes les photos du dossier coiffure/ (jamais publié :
// le dossier outils/apercu/ est hors du site et exclu de Git). Pour publier une photo, l'ajouter à
// coiffure/VALIDEES.txt puis lancer outils/preparer-realisations.mjs.
// Usage : node outils/apercu-realisations.mjs, puis ouvrir outils/apercu/index.html

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'coiffure');
const OUT = path.join(ROOT, 'outils/apercu');
const NOMS = {
  lock: 'Locks', lock_court: 'Locks courtes', natte_colle: 'Nattes collées', short_braids: 'Short braids',
  tissage: 'Tissage', tresse_coucher: 'Tresses couchées', tresse_homme_coller: 'Tresses collées homme',
  twist_homme: 'Twists homme', twists: 'Twists', knotless_braids: 'Knotless braids',
};
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const parse = (dir) => {
  const m = dir.match(/^(.*?)[ _]*(\d+)\s*euros?$/i);
  const key = (m ? m[1] : dir).trim().toLowerCase().replace(/\s+/g, '_');
  let nom = NOMS[key] || key.replace(/_/g, ' ');
  if (key === 'tresse_coucher' && m && Number(m[2]) === 30) nom = 'Tresses couchées enfant';
  return { nom, prix: m ? Number(m[2]) : null };
};
const etalonner = (img) => img.rotate().modulate({ saturation: 0.94, brightness: 1.02 }).linear([1.03, 1, 0.95], [2, 0, -3]);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, 'img'), { recursive: true });

const items = [];
for (const dir of readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const style = parse(dir);
  const files = readdirSync(path.join(SRC, dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  for (const [i, f] of files.entries()) {
    const name = `${slug(style.nom)}-${i + 1}.webp`;
    await etalonner(sharp(path.join(SRC, dir, f)).resize(800, 1000, { fit: 'cover', position: 'attention' }))
      .webp({ quality: 80 }).toFile(path.join(OUT, 'img', name));
    items.push({ src: `img/${name}`, cat: slug(style.nom), style: style.nom, prix: style.prix });
  }
}
const cats = [...new Map(items.map((it) => [it.cat, it.style])).entries()];

writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aperçu local — Réalisations</title>
  <link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Poppins:wght@300;400;500;600&family=Sacramento&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../site/css/style.css">
  <style>
    .apercu-bandeau { position: sticky; top: 0; z-index: 60; padding: 10px 20px; text-align: center; font-size: .82rem; color: #FBF3EA; background: #8E5B3C; }
    .gallery__cap span { color: var(--copper-light); font-family: var(--serif); font-size: 1rem; letter-spacing: 0; text-transform: none; }
  </style>
</head>
<body class="page is-loaded">
  <p class="apercu-bandeau">Aperçu local, non publié : ${items.length} photos du dossier coiffure, traitées au style du site.</p>
  <main>
    <section class="section">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow">Réalisations</p>
          <h1 class="title">Des coiffures qui racontent une histoire</h1>
        </div>
        <div class="filters" role="group" aria-label="Filtrer par style">
          <button type="button" class="chip" aria-pressed="true" data-filter="tout">Tout <small>${items.length}</small></button>
${cats.map(([k, v]) => `          <button type="button" class="chip" aria-pressed="false" data-filter="${k}">${v} <small>${items.filter((it) => it.cat === k).length}</small></button>`).join('\n')}
        </div>
        <div class="gallery" id="gallery">
${items.map((it) => `          <figure class="gallery__item" data-cat="${it.cat}"><img src="${it.src}" width="800" height="1000" loading="lazy" alt="${it.style}"><figcaption class="gallery__cap"><b>${it.style}</b><span>${it.prix ? `${it.prix} €` : ''}</span></figcaption></figure>`).join('\n')}
        </div>
      </div>
    </section>
  </main>
  <script>
    const chips = [...document.querySelectorAll('[data-filter]')];
    chips.forEach((c) => c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      document.querySelectorAll('.gallery__item').forEach((it) => { it.classList.toggle('is-hidden', c.dataset.filter !== 'tout' && it.dataset.cat !== c.dataset.filter); });
    }));
  </script>
</body>
</html>
`);
console.log(`${items.length} photos, ${cats.length} styles → outils/apercu/index.html`);
