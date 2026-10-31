import { readFileSync } from 'node:fs';
import path from 'node:path';

// IndexNow : prévient Bing (et Yandex, Seznam…) que les pages ont changé, pour qu'elles soient explorées en quelques minutes.
// Bing alimente aussi ChatGPT et Copilot. Google n'utilise pas IndexNow : pour lui, passer par Search Console.
// À lancer une fois le site déployé : node outils/indexnow.mjs
// La clé est le fichier site/<clé>.txt ; si le nom de domaine change, mettre à jour DOMAINE (comme dans seo.mjs).

const DOMAINE = 'https://nelly-coiffure.vercel.app';
const CLE = '9854d7068bfd3aafaa6ed978dd241645';

const sitemap = readFileSync(path.resolve(import.meta.dirname, '../site/sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, u]) => u);

const reponse = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(DOMAINE).host, key: CLE, keyLocation: `${DOMAINE}/${CLE}.txt`, urlList: urls }),
});
console.log(`IndexNow : ${urls.length} adresses envoyées, réponse ${reponse.status} (200 ou 202 = accepté).`);
