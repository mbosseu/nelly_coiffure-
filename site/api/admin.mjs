import { regenerer, verifierContenu, PAGES, suiteDe, imagesAlbums, videosUtilisees } from './_lib/regenerer.mjs';
import { structurePage } from './_lib/pages.mjs';
import { NAVIGATION_DEFAUT } from './_lib/navigation.mjs';
import { direct, statsActives, tableauDeBord } from './_lib/stats.mjs';
import { lireTexte, listerDossier, publier, historique, ErreurGithub } from './_lib/github.mjs';
import { CONTENU, SESSIONS, revoqueesAvant, noterRevocation, lireFichiersSite, publierContenuVerifie } from './_lib/publication.mjs';
import { motDePasseValide, ouvrirSession, fermerSession, sessionEmise } from './_lib/session.mjs';
import { stockerMorceau, assemblerVideo, SHA, CHEMIN_VIDEO } from './_lib/video.mjs';

// API de l'espace de gestion de Nelly (/admin). Une seule fonction, l'action est passée dans ?action=
// connexion, deconnexion, deconnecter-partout, contenu, historique, version, publier, apercu.
// Une publication régénère les pages à partir du contenu (même générateur que outils/seo.mjs)
// et envoie le tout en un seul commit sur GitHub ; Vercel remet ensuite le site en ligne (environ une minute).

const PHOTO = /^img\/(realisations\/catalogue|annonces|pages)\/[a-z0-9-]+(-sm)?\.jpg$|^img\/marque\/logo-[0-9]+(-clair)?\.png$/;
const MAX_PHOTO = 900 * 1024;

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
      noterRevocation(maintenant);
      ouvrirSession(res, maintenant);
      return json(res, 200, { ok: true });
    }

    if (action === 'contenu' && req.method === 'GET') {
      const { texte, sha } = await lireTexte(CONTENU);
      return json(res, 200, { contenu: JSON.parse(texte), version: sha, navigationDefaut: NAVIGATION_DEFAUT });
    }
    if (action === 'stats' && req.method === 'GET') {
      if (!statsActives()) return json(res, 200, { actif: false });
      const n = [1, 7, 30, 90].includes(Number(req.query.jours)) ? Number(req.query.jours) : 30;
      return json(res, 200, { actif: true, ...(await tableauDeBord(n)) });
    }
    if (action === 'direct' && req.method === 'GET') {
      if (!statsActives()) return json(res, 200, { actif: false });
      return json(res, 200, { actif: true, ...(await direct()) });
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
    // Gros envois (vidéos, nombreuses photos) : déposés morceau par morceau, puis référencés à la publication
    if (action === 'morceau' && req.method === 'POST') return json(res, 200, { sha: await stockerMorceau(req.body?.base64) });
    if (action === 'video-assembler' && req.method === 'POST') return json(res, 200, await assemblerVideo(req.body?.morceaux));
    if (action === 'apercu' && req.method === 'POST') return await apercu(req, res);

    return json(res, 404, { erreur: 'Action inconnue.' });
  } catch (e) {
    console.error(e);
    if (e.invalide) return json(res, 400, { erreur: e.message });
    const message = e instanceof ErreurGithub ? 'Le site n’a pas pu être mis à jour (GitHub). Réessayez dans un instant.' : 'Erreur inattendue. Réessayez dans un instant.';
    return json(res, 500, { erreur: message });
  }
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
  const { contenu, photos = [], videos = [], version, resume } = req.body || {};
  const erreurs = verifierContenu(contenu);
  if (erreurs.length) return json(res, 400, { erreur: erreurs.join(' ') });

  // Nouvelles photos : chemins et tailles contrôlés
  for (const p of photos) {
    const contenuValide = p.sha ? SHA.test(p.sha) : (typeof p.base64 === 'string' && p.base64.length * 0.75 <= MAX_PHOTO);
    if (!PHOTO.test(p.chemin || '') || !contenuValide) {
      return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde.' });
    }
  }
  for (const v of videos) {
    if (!CHEMIN_VIDEO.test(v.chemin || '') || !SHA.test(v.sha || '')) return json(res, 400, { erreur: 'Une vidéo est invalide. Ajoutez-la de nouveau.' });
  }

  // Version de départ : si le contenu a été publié ailleurs entre-temps, on ne l'écrase pas
  const actuel = await lireTexte(CONTENU);
  if (version && version !== actuel.sha) {
    return json(res, 409, { erreur: 'Le site a été modifié depuis un autre appareil. Rechargez la page pour récupérer la dernière version.' });
  }
  const ancien = JSON.parse(actuel.texte);

  // Nouvelles photos dont le nom existe déjà sur le site : renommées pour ne jamais écraser une photo en ligne
  const [enLigne, imagesAnnonces, imagesPages, imagesMarque, videosEnLigne] = await Promise.all([
    listerDossier('site/img/realisations/catalogue'),
    listerDossier('site/img/annonces').catch((e) => { if (e.statut === 404) return new Set(); throw e; }),
    listerDossier('site/img/pages').catch((e) => { if (e.statut === 404) return new Set(); throw e; }),
    listerDossier('site/img/marque'),
    listerDossier('site/video').catch((e) => { if (e.statut === 404) return new Set(); throw e; }),
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
    for (const x of [...contenu.services, ...contenu.photos]) for (const m of suiteDe(x)) if (renommer.has(m.image)) m.image = renommer.get(m.image);
  }

  // Toutes les photos utilisées doivent exister (déjà en ligne ou envoyées maintenant)
  const envoyees = new Set(photos.map((p) => p.chemin));
  const utilisees = new Set([...contenu.services.map((s) => s.photo), ...contenu.photos.map((p) => p.image), ...imagesAlbums(contenu)]);
  for (const img of utilisees) {
    const nom = img.split('/').pop();
    const present = (envoyees.has(`${img}.jpg`) || enLigne.has(`${nom}.jpg`)) && (envoyees.has(`${img}-sm.jpg`) || enLigne.has(`${nom}-sm.jpg`));
    if (!present) return json(res, 400, { erreur: 'Une photo utilisée est introuvable. Ajoutez-la de nouveau.' });
  }
  const videosEnvoyees = new Set(videos.map((v) => v.chemin));
  for (const src of videosUtilisees(contenu)) {
    if (!videosEnvoyees.has(`${src}.mp4`) && !videosEnLigne.has(`${src.split('/').pop()}.mp4`)) return json(res, 400, { erreur: 'Une vidéo utilisée est introuvable. Ajoutez-la de nouveau.' });
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

  const { commit, version: nouvelleVersion } = await publierContenuVerifie(contenu, ancien, { photos, videos, resume });
  return json(res, 200, { ok: true, commit, version: nouvelleVersion, contenu, renommees: Object.fromEntries(renommer) });
}
