import { verifierContenu, PAGES, PAGES_ANNONCES, FORMATS_ANNONCE, FONDS, THEMES, DOMAINE } from './regenerer.mjs';
import { structurePage } from './pages.mjs';
import { navigationDe, RESEAUX_LISTE } from './navigation.mjs';
import { lireTexte, listerDossier, historique } from './github.mjs';
import { CONTENU, publierContenuVerifie } from './publication.mjs';
import { direct, statsActives, tableauDeBord } from './stats.mjs';
import { signerJeton } from './oauth.mjs';

// Outils du connecteur IA (api/mcp.mjs) : la plupart des modifications de contenu de l'espace de gestion.
// Une nouvelle photo passe par un lien d'envoi à usage unique (preparer_envoi_photo, api/envoi.mjs) et se cadre
// par position et zoom (paramètre cadrage) ; le cadrage au doigt et les réglages du compte (mot de passe, déconnexions) restent dans l'app.
// Chaque modification part du contenu en ligne, passe par verifierContenu() et la même publication que
// l'espace de gestion. Sans « confirmer: true », l'outil renvoie seulement l'aperçu des changements.

export class ErreurOutil extends Error {}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ETATS = { ouvert: 'ouvert', ferme: 'ferme', sur_demande: 'demande' };
const NOMS_ETATS = { ouvert: 'ouvert', ferme: 'fermé', demande: 'sur demande' };
const PERIODES = { aujourdhui: 1, '7_jours': 7, '30_jours': 30, '3_mois': 90 };
const DESTINATIONS = { whatsapp: 'whatsapp', telephone: 'telephone', page: 'page', lien: 'externe' };
const NOMS_DESTINATIONS = { whatsapp: 'WhatsApp', telephone: 'téléphone', page: 'page', externe: 'lien' };
const DOSSIERS = { catalogue: 'site/img/realisations/catalogue', annonces: 'site/img/annonces', pages: 'site/img/pages' };

// --- Pages ------------------------------------------------------------------------------------
const PAGES_MODIFIABLES = PAGES_ANNONCES; // [fichier, nom]
const PAGES_LIENS = Object.entries(PAGES).filter(([, p]) => !p.robots).map(([f, p]) => [f, p.ariane || 'Accueil']);
const NOMS_PAGES = PAGES_MODIFIABLES.map(([, n]) => n);
const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const trouverPage = (liste, nom) => liste.find(([f, n]) => f === nom || sansAccents(n) === sansAccents(nom));
const nomPage = (f) => (f === 'toutes' ? 'toutes les pages' : (PAGES_LIENS.find(([x]) => x === String(f).split('#')[0]) || [])[1] || f);

/** Page modifiable (nom ou fichier) → fichier */
function pageModifiable(nom) {
  const p = trouverPage(PAGES_MODIFIABLES, nom);
  if (!p) throw new ErreurOutil(`Page inconnue : « ${nom} ». Pages : ${NOMS_PAGES.join(', ')}.`);
  return p[0];
}
/** Destination d'un lien vers une page du site (nom, fichier, éventuellement #ancre) → « fichier#ancre » */
function lienPage(valeur) {
  const [nom, ancre] = String(valeur || '').split('#');
  const p = trouverPage(PAGES_LIENS, nom.trim());
  if (!p) throw new ErreurOutil(`Page inconnue : « ${valeur} ». Pages : ${PAGES_LIENS.map(([, n]) => n).join(', ')}.`);
  return ancre ? `${p[0]}#${ancre}` : p[0];
}
const pagesAnnonce = (liste, defaut) => {
  const pages = (liste?.length ? liste : defaut).map((n) => (n === 'toutes' ? 'toutes' : pageModifiable(n)));
  return pages.includes('toutes') ? ['toutes'] : [...new Set(pages)];
};
// Bouton ou lien : { texte, destination, valeur } → { texte, type, valeur }
function versLien(b, ancien = {}) {
  const destination = b.destination ? DESTINATIONS[b.destination] : ancien.type;
  if (!destination) throw new ErreurOutil('Destination du lien inconnue (whatsapp, telephone, page ou lien).');
  let valeur = b.valeur !== undefined ? String(b.valeur).trim() : (b.destination ? '' : ancien.valeur || '');
  if (destination === 'page') valeur = lienPage(valeur);
  return { texte: b.texte !== undefined ? String(b.texte).trim() : ancien.texte || '', type: destination, valeur };
}
// Cadrage d'une photo dans son cadre : point gardé visible (x, y en %) et zoom, comme dans l'espace de gestion
const POSITIONS = {
  centre: [50, 50], haut: [50, 0], bas: [50, 100], gauche: [0, 50], droite: [100, 50],
  'haut-gauche': [0, 0], 'haut-droite': [100, 0], 'bas-gauche': [0, 100], 'bas-droite': [100, 100],
};
function cadrer(image, cadrage) {
  if (!cadrage) return image;
  const [x, y] = POSITIONS[cadrage.position] || [image.x ?? 50, image.y ?? 50];
  const borne = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
  return {
    ...image,
    x: cadrage.x !== undefined ? Math.round(borne(cadrage.x, 0, 100)) : x,
    y: cadrage.y !== undefined ? Math.round(borne(cadrage.y, 0, 100)) : y,
    zoom: cadrage.zoom !== undefined ? Math.round(borne(cadrage.zoom, 1, 2.5) * 100) / 100 : image.zoom ?? 1,
  };
}
const decrireCadrage = (im) => {
  if (!im) return '';
  const x = im.x ?? 50; const y = im.y ?? 50; const z = im.zoom ?? 1;
  if (x === 50 && y === 50 && z === 1) return 'cadrage centré';
  const nom = Object.entries(POSITIONS).find(([, [a, b]]) => a === x && b === y)?.[0] || `point ${x} % / ${y} %`;
  return `cadrage ${nom}${z !== 1 ? `, zoom ×${z}` : ''}`;
};
const decrireLien = (b) => (b?.type ? `${NOMS_DESTINATIONS[b.type]}${b.valeur ? ` (${b.type === 'page' ? nomPage(b.valeur) : b.valeur})` : ''}` : '');

// --- Lecture du site -----------------------------------------------------------------------------
async function lireContenu() {
  const { texte } = await lireTexte(CONTENU);
  const c = JSON.parse(texte);
  if (!Array.isArray(c.annonces)) c.annonces = [];
  if (!c.pages || typeof c.pages !== 'object') c.pages = {};
  return c;
}
const structures = new Map();
async function structureDe(fichier) {
  if (!structures.has(fichier)) structures.set(fichier, structurePage((await lireTexte(`site/${fichier}`)).texte));
  return structures.get(fichier);
}
// Photos déjà présentes sur le site (grande et petite version), par dossier
async function photosDisponibles(dossier) {
  let noms;
  try { noms = await listerDossier(DOSSIERS[dossier]); } catch (e) { if (e.statut === 404) return []; throw e; }
  return [...noms].filter((n) => n.endsWith('.jpg') && !n.endsWith('-sm.jpg') && noms.has(n.replace(/\.jpg$/, '-sm.jpg')))
    .map((n) => `${DOSSIERS[dossier].replace(/^site\//, '')}/${n.replace(/\.jpg$/, '')}`).sort();
}
async function verifierPhoto(dossier, src) {
  const liste = await photosDisponibles(dossier);
  const nom = String(src || '').replace(/\.jpg$/, '').split('/').pop();
  const trouvee = liste.find((p) => p.endsWith(`/${nom}`));
  if (!trouvee) throw new ErreurOutil(`Photo introuvable : « ${src} ». Utilisez voir_photos pour la liste des photos disponibles (pour une nouvelle photo : preparer_envoi_photo, puis attendre que l’utilisatrice l’ait envoyée).`);
  return trouvee;
}

// --- Présentation -----------------------------------------------------------------------------------
const horaire = (j) => (j.etat === 'ouvert' ? `${j.debut} – ${j.fin}` : NOMS_ETATS[j.etat] || j.etat);
const dateFr = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const periodeAnnonce = (a) => (a.debut && a.fin ? `du ${dateFr(a.debut)} au ${dateFr(a.fin)}` : a.debut ? `à partir du ${dateFr(a.debut)}` : a.fin ? `jusqu’au ${dateFr(a.fin)}` : 'sans date de fin');
const court = (t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const decrireAnnonce = (a) => `[${a.id}] ${a.format}${a.active === false ? ' (en pause)' : ''} — ${court([a.etiquette, a.titre, a.texte].filter(Boolean).join(' · '), 120)}`
  + `${a.cartes?.length ? ` — cartes : ${a.cartes.map((c) => c.titre).join(', ')}` : ''}${a.image?.src ? ` — photo ${a.image.src} (${decrireCadrage(a.image)})` : ''}${a.bouton?.texte ? ` — bouton « ${a.bouton.texte} » → ${decrireLien(a.bouton)}` : ''}`
  + ` — ${a.emplacement ? `section de la page ${nomPage(a.emplacement.page)} (après ${a.emplacement.apres})` : (a.pages || []).map(nomPage).join(', ')} — ${periodeAnnonce(a)}`;

// Différences entre deux contenus, en phrases simples (aperçu avant publication et résumé après)
async function differences(a, b) {
  const l = [];
  b.horaires.forEach((j, i) => { if (horaire(j) !== horaire(a.horaires[i])) l.push(`Horaires — ${j.jour} : ${horaire(a.horaires[i])} → ${horaire(j)}`); });
  for (const k of ['principal', 'secondaire']) if (a.telephones?.[k] !== b.telephones?.[k]) l.push(`Téléphone ${k} : ${a.telephones?.[k]} → ${b.telephones?.[k]}`);
  for (const [k, nom] of RESEAUX_LISTE) if ((a.reseaux?.[k] || '') !== (b.reseaux?.[k] || '')) l.push(`${nom} : ${a.reseaux?.[k] || '(aucun)'} → ${b.reseaux?.[k] || '(retiré)'}`);

  const sa = new Map(a.services.map((s) => [s.cle, s]));
  const sb = new Map(b.services.map((s) => [s.cle, s]));
  for (const [k, s] of sb) {
    const o = sa.get(k);
    if (!o) { l.push(`Nouvelle coiffure : ${s.nom} (${s.categorie}) — ${s.prix} € — photo ${s.photo}`); continue; }
    if (o.prix !== s.prix) l.push(`${s.nom} : prix ${o.prix} € → ${s.prix} €`);
    if (o.nom !== s.nom) l.push(`Coiffure renommée : « ${o.nom} » → « ${s.nom} »`);
    if (o.categorie !== s.categorie) l.push(`${s.nom} : catégorie ${o.categorie} → ${s.categorie}`);
    if ((o.description || '') !== (s.description || '')) l.push(`${s.nom} : description → « ${s.description} »`);
    if (o.photo !== s.photo) l.push(`${s.nom} : photo → ${s.photo}`);
    if ((o.visible !== false) !== (s.visible !== false)) l.push(`${s.nom} : ${s.visible === false ? 'masquée du site' : 'de nouveau visible'}`);
  }
  for (const [k, s] of sa) if (!sb.has(k)) l.push(`Coiffure supprimée : ${s.nom}`);
  const ordre = (c, autre) => c.services.filter((s) => autre.has(s.cle)).map((s) => s.cle).join();
  if (ordre(a, sb) !== ordre(b, sa)) l.push(`Nouvel ordre des coiffures : ${b.services.map((s) => s.nom).join(', ')}`);

  const aa = new Map(a.annonces.map((x) => [x.id, x]));
  const ab = new Map(b.annonces.map((x) => [x.id, x]));
  for (const [id, x] of ab) {
    if (!aa.has(id)) l.push(`Nouvelle annonce : ${decrireAnnonce(x)}`);
    else if (JSON.stringify(aa.get(id)) !== JSON.stringify(x)) l.push(`Annonce modifiée — avant : ${decrireAnnonce(aa.get(id))}\n   après : ${decrireAnnonce(x)}`);
  }
  for (const [id, x] of aa) if (!ab.has(id)) l.push(`Annonce supprimée : ${decrireAnnonce(x)}`);

  const ga = a.photos.map((p) => p.image); const gb = b.photos.map((p) => p.image);
  for (const p of b.photos) if (!ga.includes(p.image)) l.push(`Galerie — photo ajoutée : ${p.image} (${sb.get(p.style)?.nom || p.style})`);
  for (const p of a.photos) if (!gb.includes(p.image)) l.push(`Galerie — photo retirée : ${p.image}`);
  for (const p of b.photos) { const o = a.photos.find((x) => x.image === p.image); if (o && o.style !== p.style) l.push(`Galerie — ${p.image} classée dans ${sb.get(p.style)?.nom || p.style}`); }
  if (ga.filter((x) => gb.includes(x)).join() !== gb.filter((x) => ga.includes(x)).join()) l.push('Galerie — nouvel ordre des photos');

  if ((a.theme || 'cuivre') !== (b.theme || 'cuivre')) l.push(`Couleurs du site : ${a.theme || 'cuivre'} → ${b.theme || 'cuivre'}`);
  if (JSON.stringify(a.marque?.logo || null) !== JSON.stringify(b.marque?.logo || null)) l.push(`Logo : ${b.marque?.logo?.src || 'logo d’origine'}`);
  if ((a.fonds?.cta || '') !== (b.fonds?.cta || '')) l.push(`Image de la bande de fin de page : ${b.fonds?.cta || 'image d’origine'}`);

  const na = navigationDe(a); const nb = navigationDe(b);
  if (JSON.stringify(na.menu) !== JSON.stringify(nb.menu)) l.push(`Menu : ${nb.menu.map((x) => `${x.texte} (${nomPage(x.page)})`).join(' · ')}`);
  if (JSON.stringify(na.rendezVous) !== JSON.stringify(nb.rendezVous)) l.push(`Bouton de rendez-vous : « ${nb.rendezVous.texte} » (court : « ${nb.rendezVous.court || ''} »), message WhatsApp « ${nb.rendezVous.message} »`);
  if (na.pied.invite !== nb.pied.invite) l.push(`Pied de page — invitation : « ${nb.pied.invite} »`);
  if (na.pied.presentation !== nb.pied.presentation) l.push(`Pied de page — présentation : « ${nb.pied.presentation} »`);
  if (JSON.stringify(na.pied.colonnes) !== JSON.stringify(nb.pied.colonnes)) l.push(`Pied de page — colonnes : ${nb.pied.colonnes.map((c) => `${c.titre} (${c.liens.map((x) => x.texte).join(', ')})`).join(' · ')}`);
  if (JSON.stringify(na.pied.infos) !== JSON.stringify(nb.pied.infos)) l.push(`Pied de page — informations : ${nb.pied.infos.join(' · ')}`);

  for (const f of new Set([...Object.keys(a.pages || {}), ...Object.keys(b.pages || {})])) {
    const pa = a.pages?.[f] || {}; const pb = b.pages?.[f] || {};
    if (JSON.stringify(pa) === JSON.stringify(pb)) continue;
    const st = await structureDe(f).catch(() => []);
    const texteActuel = (id) => st.flatMap((s) => s.textes).find((t) => t.id === id)?.texte;
    const nomSection = (id) => st.find((s) => s.id === id)?.titre || id;
    const page = nomPage(f);
    for (const id of new Set([...Object.keys(pa.textes || {}), ...Object.keys(pb.textes || {})])) {
      const avant = pa.textes?.[id]; const apres = pb.textes?.[id];
      if (avant === apres) continue;
      l.push(apres === undefined ? `${page} — texte ${id} : texte d’origine rétabli` : `${page} — texte ${id} : « ${court(avant ?? texteActuel(id), 70)} » → « ${court(apres, 160)} »`);
    }
    for (const id of new Set([...Object.keys(pa.boutons || {}), ...Object.keys(pb.boutons || {})])) {
      if (JSON.stringify(pa.boutons?.[id]) === JSON.stringify(pb.boutons?.[id])) continue;
      const x = pb.boutons?.[id];
      l.push(x ? `${page} — bouton ${id} : « ${x.texte || '(texte inchangé)'} » → ${decrireLien(x) || 'destination inchangée'}` : `${page} — bouton ${id} : bouton d’origine rétabli`);
    }
    for (const id of new Set([...Object.keys(pa.images || {}), ...Object.keys(pb.images || {})])) {
      if (JSON.stringify(pa.images?.[id]) === JSON.stringify(pb.images?.[id])) continue;
      l.push(`${page} — image ${id} : ${pb.images?.[id]?.src ? `${pb.images[id].src} (${decrireCadrage(pb.images[id])})` : 'image d’origine rétablie'}`);
    }
    if (JSON.stringify(pa.ordre || []) !== JSON.stringify(pb.ordre || [])) l.push(`${page} — nouvel ordre des sections : ${(pb.ordre || []).map(nomSection).join(' → ') || 'ordre d’origine'}`);
    const masA = new Set(pa.masquees || []); const masB = new Set(pb.masquees || []);
    for (const id of masB) if (!masA.has(id)) l.push(`${page} — section masquée : ${nomSection(id)}`);
    for (const id of masA) if (!masB.has(id)) l.push(`${page} — section de nouveau visible : ${nomSection(id)}`);
    const invA = new Set(pa.inversees || []); const invB = new Set(pb.inversees || []);
    for (const id of new Set([...invA, ...invB])) if (invA.has(id) !== invB.has(id)) l.push(`${page} — ${nomSection(id)} : image et texte ${invB.has(id) ? 'inversés' : 'remis à leur place d’origine'}`);
  }
  return l;
}

// Aperçu ou publication d'une modification ; `modifier` change le contenu (copie du contenu en ligne)
async function appliquer(args, resume, modifier) {
  structures.clear();
  const ancien = await lireContenu();
  const nouveau = structuredClone(ancien);
  await modifier(nouveau, ancien);
  for (const [f, p] of Object.entries(nouveau.pages)) {
    for (const k of Object.keys(p)) if (p[k] && typeof p[k] === 'object' && !Object.keys(p[k]).length) delete p[k];
    if (!Object.keys(p).length) delete nouveau.pages[f];
  }
  const lignes = await differences(ancien, nouveau);
  if (!lignes.length) return 'Rien à changer : le site affiche déjà cela.';
  const erreurs = verifierContenu(nouveau);
  if (erreurs.length) throw new ErreurOutil(`Modification refusée : ${erreurs.join(' ')}`);
  const liste = lignes.map((x) => `• ${x}`).join('\n');
  if (args.confirmer !== true) {
    return `APERÇU — rien n’est encore publié.\n${liste}\n\nMontrez ces changements à l’utilisatrice et demandez-lui de confirmer. Si elle est d’accord, rappelez cet outil avec les mêmes paramètres et confirmer: true.`;
  }
  await publierContenuVerifie(nouveau, ancien, { resume: `${resume} (assistant IA)` });
  return `PUBLIÉ ✓\n${liste}\n\nLe site ${DOMAINE} sera à jour dans environ une minute. Pour annuler : espace de gestion → Mon compte → Historique (ou l’outil revenir_version).`;
}

function trouverCoiffure(c, nom) {
  const q = sansAccents(nom);
  let t = c.services.filter((s) => s.cle === nom || sansAccents(s.nom) === q);
  if (!t.length) t = c.services.filter((s) => sansAccents(s.nom).includes(q));
  if (t.length !== 1) throw new ErreurOutil(`${t.length ? 'Plusieurs coiffures correspondent' : 'Coiffure introuvable'} : « ${nom} ». Coiffures du site : ${c.services.map((s) => s.nom).join(', ')}.`);
  return t[0];
}
const versCle = (nom) => nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'coiffure';
const deplacer = (liste, element, position) => {
  const i = liste.indexOf(element);
  liste.splice(i, 1);
  liste.splice(Math.max(0, Math.min(liste.length, Number(position) - 1)), 0, element);
};

// --- Schémas réutilisés ----------------------------------------------------------------------------
const confirmer = { type: 'boolean', description: 'false ou absent : aperçu seulement, rien n’est publié. true : publier, uniquement après l’accord explicite de l’utilisatrice sur l’aperçu.' };
const lien = (description) => ({
  type: 'object', description,
  properties: {
    texte: { type: 'string', maxLength: 60 },
    destination: { type: 'string', enum: Object.keys(DESTINATIONS), description: 'whatsapp : écrire à Nelly (valeur = message pré-rempli, facultatif) ; telephone : numéro ; page : page du site (nom, ex. « Contact » ou « Coiffures et tarifs#carte ») ; lien : adresse https.' },
    valeur: { type: 'string' },
  },
  additionalProperties: false,
});
const date = { type: 'string', description: 'AAAA-MM-JJ, ou chaîne vide pour retirer la date.' };
const champsAnnonce = {
  etiquette: { type: 'string', maxLength: 40, description: 'Petit titre au-dessus du titre.' },
  titre: { type: 'string', maxLength: 90, description: 'Obligatoire sauf pour un bandeau.' },
  texte: { type: 'string', maxLength: 400, description: 'Obligatoire pour un bandeau (160 caractères maximum).' },
  pages: { type: 'array', items: { type: 'string' }, description: `Pages où l’afficher : « toutes » ou parmi ${NOMS_PAGES.join(', ')}. Ignoré pour une section placée dans une page.` },
  debut: date, fin: date,
  bouton: lien('Bouton facultatif (texte vide pour le retirer).'),
  fond: { type: 'string', enum: FONDS, description: 'Fond de la section.' },
  disposition: { type: 'string', enum: ['gauche', 'droite', 'dessus'], description: 'Place de la photo (format section).' },
  photo: { type: 'string', description: 'Photo déjà en ligne (img/annonces/…, voir voir_photos), ou « aucune ».' },
  photo_description: { type: 'string', maxLength: 120, description: 'Description de la photo pour les malvoyants et Google.' },
  cadrage: null, // défini plus bas (schéma partagé avec modifier_page)
  cartes: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'object', properties: { titre: { type: 'string', maxLength: 60 }, texte: { type: 'string', maxLength: 300 } }, required: ['titre'], additionalProperties: false }, description: 'Format cartes : 2 ou 3 cartes.' },
};
const schemaCadrage = {
  type: 'object',
  description: 'Cadrage de la photo dans son cadre (la photo n’est jamais déformée : ce qui dépasse est caché). Ex. « on ne voit pas sa tête » → position haut ; « plus près » → zoom 1.3.',
  properties: {
    position: { type: 'string', enum: Object.keys(POSITIONS), description: 'Partie de la photo à garder visible.' },
    x: { type: 'integer', minimum: 0, maximum: 100, description: 'Réglage fin horizontal (0 = bord gauche, 100 = bord droit).' },
    y: { type: 'integer', minimum: 0, maximum: 100, description: 'Réglage fin vertical (0 = haut, 100 = bas).' },
    zoom: { type: 'number', minimum: 1, maximum: 2.5, description: '1 = photo entière dans le cadre ; jusqu’à 2,5 pour se rapprocher.' },
  },
  additionalProperties: false,
};
champsAnnonce.cadrage = schemaCadrage;
const ecriture = (titre, destructif = false, idempotent = true) => ({ title: titre, readOnlyHint: false, destructiveHint: destructif, idempotentHint: idempotent, openWorldHint: false });
const lecture = (titre) => ({ title: titre, readOnlyHint: true, openWorldHint: false });
const objet = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false });

// Remplit une annonce à partir des paramètres (création ou modification)
async function remplirAnnonce(a, args) {
  for (const k of ['etiquette', 'titre', 'texte', 'debut', 'fin']) if (args[k] !== undefined) a[k] = String(args[k]).trim();
  if (args.fond !== undefined) a.fond = args.fond;
  if (args.disposition !== undefined) a.disposition = args.disposition;
  if (args.pages !== undefined && !a.emplacement) a.pages = pagesAnnonce(args.pages, ['toutes']);
  if (args.bouton !== undefined) a.bouton = String(args.bouton.texte ?? 'x').trim() ? versLien(args.bouton, a.bouton) : { texte: '', type: 'whatsapp', valeur: '' };
  if (args.photo !== undefined) {
    a.image = args.photo === 'aucune' ? null : { src: await verifierPhoto('annonces', args.photo), x: 50, y: 50, zoom: 1, alt: args.photo_description ?? a.image?.alt ?? '', largeur: 1600, hauteur: 1200 };
  } else if (args.photo_description !== undefined && a.image) a.image.alt = args.photo_description;
  if (args.cadrage !== undefined) {
    if (!a.image?.src) throw new ErreurOutil('Cette annonce n’a pas de photo à cadrer.');
    a.image = cadrer(a.image, args.cadrage);
  }
  if (args.cartes !== undefined) a.cartes = args.cartes.map((c, i) => ({ ...(a.cartes?.[i] || {}), titre: String(c.titre).trim(), texte: String(c.texte || '').trim() }));
}

// --- Les outils ---------------------------------------------------------------------------------------
export const OUTILS = [
  {
    name: 'voir_site', annotations: lecture('Voir le contenu du site'),
    description: 'Vue d’ensemble : horaires, coiffures et tarifs (avec identifiants et photos), annonces et sections ajoutées, coordonnées, réseaux, couleurs, menu et pied de page. À appeler avant une modification.',
    inputSchema: objet({}),
    async executer() {
      const c = await lireContenu();
      const nav = navigationDe(c);
      return [
        `Site : ${DOMAINE}`,
        `\nHoraires :\n${c.horaires.map((j) => `• ${j.jour} : ${horaire(j)}`).join('\n')}`,
        `\nCoiffures et tarifs (${c.services.length}, dans l’ordre du site) :\n${c.services.map((s, i) => `${i + 1}. ${s.nom} [${s.cle}] — ${s.categorie} — ${s.prix} €${s.visible === false ? ' — MASQUÉE' : ''} — photo ${s.photo}${s.description ? ` — ${s.description}` : ''}`).join('\n')}`,
        `\nAnnonces et sections ajoutées (${c.annonces.length}) :\n${c.annonces.length ? c.annonces.map((a) => `• ${decrireAnnonce(a)}`).join('\n') : '• aucune'}`,
        `\nGalerie des réalisations : ${c.photos.length} photos (détail : voir_photos)`,
        `Téléphones : ${c.telephones.principal} (principal, WhatsApp) · ${c.telephones.secondaire}`,
        `Réseaux : ${RESEAUX_LISTE.map(([k, n]) => `${n} ${c.reseaux?.[k] || '(aucun)'}`).join(' · ')}`,
        `Couleurs : ${c.theme || 'cuivre'} (possibles : ${Object.keys(THEMES).join(', ')}) · Logo : ${c.marque?.logo?.src || 'd’origine'} · Image de fin de page : ${c.fonds?.cta || 'd’origine'}`,
        `\nMenu : ${nav.menu.map((x) => `${x.texte} (${nomPage(x.page)})`).join(' · ')}`,
        `Bouton de rendez-vous : « ${nav.rendezVous.texte} » / court « ${nav.rendezVous.court || ''} » / message « ${nav.rendezVous.message} »`,
        `Pied de page — invitation : « ${nav.pied.invite} » · présentation : « ${nav.pied.presentation} »`,
        `Pied de page — colonnes : ${nav.pied.colonnes.map((col) => `${col.titre} : ${col.liens.map((x) => `${x.texte} → ${decrireLien(x.lien)}`).join(', ')}`).join(' | ')}`,
        `Pied de page — informations : ${nav.pied.infos.join(' · ')}`,
        `\nPages modifiables (voir_page pour le détail) : ${NOMS_PAGES.join(', ')}`,
      ].join('\n');
    },
  },
  {
    name: 'voir_page', annotations: lecture('Voir une page en détail'),
    description: 'Détail d’une page : ses sections dans l’ordre (identifiants s…), et dans chacune les textes (t…), images (i…) et boutons (b…) modifiables avec modifier_page.',
    inputSchema: objet({ page: { type: 'string', description: `Nom de la page : ${NOMS_PAGES.join(', ')}.` } }, ['page']),
    async executer(args) {
      const f = pageModifiable(args.page);
      structures.clear();
      const st = await structureDe(f);
      const c = await lireContenu();
      const p = c.pages[f] || {};
      return `Page ${nomPage(f)} (${DOMAINE}${PAGES[f].chemin}) — ${st.length} sections, dans l’ordre affiché :\n\n${st.map((s, i) => [
        `■ ${s.id} — ${s.titre}${s.premiere ? ' (en-tête, toujours en premier)' : ''}${s.masquee ? ' — MASQUÉE' : ''}${s.inversible ? ` — image et texte ${s.inversee ? 'inversés' : 'à leur place d’origine'} (inversable)` : ''}${s.ajout ? ` — section ajoutée (annonce ${s.ajout}, à modifier avec modifier_annonce)` : ''}`,
        ...s.textes.map((t) => `   ${t.id} [${t.type}]${p.textes?.[t.id] !== undefined ? ' (modifié)' : ''} : ${court(t.texte, 220)}`),
        ...s.images.map((im) => `   ${im.id} [image] : ${im.alt || 'sans description'} — ${im.src}${p.images?.[im.id] ? ' (remplacée)' : ''}`),
        ...s.boutons.map((b) => `   ${b.id} [bouton] : « ${b.texte} » → ${b.wa ? 'WhatsApp' : b.href}`),
        i === st.length - 1 ? '' : '',
      ].join('\n')).join('\n')}\nDans les textes, *mot* met un mot en valeur et un retour à la ligne est conservé.`;
    },
  },
  {
    name: 'voir_photos', annotations: lecture('Photos disponibles'),
    description: 'Photos déjà en ligne utilisables : galerie des réalisations (dans l’ordre, avec leur coiffure), photos du catalogue (coiffures et galerie), photos d’annonces et photos de pages. Pour une nouvelle photo : preparer_envoi_photo.',
    inputSchema: objet({}),
    async executer() {
      const c = await lireContenu();
      const [catalogue, annonces, pages] = await Promise.all(['catalogue', 'annonces', 'pages'].map(photosDisponibles));
      const nom = (cle) => c.services.find((s) => s.cle === cle)?.nom || cle;
      const enGalerie = new Set(c.photos.map((p) => p.image));
      return [
        `Galerie des réalisations (${c.photos.length}, dans l’ordre du site) :\n${c.photos.map((p, i) => `${i + 1}. ${p.image} — ${nom(p.style)}`).join('\n')}`,
        `\nPhotos du catalogue hors galerie (pour la galerie ou une coiffure) :\n${catalogue.filter((x) => !enGalerie.has(x)).join('\n') || '(aucune)'}`,
        `\nPhotos d’annonces (img/annonces) :\n${annonces.join('\n') || '(aucune)'}`,
        `\nPhotos de pages (img/pages, pour modifier_page et l’image de fin de page) :\n${pages.join('\n') || '(aucune)'}`,
      ].join('\n');
    },
  },
  {
    name: 'preparer_envoi_photo', annotations: ecriture('Préparer l’envoi d’une nouvelle photo', false, false),
    description: 'Pour ajouter une NOUVELLE photo (l’assistant ne peut pas transmettre de fichier) : crée un lien d’envoi à usage unique, valable 20 minutes, que l’utilisatrice ouvre sur son téléphone pour choisir la photo. Renvoie l’emplacement prévu de la photo. Quand elle dit l’avoir envoyée, utilisez cet emplacement avec modifier_galerie, ajouter_coiffure, modifier_coiffure, ajouter_annonce, modifier_annonce, modifier_page ou modifier_style (aperçu puis confirmation, comme toujours). Ne publie rien sur le site.',
    inputSchema: objet({
      usage: { type: 'string', enum: ['realisation', 'annonce', 'page'], description: 'realisation : galerie ou photo d’une coiffure (recadrée en portrait) ; annonce : photo d’annonce ou de section ; page : image d’une page ou de la bande de fin de page.' },
      coiffure: { type: 'string', description: 'Pour une réalisation : la coiffure représentée (nom ou identifiant), qui sert à nommer la photo.' },
    }, ['usage']),
    async executer(args, contexte = {}) {
      const suffixe = Date.now().toString(36);
      let chemin; let u;
      if (args.usage === 'realisation') {
        const c = await lireContenu();
        const s = args.coiffure ? trouverCoiffure(c, args.coiffure) : null;
        chemin = `img/realisations/catalogue/${s ? s.cle : 'realisation'}-${suffixe}`;
        u = s ? `Photo de réalisation : ${s.nom}` : 'Photo de réalisation';
      } else if (args.usage === 'annonce') { chemin = `img/annonces/annonce-${suffixe}`; u = 'Photo pour une annonce'; } else { chemin = `img/pages/page-${suffixe}`; u = 'Photo pour une page du site'; }
      const jeton = signerJeton('envoi', { c: chemin, f: args.usage === 'realisation' ? 'portrait' : 'libre', u, k: suffixe }, 20 * 60);
      const lienEnvoi = `${contexte.base || DOMAINE}/envoi?j=${jeton}`;
      return `Lien d’envoi (à usage unique, valable 20 minutes) — donnez-le tel quel à l’utilisatrice :\n${lienEnvoi}\n\nEmplacement prévu de la photo : ${chemin}\nQuand elle confirme l’envoi, utilisez cet emplacement dans l’outil voulu (aperçu puis confirmation). Si l’outil répond « Photo introuvable », l’envoi n’est pas terminé : demandez-lui de vérifier.`;
    },
  },
  {
    name: 'statistiques', annotations: lecture('Statistiques de visite'),
    description: 'Fréquentation du site (anonyme) : visiteurs, visites, pages vues, prises de contact, provenance, pages, appareils, villes, heures, chemins fréquents, et qui est sur le site en ce moment.',
    inputSchema: objet({ periode: { type: 'string', enum: Object.keys(PERIODES), description: 'Période (7_jours par défaut).' } }),
    async executer(args) {
      if (!statsActives()) return 'Les statistiques ne sont pas encore activées sur ce site.';
      const n = PERIODES[args.periode] || 7;
      const [d, live] = await Promise.all([tableauDeBord(n), direct()]);
      const nom = (p) => d.nomsPages[p] || p;
      const r = d.resume; const av = d.precedent;
      const evol = (x, y) => (y ? ` (${x >= y ? '+' : ''}${Math.round(((x - y) / y) * 100)} % par rapport à la période précédente)` : '');
      const top = (liste, f = (x) => x, max = 6) => (liste.length ? liste.slice(0, max).map(([k, v]) => `${f(k)} ${v}`).join(' · ') : 'aucune donnée');
      const heures = d.heures.map((v, h) => [h, v]).filter(([, v]) => v).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([h, v]) => `${h} h (${v})`).join(', ');
      return [
        `Période : ${n === 1 ? 'aujourd’hui' : `${n} derniers jours`} (${d.periode.debut} → ${d.periode.fin})`,
        `En ce moment : ${live.enLigne} personne(s) sur le site${live.pagesEnLigne.length ? ` — ${live.pagesEnLigne.map(([p, k]) => `${nom(p)} (${k})`).join(', ')}` : ''}`,
        `Visiteurs : ${r.visiteurs}${evol(r.visiteurs, av.visiteurs)}`,
        `Visites : ${r.visites}${evol(r.visites, av.visites)} · pages vues : ${r.vues}`,
        `Prises de contact (WhatsApp + appel) : ${r.contacts}${evol(r.contacts, av.contacts)}`,
        `Temps moyen par page : ${r.dureeMoyenne} s · départ après une seule page : ${r.rebond} % · défilement moyen : ${r.defilement} %`,
        `Provenance : ${top(d.sources)}`,
        `Pages les plus vues : ${top(d.pages, nom)}`,
        `Pages d’arrivée : ${top(d.entrees, nom)} · pages de départ : ${top(d.sorties, nom)}`,
        `Pages d’où partent les contacts : ${top(d.contactsParPage, nom)}`,
        `Clics : ${top(d.actions)}`,
        `Appareils : ${top(d.appareils)} · villes : ${top(d.villes)}`,
        `Heures les plus fréquentées : ${heures || 'aucune donnée'}`,
        `Chemins fréquents : ${top(d.chemins, (x) => x.split(' → ').map(nom).join(' → '), 5)}`,
        'Mesure anonyme et sans cookie ; les visites de Nelly depuis ses appareils ne sont pas comptées.',
      ].join('\n');
    },
  },
  {
    name: 'historique', annotations: lecture('Dernières publications'),
    description: 'Les dernières publications du site, avec leur identifiant (pour revenir_version).',
    inputSchema: objet({}),
    async executer() {
      const liste = await historique(CONTENU, 15);
      return liste.length
        ? `Dernières publications (la plus récente d’abord) :\n${liste.map((v) => `• [${v.sha.slice(0, 7)}] ${new Date(v.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' })} — ${v.message.replace(/^Espace Nelly : /, '')}`).join('\n')}`
        : 'Aucune publication pour l’instant.';
    },
  },
  {
    name: 'revenir_version', annotations: ecriture('Revenir à une version précédente', true),
    description: 'Remet tout le contenu du site tel qu’il était à une publication de l’historique (identifiant donné par historique). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({ version: { type: 'string', description: 'Identifiant de 7 caractères (ou plus) donné par historique.' }, confirmer }, ['version']),
    executer(args) {
      return appliquer(args, 'Retour à une version précédente', async (c) => {
        const v = (await historique(CONTENU, 50)).find((x) => x.sha.startsWith(String(args.version).trim()));
        if (!v || String(args.version).trim().length < 7) throw new ErreurOutil('Version introuvable : utilisez un identifiant donné par historique.');
        const ancien = JSON.parse((await lireTexte(CONTENU, v.sha)).texte);
        for (const k of Object.keys(c)) delete c[k];
        Object.assign(c, ancien);
        if (!Array.isArray(c.annonces)) c.annonces = [];
        if (!c.pages) c.pages = {};
      });
    },
  },
  {
    name: 'modifier_horaires', annotations: ecriture('Modifier les horaires'),
    description: 'Change les horaires d’un ou plusieurs jours (les autres ne bougent pas). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      jours: { type: 'array', minItems: 1, maxItems: 7, items: objet({ jour: { type: 'string', enum: JOURS }, etat: { type: 'string', enum: Object.keys(ETATS), description: 'ouvert (avec debut et fin), ferme, ou sur_demande.' }, debut: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }, fin: { type: 'string', pattern: '^\\d{2}:\\d{2}$' } }, ['jour', 'etat']) },
      confirmer,
    }, ['jours']),
    executer(args) {
      return appliquer(args, 'Horaires', (c) => {
        for (const m of args.jours) {
          const j = c.horaires.find((x) => x.jour === m.jour);
          if (!j || !ETATS[m.etat]) throw new ErreurOutil(`Jour ou état inconnu : ${m.jour} ${m.etat}.`);
          j.etat = ETATS[m.etat];
          if (j.etat === 'ouvert') {
            if (!m.debut || !m.fin) throw new ErreurOutil(`Indiquez l’heure de début et de fin pour ${m.jour}.`);
            j.debut = m.debut; j.fin = m.fin;
          }
        }
      });
    },
  },
  {
    name: 'modifier_coordonnees', annotations: ecriture('Modifier téléphones et réseaux'),
    description: 'Change les numéros de téléphone (le principal sert aussi à WhatsApp, partout sur le site) et les liens des réseaux sociaux. Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      telephone_principal: { type: 'string', description: 'Format 06 12 34 56 78. Sert aussi pour WhatsApp.' },
      telephone_secondaire: { type: 'string', description: 'Format 06 12 34 56 78.' },
      ...Object.fromEntries(RESEAUX_LISTE.map(([k, n]) => [k, { type: 'string', description: `Adresse complète https du compte ${n}${k === 'instagram' ? ' (obligatoire)' : ', ou chaîne vide pour le retirer'}.` }])),
      confirmer,
    }),
    executer(args) {
      return appliquer(args, 'Coordonnées', (c) => {
        if (args.telephone_principal !== undefined) c.telephones.principal = String(args.telephone_principal).trim();
        if (args.telephone_secondaire !== undefined) c.telephones.secondaire = String(args.telephone_secondaire).trim();
        c.reseaux = c.reseaux || {};
        for (const [k] of RESEAUX_LISTE) if (args[k] !== undefined) c.reseaux[k] = String(args[k]).trim();
      });
    },
  },
  {
    name: 'modifier_coiffure', annotations: ecriture('Modifier une coiffure'),
    description: 'Change une coiffure existante : prix, nom, catégorie, description, photo (déjà en ligne, voir voir_photos), visibilité, ou sa position dans la liste. Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      coiffure: { type: 'string', description: 'Nom ou identifiant (voir_site).' },
      prix: { type: 'integer', minimum: 1, maximum: 2000 },
      nom: { type: 'string', maxLength: 60 },
      categorie: { type: 'string', maxLength: 40, description: 'Ex. Tresses, Twists et locks, Tissage, Homme, Enfant.' },
      description: { type: 'string', maxLength: 160 },
      photo: { type: 'string', description: 'Photo du catalogue (img/realisations/catalogue/…).' },
      visible: { type: 'boolean', description: 'false : masquée du site sans être supprimée.' },
      position: { type: 'integer', minimum: 1, description: 'Nouvelle place dans la liste (1 = première).' },
      confirmer,
    }, ['coiffure']),
    executer(args) {
      return appliquer(args, 'Coiffures', async (c) => {
        const s = trouverCoiffure(c, args.coiffure);
        if (args.prix !== undefined) s.prix = Number(args.prix);
        if (args.nom !== undefined && args.nom.trim() !== s.nom) { s.nom = args.nom.trim(); s.alt = `${s.nom}, exemple de coiffure`; }
        if (args.categorie !== undefined) s.categorie = args.categorie.trim();
        if (args.description !== undefined) s.description = args.description.trim();
        if (args.photo !== undefined) s.photo = await verifierPhoto('catalogue', args.photo);
        if (args.visible !== undefined) s.visible = Boolean(args.visible);
        if (args.position !== undefined) deplacer(c.services, s, args.position);
      });
    },
  },
  {
    name: 'ajouter_coiffure', annotations: ecriture('Ajouter une coiffure', false, false),
    description: 'Ajoute une coiffure à la carte des tarifs, avec une photo déjà en ligne (voir_photos ; pour une nouvelle photo : preparer_envoi_photo d’abord). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      nom: { type: 'string', maxLength: 60 }, categorie: { type: 'string', maxLength: 40 }, prix: { type: 'integer', minimum: 1, maximum: 2000 },
      description: { type: 'string', maxLength: 160 }, photo: { type: 'string', description: 'Photo du catalogue (img/realisations/catalogue/…).' },
      position: { type: 'integer', minimum: 1, description: 'Place dans la liste (par défaut : à la fin).' },
      confirmer,
    }, ['nom', 'categorie', 'prix', 'photo']),
    executer(args) {
      return appliquer(args, 'Nouvelle coiffure', async (c) => {
        const nom = args.nom.trim();
        let cle = versCle(nom);
        const prises = new Set(c.services.flatMap((x) => [x.cle, x.ancre]));
        for (let n = 2; prises.has(cle); n++) cle = `${versCle(nom)}-${n}`;
        const s = { cle, ancre: cle, nom, categorie: args.categorie.trim(), description: String(args.description || '').trim(), prix: Number(args.prix), photo: await verifierPhoto('catalogue', args.photo), alt: `${nom}, exemple de coiffure`, visible: true };
        c.services.push(s);
        if (args.position !== undefined) deplacer(c.services, s, args.position);
      });
    },
  },
  {
    name: 'supprimer_coiffure', annotations: ecriture('Supprimer une coiffure', true),
    description: 'Supprime une coiffure de la carte, ainsi que ses photos de la galerie (pour la retirer temporairement, préférer modifier_coiffure avec visible: false). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({ coiffure: { type: 'string' }, confirmer }, ['coiffure']),
    executer(args) {
      return appliquer(args, 'Coiffure supprimée', (c) => {
        const s = trouverCoiffure(c, args.coiffure);
        c.services = c.services.filter((x) => x !== s);
        c.photos = c.photos.filter((p) => p.style !== s.cle);
      });
    },
  },
  {
    name: 'modifier_galerie', annotations: ecriture('Modifier la galerie des réalisations'),
    description: 'Galerie de la page Réalisations : ajouter des photos du catalogue, en retirer, les déplacer ou changer leur coiffure. Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      ajouter: { type: 'array', items: objet({ photo: { type: 'string' }, coiffure: { type: 'string', description: 'Coiffure représentée (nom ou identifiant).' } }, ['photo', 'coiffure']), description: 'Ajoutées en tête de galerie.' },
      retirer: { type: 'array', items: { type: 'string' }, description: 'Photos à retirer de la galerie (le fichier reste disponible).' },
      deplacer: { type: 'array', items: objet({ photo: { type: 'string' }, position: { type: 'integer', minimum: 1 } }, ['photo', 'position']) },
      classer: { type: 'array', items: objet({ photo: { type: 'string' }, coiffure: { type: 'string' } }, ['photo', 'coiffure']), description: 'Changer la coiffure associée à une photo.' },
      confirmer,
    }),
    executer(args) {
      return appliquer(args, 'Galerie', async (c) => {
        const trouver = (photo) => {
          const nom = String(photo).replace(/\.jpg$/, '').split('/').pop();
          const p = c.photos.find((x) => x.image.endsWith(`/${nom}`));
          if (!p) throw new ErreurOutil(`Photo absente de la galerie : ${photo}.`);
          return p;
        };
        for (const x of args.retirer || []) c.photos = c.photos.filter((p) => p !== trouver(x));
        for (const x of [...(args.ajouter || [])].reverse()) {
          const image = await verifierPhoto('catalogue', x.photo);
          if (c.photos.some((p) => p.image === image)) throw new ErreurOutil(`Cette photo est déjà dans la galerie : ${image}.`);
          c.photos.unshift({ style: trouverCoiffure(c, x.coiffure).cle, image });
        }
        for (const x of args.classer || []) trouver(x.photo).style = trouverCoiffure(c, x.coiffure).cle;
        for (const x of args.deplacer || []) deplacer(c.photos, trouver(x.photo), x.position);
      });
    },
  },
  {
    name: 'ajouter_annonce', annotations: ecriture('Ajouter une annonce ou une section', false, false),
    description: 'Ajoute une annonce (congés, promo…) sur une ou plusieurs pages, ou une section placée à un endroit précis d’une page (paramètre section). Formats : bandeau (fine barre en haut, texte seul), encadre (texte), carte (compacte, photo facultative), section (photo et texte), cartes (2 ou 3 petites cartes), appel (bande sombre « réservez »). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      format: { type: 'string', enum: FORMATS_ANNONCE },
      ...champsAnnonce,
      section: objet({ page: { type: 'string' }, apres: { type: 'string', description: 'Identifiant de la section après laquelle la placer (voir_page), ou « fin ».' } }, ['page', 'apres']),
      confirmer,
    }, ['format']),
    executer(args) {
      return appliquer(args, 'Nouvelle annonce', async (c) => {
        const a = { id: `${args.section ? 'section' : 'annonce'}-${Date.now().toString(36)}`, active: true, format: args.format, etiquette: '', titre: '', texte: '', image: null, bouton: { texte: '', type: 'whatsapp', valeur: '' }, pages: [], debut: '', fin: '', fond: 'clair' };
        if (args.section) {
          const f = pageModifiable(args.section.page);
          const apres = String(args.section.apres).trim();
          if (apres !== 'fin' && !(await structureDe(f)).some((s) => s.id === apres)) throw new ErreurOutil(`Section ${apres} introuvable sur la page ${nomPage(f)} (voir_page).`);
          a.emplacement = { page: f, apres };
          a.pages = [f];
        } else a.pages = pagesAnnonce(args.pages, [args.format === 'bandeau' ? 'toutes' : 'Accueil']);
        await remplirAnnonce(a, { ...args, pages: args.section ? undefined : args.pages });
        if (a.format === 'cartes' && !a.cartes) throw new ErreurOutil('Le format cartes demande 2 ou 3 cartes.');
        c.annonces.push(a);
      });
    },
  },
  {
    name: 'modifier_annonce', annotations: ecriture('Modifier une annonce ou une section'),
    description: 'Change une annonce ou une section ajoutée (identifiant donné par voir_site) : textes, dates, pages, bouton, photo et son cadrage, fond, cartes, mise en pause (active: false) ou réactivation, ou déplacement dans sa page (section). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      id: { type: 'string' },
      format: { type: 'string', enum: FORMATS_ANNONCE },
      ...champsAnnonce,
      active: { type: 'boolean', description: 'false : en pause (gardée pour plus tard).' },
      apres: { type: 'string', description: 'Section ajoutée seulement : identifiant de la section après laquelle la déplacer, ou « fin ».' },
      confirmer,
    }, ['id']),
    executer(args) {
      return appliquer(args, 'Annonce modifiée', async (c) => {
        const a = c.annonces.find((x) => x.id === args.id);
        if (!a) throw new ErreurOutil(`Annonce introuvable : ${args.id} (voir_site).`);
        if (args.format !== undefined) a.format = args.format;
        await remplirAnnonce(a, args);
        if (args.active !== undefined) a.active = Boolean(args.active);
        if (args.apres !== undefined) {
          if (!a.emplacement) throw new ErreurOutil('Seule une section placée dans une page peut être déplacée ainsi.');
          if (args.apres !== 'fin' && !(await structureDe(a.emplacement.page)).some((s) => s.id === args.apres)) throw new ErreurOutil(`Section ${args.apres} introuvable (voir_page).`);
          a.emplacement.apres = args.apres;
        }
      });
    },
  },
  {
    name: 'supprimer_annonce', annotations: ecriture('Supprimer une annonce ou une section', true),
    description: 'Retire une annonce ou une section ajoutée (pour une pause, préférer modifier_annonce avec active: false). Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({ id: { type: 'string' }, confirmer }, ['id']),
    executer(args) {
      return appliquer(args, 'Annonce retirée', (c) => {
        if (!c.annonces.some((x) => x.id === args.id)) throw new ErreurOutil(`Annonce introuvable : ${args.id} (voir_site).`);
        c.annonces = c.annonces.filter((x) => x.id !== args.id);
      });
    },
  },
  {
    name: 'modifier_page', annotations: ecriture('Modifier une page'),
    description: 'Modifie une page du site avec les identifiants donnés par voir_page : textes (t…), boutons (b…), images (i…, avec une photo de page déjà en ligne, et leur cadrage), ordre des sections (s…), sections masquées ou réaffichées, image et texte inversés. Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      page: { type: 'string' },
      textes: { type: 'object', additionalProperties: { type: 'string', maxLength: 2000 }, description: '{ "t12": "nouveau texte" } — *mot* pour mettre en valeur.' },
      remettre_textes: { type: 'array', items: { type: 'string' }, description: 'Textes à remettre comme à l’origine.' },
      boutons: { type: 'object', additionalProperties: lien('Bouton'), description: '{ "b3": { "texte": "…", "destination": "page", "valeur": "Contact" } }' },
      remettre_boutons: { type: 'array', items: { type: 'string' } },
      images: { type: 'object', additionalProperties: objet({ photo: { type: 'string', description: 'img/pages/… (voir_photos), ou « origine ». Facultatif pour seulement recadrer une photo déjà remplacée.' }, description: { type: 'string', maxLength: 120 }, cadrage: schemaCadrage }), description: '{ "i4": { "photo": "img/pages/…", "cadrage": { "position": "haut" } } }' },
      ordre: { type: 'array', items: { type: 'string' }, description: 'Identifiants des sections dans le nouvel ordre (l’en-tête reste en premier).' },
      masquer: { type: 'array', items: { type: 'string' } },
      afficher: { type: 'array', items: { type: 'string' } },
      inverser: { type: 'array', items: { type: 'string' }, description: 'Sections « inversables » : image et texte changent de côté.' },
      remettre_disposition: { type: 'array', items: { type: 'string' } },
      confirmer,
    }, ['page']),
    executer(args) {
      return appliquer(args, `Page ${args.page}`, async (c) => {
        const f = pageModifiable(args.page);
        const st = await structureDe(f);
        const p = c.pages[f] || (c.pages[f] = {});
        const existe = (liste, id, quoi) => { if (!liste.some((x) => x.id === id)) throw new ErreurOutil(`${quoi} ${id} introuvable sur la page ${nomPage(f)} (voir_page).`); };
        const textes = st.flatMap((s) => s.textes); const boutons = st.flatMap((s) => s.boutons); const images = st.flatMap((s) => s.images);
        for (const [id, t] of Object.entries(args.textes || {})) {
          existe(textes, id, 'Texte');
          if (!String(t).trim()) throw new ErreurOutil(`Le texte ${id} ne peut pas être vide.`);
          (p.textes ||= {})[id] = String(t).trim();
        }
        for (const id of args.remettre_textes || []) delete p.textes?.[id];
        for (const [id, b] of Object.entries(args.boutons || {})) { existe(boutons, id, 'Bouton'); (p.boutons ||= {})[id] = versLien(b, p.boutons?.[id] || {}); }
        for (const id of args.remettre_boutons || []) delete p.boutons?.[id];
        for (const [id, im] of Object.entries(args.images || {})) {
          existe(images, id, 'Image');
          if (im.photo === 'origine') { delete p.images?.[id]; continue; }
          const actuelle = p.images?.[id];
          const src = im.photo ? await verifierPhoto('pages', im.photo) : actuelle?.src;
          if (!src) throw new ErreurOutil(`Indiquez la photo de l’image ${id}.`);
          const base = im.photo ? { x: 50, y: 50, zoom: 1 } : { x: actuelle.x, y: actuelle.y, zoom: actuelle.zoom };
          (p.images ||= {})[id] = cadrer({ ...(actuelle || {}), src, ...base, alt: im.description ?? actuelle?.alt ?? images.find((x) => x.id === id).alt }, im.cadrage);
        }
        const autres = st.filter((s) => !s.premiere).map((s) => s.id);
        if (args.ordre) {
          // Un doublon ne doit jamais faire apparaître deux fois une même section publiée.
          const ordre = [...new Set(args.ordre.filter((id) => id !== st[0]?.id))];
          ordre.forEach((id) => existe(st, id, 'Section'));
          p.ordre = [...ordre, ...autres.filter((id) => !ordre.includes(id))];
        }
        const ensemble = (cle, ajouter, retirer, verif) => {
          const s = new Set(p[cle] || []);
          for (const id of ajouter || []) { existe(st, id, 'Section'); verif?.(id); s.add(id); }
          for (const id of retirer || []) s.delete(id);
          p[cle] = [...s];
        };
        ensemble('masquees', args.masquer, args.afficher);
        ensemble('inversees', args.inverser, args.remettre_disposition, (id) => { if (!st.find((s) => s.id === id).inversible) throw new ErreurOutil(`La section ${id} ne peut pas être inversée.`); });
      });
    },
  },
  {
    name: 'modifier_menu', annotations: ecriture('Modifier le menu et le pied de page'),
    description: 'Menu principal (2 à 7 liens), bouton de rendez-vous de l’en-tête, et pied de page (invitation, présentation, colonnes de liens, lignes d’informations). Chaque partie fournie remplace l’actuelle. Deux temps : aperçu, puis confirmer: true après accord.',
    inputSchema: objet({
      menu: { type: 'array', minItems: 2, maxItems: 7, items: objet({ texte: { type: 'string', maxLength: 30 }, page: { type: 'string' } }, ['texte', 'page']) },
      bouton_rendez_vous: objet({ texte: { type: 'string', maxLength: 30 }, court: { type: 'string', maxLength: 16 }, message: { type: 'string', maxLength: 300, description: 'Message WhatsApp pré-rempli.' } }),
      invitation: { type: 'string', maxLength: 140, description: '*mot* pour mettre en valeur.' },
      presentation: { type: 'string', maxLength: 300 },
      colonnes: { type: 'array', maxItems: 3, items: objet({ titre: { type: 'string' }, liens: { type: 'array', maxItems: 10, items: lien('Lien') } }, ['titre', 'liens']) },
      informations: { type: 'array', maxItems: 5, items: { type: 'string' } },
      confirmer,
    }),
    executer(args) {
      return appliquer(args, 'Menu et pied de page', (c) => {
        const nav = structuredClone(navigationDe(c));
        if (args.menu) nav.menu = args.menu.map((x) => ({ texte: x.texte.trim(), page: lienPage(x.page) }));
        if (args.bouton_rendez_vous) nav.rendezVous = { ...nav.rendezVous, ...Object.fromEntries(Object.entries(args.bouton_rendez_vous).map(([k, v]) => [k, String(v).trim()])) };
        if (args.invitation !== undefined) nav.pied.invite = args.invitation.trim();
        if (args.presentation !== undefined) nav.pied.presentation = args.presentation.trim();
        if (args.colonnes) nav.pied.colonnes = args.colonnes.map((col) => ({ titre: col.titre.trim(), liens: col.liens.map((x) => ({ texte: String(x.texte || '').trim(), lien: (({ texte, ...l }) => l)(versLien(x)) })) }));
        if (args.informations) nav.pied.infos = args.informations.map((x) => x.trim()).filter(Boolean);
        c.navigation = nav;
      });
    },
  },
  {
    name: 'modifier_style', annotations: ecriture('Modifier le style du site'),
    description: `Couleurs du site (${Object.keys(THEMES).join(', ')}), image de la bande de fin de page (photo de page déjà en ligne, ou « origine »), ou retour au logo d’origine. Un nouveau logo s’envoie depuis l’espace de gestion. Deux temps : aperçu, puis confirmer: true après accord.`,
    inputSchema: objet({
      couleurs: { type: 'string', enum: Object.keys(THEMES) },
      image_fin_de_page: { type: 'string', description: 'img/pages/… (voir_photos) ou « origine ».' },
      logo_origine: { type: 'boolean', description: 'true : remettre le logo d’origine.' },
      confirmer,
    }),
    executer(args) {
      return appliquer(args, 'Style du site', async (c) => {
        if (args.couleurs !== undefined) { if (args.couleurs === 'cuivre') delete c.theme; else c.theme = args.couleurs; }
        if (args.image_fin_de_page !== undefined) {
          if (args.image_fin_de_page === 'origine') { if (c.fonds) delete c.fonds.cta; } else (c.fonds ||= {}).cta = await verifierPhoto('pages', args.image_fin_de_page);
          if (c.fonds && !Object.keys(c.fonds).length) delete c.fonds;
        }
        if (args.logo_origine === true && c.marque) { delete c.marque.logo; if (!Object.keys(c.marque).length) delete c.marque; }
      });
    },
  },
];
