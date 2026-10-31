import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { regenerer, FICHIERS, PAGES, DOMAINE } from '../site/api/_lib/regenerer.mjs';

// Régénère le site sur le poste : contenu modifiable (contenu/site.json), balises de référencement,
// données structurées, version du CSS/JS, sitemap.xml et robots.txt.
// La logique est dans site/api/_lib/regenerer.mjs, partagée avec l'espace de gestion de Nelly (/admin).
// À relancer après chaque modification des pages : node outils/seo.mjs (sans danger, peut tourner plusieurs fois)

const RACINE = path.resolve(import.meta.dirname, '..');
const SITE = path.join(RACINE, 'site');
const contenu = JSON.parse(readFileSync(path.join(RACINE, 'contenu/site.json'), 'utf8'));

const fichiers = Object.fromEntries(FICHIERS.filter((f) => existsSync(path.join(SITE, f))).map((f) => [f, readFileSync(path.join(SITE, f), 'utf8')]));
const modifies = regenerer(fichiers, contenu);
for (const [f, t] of Object.entries(modifies)) writeFileSync(path.join(SITE, f), t);

const indexables = Object.values(PAGES).filter((P) => !P.robots).length;
console.log(`${Object.keys(modifies).length} fichiers mis à jour, ${indexables} pages dans le sitemap (${DOMAINE}).`);
