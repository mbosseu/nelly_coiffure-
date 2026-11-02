import { createHash } from 'node:crypto';
import { regenerer, FICHIERS, PAGES, DOMAINE } from './regenerer.mjs';
import { lireTexte, publier } from './github.mjs';

// Publication du contenu, partagée par l'espace de gestion (api/admin.mjs) et le connecteur IA (api/mcp.mjs) :
// régénération des pages, un seul commit GitHub (Vercel remet ensuite le site en ligne), prévenance de Bing.

export const CONTENU = 'contenu/site.json';
const INDEXNOW_CLE = '9854d7068bfd3aafaa6ed978dd241645';

// Date avant laquelle les connexions sont refusées (contenu/sessions.json, hors du site public).
// Relue au plus une fois par minute : un appareil déconnecté l'est partout en une minute au plus.
export const SESSIONS = 'contenu/sessions.json';
let revocation = { quand: 0, avant: 0 };
export async function revoqueesAvant() {
  if (Date.now() - revocation.quand < 60 * 1000) return revocation.avant;
  let avant = 0;
  try { avant = Number(JSON.parse((await lireTexte(SESSIONS)).texte).revoqueesAvant) || 0; }
  catch (e) { if (e.statut !== 404) throw e; }
  revocation = { quand: Date.now(), avant };
  return avant;
}
export const noterRevocation = (avant) => { revocation = { quand: Date.now(), avant }; };

// Pages actuelles du site (dernière version sur GitHub), gardées une minute pour enchaîner les aperçus rapidement
let memoire = { quand: 0, fichiers: null };
export async function lireFichiersSite({ frais = true } = {}) {
  if (!frais && memoire.fichiers && Date.now() - memoire.quand < 60 * 1000) return memoire.fichiers;
  const fichiers = {};
  await Promise.all(FICHIERS.map(async (f) => {
    try { fichiers[f] = (await lireTexte(`site/${f}`)).texte; }
    catch (e) { if (e.statut !== 404) throw e; }
  }));
  memoire = { quand: Date.now(), fichiers };
  return fichiers;
}

/**
 * Publie un contenu déjà vérifié : pages régénérées, contenu et photos envoyés en un commit.
 * Renvoie le commit et la nouvelle version (empreinte Git) du contenu.
 */
export async function publierContenuVerifie(contenu, ancien, { photos = [], resume = '' } = {}) {
  // Régénération des pages à partir de la dernière version en ligne
  const fichiers = await lireFichiersSite();
  const modifies = regenerer(fichiers, contenu, { ancien });

  // Les photos retirées disparaissent du site mais leurs fichiers restent dans le dépôt :
  // l'historique peut ainsi toujours revenir à une version qui les affichait
  const texteContenu = `${JSON.stringify(contenu, null, 2)}\n`;
  const aPublier = [
    { chemin: CONTENU, texte: texteContenu },
    ...Object.entries(modifies).map(([f, texte]) => ({ chemin: `site/${f}`, texte })),
    ...photos.map((p) => ({ chemin: `site/${p.chemin}`, base64: p.base64 })),
  ];
  const message = `Espace Nelly : ${String(resume || 'mise à jour du contenu').replace(/\s+/g, ' ').slice(0, 120)}`;
  const commit = await publier(aPublier, message);

  // Prévient Bing (IndexNow) que les pages ont changé ; sans effet sur le reste si cela échoue
  const pages = Object.keys(modifies).filter((f) => PAGES[f] && !PAGES[f].robots).map((f) => `${DOMAINE}${PAGES[f].chemin}`);
  if (pages.length) {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(3000),
      body: JSON.stringify({ host: new URL(DOMAINE).host, key: INDEXNOW_CLE, keyLocation: `${DOMAINE}/${INDEXNOW_CLE}.txt`, urlList: pages }),
    }).catch(() => {});
  }

  // Nouvelle version du contenu (empreinte Git du fichier) : permet d'enchaîner une autre publication
  const octets = Buffer.from(texteContenu, 'utf8');
  const version = createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex');
  return { commit, version };
}
