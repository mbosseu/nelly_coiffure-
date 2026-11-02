import { createHash, randomBytes } from 'node:crypto';

// Statistiques de visite du site, anonymes et sans cookie (exemptées de consentement selon la CNIL :
// mesure d'audience strictement limitée au site, pas de suivi d'un site à l'autre, pas d'identification).
// - Une personne est reconnue le temps d'une journée seulement : empreinte de (adresse IP + navigateur + sel du jour),
//   le sel change chaque jour et n'est jamais conservé au-delà, l'adresse IP n'est jamais enregistrée.
// - Une visite (enchaînement de pages) est suivie par un numéro tiré au hasard, gardé dans l'onglet du navigateur
//   (sessionStorage) : il disparaît à la fermeture de l'onglet.
// Stockage : base Redis Upstash (intégration Vercel), variables KV_REST_API_URL / KV_REST_API_TOKEN
// ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.

const URL_BASE = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const JETON = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const statsActives = () => Boolean(URL_BASE() && JETON());

const DUREE_JOURS = 400 * 86400; // compteurs quotidiens gardés environ 13 mois (recommandation CNIL : 13 mois maximum)
const DUREE_PARCOURS = 90 * 86400; // parcours détaillés gardés 3 mois
const MAX_VISITES_JOUR = 1000; // nombre de parcours détaillés gardés par jour

// Plusieurs commandes Redis en un seul aller-retour
export async function redis(commandes) {
  const r = await fetch(`${URL_BASE()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JETON()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commandes),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  const res = await r.json();
  return res.map((x) => (x.error ? null : x.result));
}

// Jour et heure à Marseille
export const jourParis = (t = Date.now()) => new Date(t).toLocaleDateString('sv', { timeZone: 'Europe/Paris' });
const heureParis = (t = Date.now()) => Number(new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).slice(0, 2));

// Pages connues du site (le reste est regroupé dans « autre », pour garder des tableaux propres)
export const PAGES_SITE = {
  '/': 'Accueil', '/coiffures.html': 'Coiffures et tarifs', '/realisations.html': 'Réalisations', '/a-propos.html': 'À propos',
  '/contact.html': 'Contact', '/knotless-braids-marseille.html': 'Knotless braids', '/locks-marseille.html': 'Locks',
  '/tresses-enfant-marseille.html': 'Tresses enfant', '/coiffure-afro-domicile-marseille.html': 'Coiffure à domicile',
  '/conseils-tresses-africaines.html': 'Conseils tresses', '/mentions-legales.html': 'Mentions légales',
  '/confidentialite.html': 'Confidentialité', '/404.html': 'Page introuvable',
};
const nettoyerPage = (p) => {
  const chemin = String(p || '/').split(/[?#]/)[0].replace('/index.html', '/');
  return PAGES_SITE[chemin] ? chemin : 'autre';
};

// D'où vient la personne : moteur de recherche, réseau social, lien direct…
const SOURCES = [
  ['google', /(^|\.)google\./], ['bing', /(^|\.)bing\.com$/], ['autres-moteurs', /duckduckgo|qwant|yahoo|ecosia|yandex|brave/],
  ['instagram', /instagram\.com$/], ['facebook', /facebook\.com$|fb\.com$|messenger\.com$/], ['tiktok', /tiktok\.com$/],
  ['snapchat', /snapchat\.com$/], ['whatsapp', /whatsapp\.(com|net)$|wa\.me$/], ['youtube', /youtube\.com$|youtu\.be$/],
  ['google-maps', /maps\.app\.goo\.gl$|maps\.google\./],
];
const source = (referent, utm) => {
  const u = String(utm || '').toLowerCase().slice(0, 30);
  if (u) return SOURCES.some(([cle]) => cle === u) ? u : 'autre-site';
  let hote = '';
  try { hote = new URL(referent).hostname.replace(/^www\./, ''); } catch { return 'direct'; }
  if (!hote || /nellycoiffure\.fr$/.test(hote)) return 'direct';
  return SOURCES.find(([, re]) => re.test(hote))?.[0] || 'autre-site';
};
const appareil = (largeur, ua) => {
  const l = Number(largeur) || 0;
  if (/ipad|tablet/i.test(ua) || (l >= 600 && l < 1024 && /mobile|android/i.test(ua))) return 'tablette';
  if (/mobi|iphone|android/i.test(ua) || (l && l < 600)) return 'mobile';
  return 'ordinateur';
};
const ROBOTS = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|curl|wget|python|monitor|vercel/i;
const CONTACTS = ['whatsapp', 'appel', 'instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'itineraire'];

// Sel du jour (créé à la première visite du jour, effacé au bout de 2 jours)
async function selDuJour(jour) {
  const nouveau = randomBytes(16).toString('hex');
  const [, sel] = await redis([['SET', `sel:${jour}`, nouveau, 'NX', 'EX', 172800], ['GET', `sel:${jour}`]]);
  return sel || nouveau;
}

/**
 * Enregistre un événement envoyé par le site.
 * @param {object} e { t: 'v' (page vue) | 'f' (fin de page) | 'c' (contact), p: page, s: n° de visite, i: rang de la page dans la visite,
 *                     r: page d'origine, u: utm_source, w: largeur d'écran, d: durée (s), sc: défilement (%), k: type de contact }
 * @param {object} req requête (en-têtes : navigateur, adresse IP, ville)
 */
export async function enregistrer(e, req) {
  const ua = String(req.headers['user-agent'] || '');
  if (!e || typeof e !== 'object' || ROBOTS.test(ua)) return;
  const s = String(e.s || '');
  if (!/^[a-z0-9]{8,24}$/.test(s)) return;
  const maintenant = Date.now();
  const jour = jourParis(maintenant);
  const j = `j:${jour}`;
  const page = nettoyerPage(e.p);
  const cmd = [];
  const ajouter = (...c) => cmd.push(c);
  const parcours = (texte) => { ajouter('RPUSH', `v:${s}`, texte); ajouter('EXPIRE', `v:${s}`, DUREE_PARCOURS); };

  if (e.t === 'v') {
    const rang = Math.max(1, Math.min(500, Number(e.i) || 1));
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const sel = await selDuJour(jour);
    const personne = createHash('sha256').update(`${sel}|${ip}|${ua}`).digest('hex').slice(0, 20);
    ajouter('HINCRBY', j, 'vues', 1);
    ajouter('HINCRBY', j, `p:${page}`, 1);
    ajouter('PFADD', `u:${jour}`, personne);
    ajouter('EXPIRE', `u:${jour}`, DUREE_JOURS);
    if (rang === 1) {
      const ville = decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')).slice(0, 40) || 'inconnue';
      const meta = { debut: maintenant, src: source(e.r, e.u), app: appareil(e.w, ua), ville, entree: page };
      ajouter('HINCRBY', j, 'visites', 1);
      ajouter('HINCRBY', j, `src:${meta.src}`, 1);
      ajouter('HINCRBY', j, `app:${meta.app}`, 1);
      ajouter('HINCRBY', j, `ville:${ville}`, 1);
      ajouter('HINCRBY', j, `ent:${page}`, 1);
      ajouter('HINCRBY', j, `h:${heureParis(maintenant)}`, 1);
      ajouter('SET', `vm:${s}`, JSON.stringify(meta), 'EX', DUREE_PARCOURS);
      ajouter('LPUSH', `dv:${jour}`, s);
      ajouter('LTRIM', `dv:${jour}`, 0, MAX_VISITES_JOUR - 1);
      ajouter('EXPIRE', `dv:${jour}`, DUREE_PARCOURS);
    }
    if (rang === 2) ajouter('HINCRBY', j, 'engagees', 1); // visites qui voient au moins 2 pages
    parcours(`${maintenant}|v|${page}`);
    ajouter('ZADD', 'live', maintenant, s);
    ajouter('ZREMRANGEBYSCORE', 'live', 0, maintenant - 10 * 60000);
  } else if (e.t === 'f') {
    const duree = Math.max(0, Math.min(1800, Math.round(Number(e.d) || 0)));
    const defile = Math.max(0, Math.min(100, Math.round(Number(e.sc) || 0)));
    if (!duree) return;
    ajouter('HINCRBY', j, 'duree', duree);
    ajouter('HINCRBY', j, 'nbduree', 1);
    ajouter('HINCRBY', j, 'defile', defile);
    ajouter('HINCRBY', j, `dp:${page}`, duree);
    ajouter('HINCRBY', j, `np:${page}`, 1);
    parcours(`${maintenant}|f|${page}|${duree}|${defile}`);
    ajouter('ZADD', 'live', maintenant, s);
  } else if (e.t === 'c') {
    const k = CONTACTS.includes(e.k) ? e.k : null;
    if (!k) return;
    ajouter('HINCRBY', j, `c:${k}`, 1);
    if (k === 'whatsapp' || k === 'appel') { ajouter('HINCRBY', j, 'contacts', 1); ajouter('HINCRBY', j, `cp:${page}`, 1); }
    parcours(`${maintenant}|c|${page}|${k}`);
  } else return;
  ajouter('EXPIRE', j, DUREE_JOURS);
  await redis(cmd);
}

// --- Lecture pour le tableau de bord ------------------------------------------------

const jours = (n, fin = Date.now()) => Array.from({ length: n }, (_, i) => jourParis(fin - (n - 1 - i) * 86400000));
const nombre = (v) => Number(v) || 0;
const hash = (liste) => { const o = {}; for (let i = 0; liste && i < liste.length; i += 2) o[liste[i]] = liste[i + 1]; return o; };

/** Données du tableau de bord sur les n derniers jours (n = 1 : aujourd'hui) */
export async function tableauDeBord(n = 30) {
  const periode = jours(n);
  const avant = jours(n, Date.now() - n * 86400000); // période précédente, pour comparer
  const maintenant = Date.now();
  const res = await redis([
    ...periode.map((d) => ['HGETALL', `j:${d}`]),
    ...periode.map((d) => ['PFCOUNT', `u:${d}`]),
    ...avant.map((d) => ['HGETALL', `j:${d}`]),
    ...avant.map((d) => ['PFCOUNT', `u:${d}`]),
    ['ZCOUNT', 'live', maintenant - 5 * 60000, '+inf'],
    ...periode.slice(-14).reverse().map((d) => ['LRANGE', `dv:${d}`, 0, 199]),
  ]);
  const k = periode.length;
  const parJour = res.slice(0, k).map(hash);
  const uniques = res.slice(k, 2 * k).map(nombre);
  const avantJ = res.slice(2 * k, 3 * k).map(hash);
  const avantU = res.slice(3 * k, 4 * k).map(nombre);
  const enLigne = nombre(res[4 * k]);
  const idsVisites = [...new Set(res.slice(4 * k + 1).flat().filter(Boolean))].slice(0, 300);

  // Totaux par champ sur la période
  const cumul = (liste) => {
    const t = {};
    for (const h of liste) for (const [c, v] of Object.entries(h)) t[c] = (t[c] || 0) + nombre(v);
    return t;
  };
  const tot = cumul(parJour);
  const totAvant = cumul(avantJ);
  const groupe = (prefixe) => Object.entries(tot).filter(([c]) => c.startsWith(prefixe)).map(([c, v]) => [c.slice(prefixe.length), v]).sort((a, b) => b[1] - a[1]);
  const resume = (t, u) => ({
    visiteurs: u.reduce((a, b) => a + b, 0),
    visites: nombre(t.visites), vues: nombre(t.vues), contacts: nombre(t.contacts),
    dureeMoyenne: t.nbduree ? Math.round(t.duree / t.nbduree) : 0,
    rebond: t.visites ? Math.round(100 * (1 - nombre(t.engagees) / t.visites)) : 0,
    defilement: t.nbduree ? Math.round(t.defile / t.nbduree) : 0,
  });

  // Parcours détaillés des dernières visites
  let visites = [];
  if (idsVisites.length) {
    const det = await redis([...idsVisites.map((id) => ['GET', `vm:${id}`]), ...idsVisites.map((id) => ['LRANGE', `v:${id}`, 0, 60])]);
    visites = idsVisites.map((id, i) => {
      let meta = {};
      try { meta = JSON.parse(det[i] || '{}'); } catch { /* ignoré */ }
      const etapes = (det[idsVisites.length + i] || []).map((x) => {
        const [t, type, page, a, b] = String(x).split('|');
        return { t: Number(t), type, page, duree: type === 'f' ? Number(a) : undefined, defile: type === 'f' ? Number(b) : undefined, contact: type === 'c' ? a : undefined };
      });
      return { ...meta, etapes };
    }).filter((v) => v.debut && v.etapes.length).sort((a, b) => b.debut - a.debut);
  }

  // Chemins fréquents : suites de pages (3 premières), pages de sortie, enchaînements page → page
  const compter = (liste) => { const m = new Map(); for (const x of liste) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const pagesVisite = visites.map((v) => v.etapes.filter((e) => e.type === 'v').map((e) => e.page).filter((p, i, l) => p !== l[i - 1]));
  const chemins = compter(pagesVisite.filter((l) => l.length).map((l) => l.slice(0, 3).join(' → '))).slice(0, 10);
  const sorties = compter(pagesVisite.filter((l) => l.length).map((l) => l[l.length - 1])).slice(0, 8);
  const enchainements = compter(pagesVisite.flatMap((l) => l.slice(1).map((p, i) => `${l[i]} → ${p}`))).slice(0, 10);

  return {
    periode: { debut: periode[0], fin: periode[k - 1], jours: n },
    resume: resume(tot, uniques),
    precedent: resume(totAvant, avantU),
    enLigne,
    courbe: periode.map((d, i) => ({ jour: d, visites: nombre(parJour[i].visites), vues: nombre(parJour[i].vues), contacts: nombre(parJour[i].contacts), visiteurs: uniques[i] })),
    pages: groupe('p:'),
    entrees: groupe('ent:'),
    contactsParPage: groupe('cp:'),
    tempsParPage: groupe('dp:').map(([p, d]) => [p, Math.round(d / Math.max(1, nombre(tot[`np:${p}`])))]),
    sources: groupe('src:'),
    appareils: groupe('app:'),
    villes: groupe('ville:').slice(0, 10),
    heures: Array.from({ length: 24 }, (_, h) => nombre(tot[`h:${h}`])),
    actions: groupe('c:'),
    chemins, sorties, enchainements,
    visites: visites.slice(0, 40),
    nomsPages: PAGES_SITE,
  };
}
