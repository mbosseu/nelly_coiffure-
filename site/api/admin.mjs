import { regenerer, verifierContenu, FICHIERS, PAGES, DOMAINE } from './_lib/regenerer.mjs';
import { structurePage } from './_lib/pages.mjs';
import { NAVIGATION_DEFAUT } from './_lib/navigation.mjs';
import { createHash } from 'node:crypto';
import { lireTexte, listerDossier, publier, historique, ErreurGithub } from './_lib/github.mjs';
import { motDePasseValide, ouvrirSession, fermerSession, sessionEmise } from './_lib/session.mjs';

// API de l'espace de gestion de Nelly (/admin). Une seule fonction, l'action est passée dans ?action=
// connexion, deconnexion, deconnecter-partout, contenu, historique, version, publier, apercu.
// Une publication régénère les pages à partir du contenu (même générateur que outils/seo.mjs)
// et envoie le tout en un seul commit sur GitHub ; Vercel remet ensuite le site en ligne (environ une minute).

const CONTENU = 'contenu/site.json';
const PHOTO = /^img\/(realisations\/catalogue|annonces|pages)\/[a-z0-9-]+(-sm)?\.jpg$|^img\/marque\/logo-[0-9]+(-clair)?\.png$/;
const MAX_PHOTO = 900 * 1024;
const INDEXNOW_CLE = '9854d7068bfd3aafaa6ed978dd241645';

// Limite les essais de mot de passe (par instance, au mieux)
const essais = new Map();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const json = (res, statut, donnees) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(statut).json(donnees);
};

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    if (req.method === 'POST') {
      // Protection contre les requêtes venues d'un autre site
      if (req.headers['x-nelly-admin'] !== '1') return json(res, 403, { erreur: 'Requête refusée.' });
    }

    if (action === 'connexion' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
      const e = essais.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - e.t > 15 * 60 * 1000) { e.n = 0; e.t = Date.now(); }
      if (e.n >= 8) return json(res, 429, { erreur: 'Trop d’essais. Réessayez dans 15 minutes.' });
      if (!motDePasseValide(req.body?.motDePasse || '')) {
        e.n += 1; essais.set(ip, e);
        await pause(1200);
        return json(res, 401, { erreur: 'Mot de passe incorrect.' });
      }
      essais.delete(ip);
      ouvrirSession(res);
      return json(res, 200, { ok: true });
    }
    if (action === 'deconnexion' && req.method === 'POST') {
      fermerSession(res);
      return json(res, 200, { ok: true });
    }

    const emis = sessionEmise(req);
    if (emis === null || emis < await revoqueesAvant()) return json(res, 401, { erreur: 'Session expirée, reconnectez-vous.' });

    // Déconnecte tous les appareils : les jetons créés avant maintenant sont refusés, cet appareil reçoit un nouveau jeton
    if (action === 'deconnecter-partout' && req.method === 'POST') {
      const maintenant = Math.floor(Date.now() / 1000);
      await publier([{ chemin: SESSIONS, texte: `${JSON.stringify({ revoqueesAvant: maintenant })}\n` }], 'Espace Nelly : déconnexion de tous les appareils');
      revocation = { quand: Date.now(), avant: maintenant };
      ouvrirSession(res, maintenant);
      return json(res, 200, { ok: true });
    }

    if (action === 'contenu' && req.method === 'GET') {
      const { texte, sha } = await lireTexte(CONTENU);
      return json(res, 200, { contenu: JSON.parse(texte), version: sha, navigationDefaut: NAVIGATION_DEFAUT });
    }
    if (action === 'historique' && req.method === 'GET') {
      return json(res, 200, { versions: await historique(CONTENU) });
    }
    if (action === 'version' && req.method === 'GET') {
      if (!/^[0-9a-f]{40}$/.test(req.query.sha || '')) return json(res, 400, { erreur: 'Version inconnue.' });
      const { texte } = await lireTexte(CONTENU, req.query.sha);
      return json(res, 200, { contenu: JSON.parse(texte) });
    }
    if (action === 'publier' && req.method === 'POST') return await publierContenu(req, res);
    if (action === 'apercu' && req.method === 'POST') return await apercu(req, res);

    return json(res, 404, { erreur: 'Action inconnue.' });
  } catch (e) {
    console.error(e);
    const message = e instanceof ErreurGithub ? 'Le site n’a pas pu être mis à jour (GitHub). Réessayez dans un instant.' : 'Erreur inattendue. Réessayez dans un instant.';
    return json(res, 500, { erreur: message });
  }
}

// Date avant laquelle les connexions sont refusées (contenu/sessions.json, hors du site public).
// Relue au plus une fois par minute : un appareil déconnecté l'est partout en une minute au plus.
const SESSIONS = 'contenu/sessions.json';
let revocation = { quand: 0, avant: 0 };
async function revoqueesAvant() {
  if (Date.now() - revocation.quand < 60 * 1000) return revocation.avant;
  let avant = 0;
  try { avant = Number(JSON.parse((await lireTexte(SESSIONS)).texte).revoqueesAvant) || 0; }
  catch (e) { if (e.statut !== 404) throw e; }
  revocation = { quand: Date.now(), avant };
  return avant;
}

// Pages actuelles du site (dernière version sur GitHub), gardées une minute pour enchaîner les aperçus rapidement
let memoire = { quand: 0, fichiers: null };
async function lireFichiersSite({ frais = true } = {}) {
  if (!frais && memoire.fichiers && Date.now() - memoire.quand < 60 * 1000) return memoire.fichiers;
  const fichiers = {};
  await Promise.all(FICHIERS.map(async (f) => {
    try { fichiers[f] = (await lireTexte(`site/${f}`)).texte; }
    catch (e) { if (e.statut !== 404) throw e; }
  }));
  memoire = { quand: Date.now(), fichiers };
  return fichiers;
}

// Aperçu fidèle : la page est générée exactement comme à la publication, sans rien publier
async function apercu(req, res) {
  const { contenu, page } = req.body || {};
  if (!PAGES[page] || PAGES[page].robots) return json(res, 400, { erreur: 'Page inconnue.' });
  const erreurs = verifierContenu(contenu);
  const fichiers = await lireFichiersSite({ frais: false });
  const ancien = JSON.parse((await lireTexte(CONTENU)).texte);
  const resultat = { ...fichiers, ...regenerer(fichiers, contenu, { ancien }) };
  return json(res, 200, { html: resultat[page], avertissements: erreurs, sections: structurePage(resultat[page]) });
}

async function publierContenu(req, res) {
  const { contenu, photos = [], version, resume } = req.body || {};
  const erreurs = verifierContenu(contenu);
  if (erreurs.length) return json(res, 400, { erreur: erreurs.join(' ') });

  // Nouvelles photos : chemins et tailles contrôlés
  for (const p of photos) {
    if (!PHOTO.test(p.chemin || '') || typeof p.base64 !== 'string' || p.base64.length * 0.75 > MAX_PHOTO) {
      return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde.' });
    }
  }

  // Version de départ : si le contenu a été publié ailleurs entre-temps, on ne l'écrase pas
  const actuel = await lireTexte(CONTENU);
  if (version && version !== actuel.sha) {
    return json(res, 409, { erreur: 'Le site a été modifié depuis un autre appareil. Rechargez la page pour récupérer la dernière version.' });
  }
  const ancien = JSON.parse(actuel.texte);

  // Nouvelles photos dont le nom existe déjà sur le site : renommées pour ne jamais écraser une photo en ligne
  const [enLigne, imagesAnnonces, imagesPages, imagesMarque] = await Promise.all([
    listerDossier('site/img/realisations/catalogue'),
    listerDossier('site/img/annonces').catch((e) => { if (e.statut === 404) return new Set(); throw e; }),
    listerDossier('site/img/pages').catch((e) => { if (e.statut === 404) return new Set(); throw e; }),
    listerDossier('site/img/marque'),
  ]);
  const base = (chemin) => chemin.replace(/(-sm)?\.jpg$/, '');
  const nomsEnLigne = new Set([...enLigne].map((n) => n.replace(/(-sm)?\.jpg$/, '')));
  const bases = [...new Set(photos.map((p) => base(p.chemin)).filter((b) => b.startsWith('img/realisations/')))];
  const reserves = new Set([...nomsEnLigne, ...bases.map((b) => b.split('/').pop())]);
  const renommer = new Map();
  for (const b of bases) {
    const nom = b.split('/').pop();
    if (!nomsEnLigne.has(nom)) continue;
    const style = nom.replace(/-\d+$/, '');
    let n = 1;
    while (reserves.has(`${style}-${n}`)) n += 1;
    reserves.add(`${style}-${n}`);
    renommer.set(b, `img/realisations/catalogue/${style}-${n}`);
  }
  if (renommer.size) {
    for (const p of photos) { const b = base(p.chemin); if (renommer.has(b)) p.chemin = p.chemin.replace(b, renommer.get(b)); }
    for (const s of contenu.services) if (renommer.has(s.photo)) s.photo = renommer.get(s.photo);
    for (const p of contenu.photos) if (renommer.has(p.image)) p.image = renommer.get(p.image);
  }

  // Toutes les photos utilisées doivent exister (déjà en ligne ou envoyées maintenant)
  const envoyees = new Set(photos.map((p) => p.chemin));
  const utilisees = new Set([...contenu.services.map((s) => s.photo), ...contenu.photos.map((p) => p.image)]);
  for (const img of utilisees) {
    const nom = img.split('/').pop();
    const present = (envoyees.has(`${img}.jpg`) || enLigne.has(`${nom}.jpg`)) && (envoyees.has(`${img}-sm.jpg`) || enLigne.has(`${nom}-sm.jpg`));
    if (!present) return json(res, 400, { erreur: 'Une photo utilisée est introuvable. Ajoutez-la de nouveau.' });
  }
  for (const a of contenu.annonces || []) {
    if (!a.image?.src) continue;
    const nom = a.image.src.split('/').pop();
    const present = (envoyees.has(`${a.image.src}.jpg`) || imagesAnnonces.has(`${nom}.jpg`)) && (envoyees.has(`${a.image.src}-sm.jpg`) || imagesAnnonces.has(`${nom}-sm.jpg`));
    if (!present) return json(res, 400, { erreur: `L’image de l’annonce « ${a.titre || a.texte} » est introuvable. Ajoutez-la de nouveau.` });
  }

  for (const [f, p] of Object.entries(contenu.pages || {})) {
    for (const im of Object.values(p.images || {})) {
      const nom = im.src.split('/').pop();
      const present = (envoyees.has(`${im.src}.jpg`) || imagesPages.has(`${nom}.jpg`)) && (envoyees.has(`${im.src}-sm.jpg`) || imagesPages.has(`${nom}-sm.jpg`));
      if (!present) return json(res, 400, { erreur: `Une image modifiée de la page ${f} est introuvable. Ajoutez-la de nouveau.` });
    }
  }

  const present = (chemin, dossier) => envoyees.has(chemin) || dossier.has(chemin.split('/').pop());
  const logo = contenu.marque?.logo;
  if (logo && !(present(`${logo.src}.png`, imagesMarque) && present(`${logo.src}-clair.png`, imagesMarque))) {
    return json(res, 400, { erreur: 'Le nouveau logo est introuvable. Ajoutez-le de nouveau.' });
  }
  const fond = contenu.fonds?.cta;
  if (fond && !(present(`${fond}.jpg`, imagesPages) && present(`${fond}-sm.jpg`, imagesPages))) {
    return json(res, 400, { erreur: 'L’image de fond est introuvable. Ajoutez-la de nouveau.' });
  }

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
  const nouvelleVersion = createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex');
  return json(res, 200, { ok: true, commit, version: nouvelleVersion, contenu, renommees: Object.fromEntries(renommer) });
}
