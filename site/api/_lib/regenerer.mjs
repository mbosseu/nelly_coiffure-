import { createHash } from 'node:crypto';
import { marquer, appliquerPages, retirerAjouts } from './pages.mjs';
import { appliquerNavigation, verifierNavigation } from './navigation.mjs';

// Générateur commun du site : à partir du contenu modifiable (contenu/site.json) et des pages HTML actuelles,
// produit les pages à jour. Utilisé par outils/seo.mjs (sur le poste) et par l'API de l'espace de gestion (sur Vercel),
// pour que les deux donnent toujours exactement le même résultat.
// Les pages restent du HTML statique complet : Google lit le contenu sans exécuter de JavaScript.
//
// Zones gérées :
// - <!-- cms:coiffures --> … <!-- /cms:coiffures --> (coiffures.html) : cartes des prestations
// - <!-- cms:filtres --> et <!-- cms:galerie --> (realisations.html) : filtres et photos
// - <!-- cms:horaires --> (contact.html) : tableau des horaires
// - <!-- cms:annonce --> (chaque page) : bandeau d'annonce
// - <span data-prix="cle [cle…]">60 €</span> (toutes les pages) : prix repris dans les textes (plusieurs clés = le moins cher)
// - téléphones : remplacés partout (pages et js/main.js) quand ils changent
// - balises de référencement, données structurées, sitemap.xml et robots.txt

export const DOMAINE = 'https://www.nellycoiffure.fr';
// Code de vérification Google Search Console (méthode « balise HTML ») : inutile, la propriété Domaine est validée par DNS
const GOOGLE_VERIFICATION = '';
// Liens officiels : ils renforcent l'identité du salon pour Google
const RESEAUX = [
  'https://www.instagram.com/nellycoiffure237/',
  'https://www.tiktok.com/@nellycoiffure237',
  'https://www.facebook.com/share/1CFM1XgV6n/',
  'https://snapchat.com/t/rsEMEsWo',
];
// Lien de la fiche Google Business Profile, à coller ici dès qu'elle existe (ex. https://maps.app.goo.gl/…)
const FICHE_GOOGLE = 'https://www.google.com/maps?cid=3752189097885765897';

const NOM = 'Nelly Coiffure';
const IMAGE = `${DOMAINE}/img/marque/partage.jpg`;
const VILLES = ['Marseille', 'Aubagne', 'Allauch', 'Plan-de-Cuques', 'Les Pennes-Mirabeau', 'Septèmes-les-Vallons', 'Cassis'];

// Une page = un sujet et ses mots-clés. h1 : titre principal lu en premier par Google (affiché comme surtitre).
// Dans les descriptions, {prix:cle} et {min} sont remplacés par les prix du contenu.
export const PAGES = {
  'index.html': {
    chemin: '/', priorite: '1.0',
    titre: 'Tresses africaines à Marseille, à domicile | Nelly Coiffure',
    description: 'Coiffeuse afro à Marseille : knotless braids, tresses couchées, twists, locks, tissage, dès {min} €. Chez moi ou à votre domicile, rendez-vous sur WhatsApp.',
    h1: 'Coiffeuse tresses africaines <br>à Marseille',
  },
  'coiffures.html': {
    chemin: '/coiffures.html', priorite: '0.9', ariane: 'Coiffures et tarifs',
    titre: 'Tarifs tresses, locks, twists à Marseille | Nelly Coiffure',
    description: 'Prix des tresses africaines à Marseille : knotless et box braids {prix:knotless-braids} €, locks {prix:locks} €, twists, tissage, nattes collées, coiffures homme et enfant dès {min} €.',
    h1: 'Coiffures afro et tarifs à Marseille',
  },
  'realisations.html': {
    chemin: '/realisations.html', priorite: '0.8', ariane: 'Réalisations',
    titre: 'Réalisations tresses et locks à Marseille | Nelly Coiffure',
    description: 'Photos de coiffures réalisées par Nelly à Marseille : knotless braids, locks, twists, tresses couchées, nattes collées. Demandez le même style sur WhatsApp.',
    h1: 'Réalisations de tresses africaines à Marseille',
  },
  'a-propos.html': {
    chemin: '/a-propos.html', priorite: '0.6', ariane: 'À propos',
    titre: 'Nelly, coiffeuse afro à Marseille | Nelly Coiffure',
    description: 'Nelly, coiffeuse spécialisée en tresses africaines à Marseille : son histoire, ses engagements (douceur, hygiène, écoute) et les avis de ses clientes.',
    h1: 'Nelly, coiffeuse afro à Marseille',
  },
  'contact.html': {
    chemin: '/contact.html', priorite: '0.8', ariane: 'Contact',
    titre: 'Rendez-vous coiffure afro Marseille | Nelly Coiffure',
    description: 'Prenez rendez-vous pour vos tresses africaines à Marseille : écrivez à Nelly sur WhatsApp. Chez elle ou à domicile, Marseille et alentours.',
    h1: 'Rendez-vous coiffure afro à Marseille',
  },
  'knotless-braids-marseille.html': {
    chemin: '/knotless-braids-marseille.html', priorite: '0.8', ariane: 'Knotless braids',
    description: 'Knotless braids à Marseille dès {prix:knotless-braids} €, short braids {prix:short-braids} € : des box braids sans nœud, légères et naturelles. Chez Nelly (13004) ou à domicile.',
  },
  'locks-marseille.html': {
    chemin: '/locks-marseille.html', priorite: '0.8', ariane: 'Locks',
    description: 'Pose de locks à Marseille : locks longues au rendu bohème dès {prix:locks} €, locks courtes au carré dès {prix:locks-courtes} €. Chez Nelly (13004) ou à domicile.',
  },
  'tresses-enfant-marseille.html': {
    chemin: '/tresses-enfant-marseille.html', priorite: '0.8', ariane: 'Tresses enfant',
    description: 'Tresses pour enfant à Marseille dès {min:tresses-couchees-enfant nattes-collees} € : tresses couchées et nattes collées posées en douceur, chez Nelly (13004) ou à votre domicile.',
  },
  'coiffure-afro-domicile-marseille.html': {
    chemin: '/coiffure-afro-domicile-marseille.html', priorite: '0.8', ariane: 'Coiffure à domicile',
    description: 'Tresses africaines à domicile à Marseille et alentours : knotless braids, locks, twists, nattes collées dès {min} €. Nelly se déplace chez vous.',
  },
  'conseils-tresses-africaines.html': {
    chemin: '/conseils-tresses-africaines.html', priorite: '0.7', ariane: 'Conseils tresses', article: true,
  },
  'mentions-legales.html': { chemin: '/mentions-legales.html', ariane: 'Mentions légales', robots: 'noindex, follow' },
  'confidentialite.html': { chemin: '/confidentialite.html', ariane: 'Confidentialité', robots: 'noindex, follow' },
  '404.html': { chemin: '/404.html', robots: 'noindex, follow' },
};

// Fichiers lus et réécrits par le générateur (chemins relatifs au dossier site/)
export const FICHIERS = [...Object.keys(PAGES), 'tarifs.html', 'js/main.js', 'css/style.css', 'sitemap.xml', 'robots.txt'];

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const texte = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Téléphone affiché (06 04 02 32 90) → +33604023290 et 33604023290 (WhatsApp)
export const formatsTelephone = (affiche) => {
  const chiffres = String(affiche).replace(/\D/g, '').replace(/^0/, '');
  return { affiche: String(affiche).trim(), international: `+33${chiffres}`, whatsapp: `33${chiffres}` };
};

const visibles = (contenu) => contenu.services.filter((s) => s.visible !== false);
const prixDe = (contenu, cles) => {
  const liste = cles.map((c) => contenu.services.find((s) => s.cle === c)).filter((s) => s && s.visible !== false);
  return liste.length ? Math.min(...liste.map((s) => Number(s.prix))) : null;
};
const prixMin = (contenu) => Math.min(...visibles(contenu).map((s) => Number(s.prix)));
const prixMax = (contenu) => Math.max(...visibles(contenu).map((s) => Number(s.prix)));
const remplirPrix = (modele, contenu) => modele
  .replace(/\{prix:([a-z0-9-]+)\}/g, (m, c) => prixDe(contenu, [c]) ?? m)
  .replace(/\{min:([a-z0-9 -]+)\}/g, (m, c) => prixDe(contenu, c.split(' ')) ?? m)
  .replace(/\{min\}/g, () => prixMin(contenu));

// Remplace le contenu d'une zone <!-- cms:nom --> … <!-- /cms:nom --> (en gardant les marqueurs)
const zone = (h, nom, rendu) => {
  const re = new RegExp(`(<!-- cms:${nom} -->)[\\s\\S]*?([ \\t]*<!-- /cms:${nom} -->)`);
  return re.test(h) ? h.replace(re, (m, debut, fin) => `${debut}${rendu}${fin}`) : h;
};

// --- Rendus HTML ---------------------------------------------------------------

const avecPhotos = (contenu, cle) => contenu.photos.some((p) => p.style === cle);

// --- Albums (plusieurs photos et vidéos pour une coiffure, comme un post Instagram) ---
// Un média : { image: 'img/realisations/catalogue/…', video?: { src: 'video/…', largeur, hauteur, duree } }.
// Coiffure : photo (première image de l'album) + suite[]. Galerie : image, video éventuelle + suite[].
export const suiteDe = (x) => (Array.isArray(x?.suite) ? x.suite : []);
export const IMAGE_CATALOGUE = /^img\/realisations\/catalogue\/[a-z0-9-]+$/;
export const VIDEO_SRC = /^video\/[a-z0-9-]+$/;
export const MAX_ALBUM = 20;
// Toutes les vidéos utilisées par le contenu (sans extension)
export const videosUtilisees = (c) => [...new Set([
  ...(c.services || []).flatMap((s) => suiteDe(s).map((m) => m.video?.src)),
  ...(c.photos || []).flatMap((p) => [p.video?.src, ...suiteDe(p).map((m) => m.video?.src)]),
  ...(c.annonces || []).flatMap((a) => [a.video?.src, a.video?.leger]),
].filter(Boolean))];
// Toutes les images d'albums (la photo principale n'en fait pas partie)
export const imagesAlbums = (c) => [...new Set([...(c.services || []), ...(c.photos || [])].flatMap((x) => suiteDe(x).map((m) => m.image)))];

const mediaPublic = (m) => (m.video
  ? { i: m.image, v: m.video.src, l: Number(m.video.largeur), h: Number(m.video.hauteur) }
  : { i: m.image });
// Attribut lu par la visionneuse (js/main.js)
const attributMedias = (medias) => ` data-medias="${echapper(JSON.stringify(medias.map(mediaPublic)))}"`;
const ICONE_ALBUM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2.5" fill="currentColor"/><path d="M8 3.5h9.5A3 3 0 0 1 20.5 6.5V16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICONE_LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.2-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z" fill="currentColor"/></svg>';
// Pastilles posées sur la vignette : vidéo et nombre d'éléments de l'album
const pastilles = (medias) => {
  const avecVideo = medias.some((m) => m.video);
  if (medias.length < 2 && !avecVideo) return '';
  return `<span class="album-pastilles">${avecVideo ? `<span class="album-pastille" title="Vidéo">${ICONE_LECTURE}</span>` : ''}${medias.length > 1 ? `<span class="album-pastille">${ICONE_ALBUM}<b>${medias.length}</b></span>` : ''}</span>`;
};

const carteCoiffure = (s, contenu, NL) => {
  const nom = echapper(s.nom);
  const img = `<img src="${s.photo}.jpg" srcset="${s.photo}-sm.jpg 500w, ${s.photo}.jpg 1000w" sizes="(min-width: 1025px) 30vw, 46vw" width="1000" height="1250" loading="lazy" alt="${echapper(s.alt || `${s.nom}, exemple de coiffure`)}">`;
  const galerie = avecPhotos(contenu, s.cle);
  const medias = [{ image: s.photo }, ...suiteDe(s)];
  const lignes = [
    `          <article class="service-card reveal" id="${s.ancre}">`,
    medias.length > 1
      ? `            <button type="button" class="service-card__media service-card__media--album" data-album${attributMedias(medias)} data-label="${nom} (${Number(s.prix)} €)" aria-label="Voir les ${medias.length} photos et vidéos : ${nom}">${img}${pastilles(medias)}</button>`
      : galerie
      ? `            <a class="service-card__media" href="realisations.html?style=${s.cle}#galerie" aria-label="Voir les réalisations : ${nom}">${img}</a>`
      : `            <div class="service-card__media">${img}</div>`,
    '            <div class="service-card__body">',
    `              <p class="service-card__type">${echapper(s.categorie)}</p>`,
    `              <h3>${nom}</h3>`,
    `              <p class="service-card__desc">${echapper(s.description)}</p>`,
    '              <div class="service-card__footer">',
    `                <span class="service-card__price">${Number(s.prix)} €</span>`,
    `                <a class="service-card__book" data-wa="Bonjour Nelly, je suis intéressée par : ${nom}. Pouvez-vous me donner vos disponibilités ?" href="contact.html">Demander un rendez-vous</a>`,
    '              </div>',
    galerie
      ? `              <a class="service-card__more" href="realisations.html?style=${s.cle}#galerie">Voir les exemples dans la galerie <svg class="arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>`
      : '              <span class="service-card__more service-card__more--quiet">Une réalisation en photo</span>',
    '            </div>',
    '          </article>',
  ];
  return lignes.join(NL);
};

const photosAffichees = (contenu) => contenu.photos
  .map((p) => ({ ...p, service: contenu.services.find((s) => s.cle === p.style && s.visible !== false) }))
  .filter((p) => p.service);

// Numéro de la photo dans le texte alternatif : celui du fichier (knotless-braids-3 → 3) ;
// les photos ajoutées depuis l'espace de gestion ont un nom horodaté, on prend alors leur rang dans le style
const numeroPhoto = (photos, i) => {
  const n = (photos[i].image.match(/-(\d+)$/) || [])[1];
  if (n && n.length <= 4) return n;
  return String(photos.slice(0, i + 1).filter((p) => p.style === photos[i].style).length);
};

const rendreGalerie = (contenu, NL) => {
  const photos = photosAffichees(contenu);
  return photos.map((p, i) => {
    const { image, style, service: s } = p;
    const nom = echapper(s.nom);
    const medias = [{ image, ...(p.video ? { video: p.video } : {}) }, ...suiteDe(p)];
    const album = medias.length > 1 || p.video ? attributMedias(medias) : '';
    return `          <button type="button" class="gallery__item reveal" data-cat="${style}" data-label="${nom} (${Number(s.prix)} €)"${album}><img src="${image}.jpg" srcset="${image}-sm.jpg 500w, ${image}.jpg 1000w" sizes="(min-width: 1025px) 33vw, 50vw" width="1000" height="1250" loading="lazy" alt="${nom} par Nelly Coiffure à Marseille, photo ${numeroPhoto(photos, i)}">${pastilles(medias)}<span class="gallery__cap"><b>${nom}</b><span>${Number(s.prix)} €</span></span></button>`;
  }).join(NL);
};

const rendreFiltres = (contenu, NL) => {
  const photos = photosAffichees(contenu);
  const styles = [...new Set(photos.map((p) => p.style))].sort((a, b) => a.localeCompare(b));
  return [
    `          <button type="button" class="chip" aria-pressed="true" data-filter="tout">Tout <small>${photos.length}</small></button>`,
    ...styles.map((st) => `          <button type="button" class="chip" aria-pressed="false" data-filter="${st}">${echapper(photos.find((p) => p.style === st).service.nom)} <small>${photos.filter((p) => p.style === st).length}</small></button>`),
  ].join(NL);
};

const heure = (h) => { const [hh, mm] = h.split(':'); return `${Number(hh)} h${mm !== '00' ? ` ${mm}` : ''}`; };
const valeurHoraire = (j) => (j.etat === 'ouvert' ? `${heure(j.debut)} – ${heure(j.fin)}` : j.etat === 'demande' ? 'Sur demande' : 'Fermé');

// Jours consécutifs identiques regroupés : « Lundi – vendredi : 9 h – 19 h »
const groupesHoraires = (contenu) => {
  const groupes = [];
  contenu.horaires.forEach((j, i) => {
    const v = valeurHoraire(j);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.valeur === v && dernier.fin === i - 1) dernier.fin = i;
    else groupes.push({ debut: i, fin: i, valeur: v });
  });
  return groupes;
};

const rendreHoraires = (contenu, NL) => [
  '            <dl class="hours">',
  ...groupesHoraires(contenu).map((g) => {
    const jours = g.debut === g.fin ? majuscule(JOURS[g.debut]) : `${majuscule(JOURS[g.debut])} – ${JOURS[g.fin]}`;
    return `              <div><dt>${jours}</dt><dd>${g.valeur}</dd></div>`;
  }),
  '            </dl>',
].join(NL);

// --- Annonces -------------------------------------------------------------------
// Chaque annonce choisit son format : « section » (image + texte + bouton), « carte » (plus compacte),
// « encadre » (texte seul) ou « bandeau » (barre fine en haut de page, facultative).
// Elle s'affiche sur les pages choisies, entre ses dates de début et de fin (vérifiées à la publication
// et, pour les dates à venir, par js/main.js chez le visiteur).

export const FORMATS_ANNONCE = ['section', 'carte', 'encadre', 'bandeau', 'cartes', 'appel'];
export const FONDS = ['clair', 'transparent', 'sombre'];
// Pages où une annonce peut apparaître (dans l'ordre du menu)
export const PAGES_ANNONCES = [
  ['index.html', 'Accueil'], ['coiffures.html', 'Coiffures et tarifs'], ['realisations.html', 'Réalisations'],
  ['a-propos.html', 'À propos'], ['contact.html', 'Contact'], ['knotless-braids-marseille.html', 'Knotless braids'],
  ['locks-marseille.html', 'Locks'], ['tresses-enfant-marseille.html', 'Tresses enfant'],
  ['coiffure-afro-domicile-marseille.html', 'Coiffure à domicile'], ['conseils-tresses-africaines.html', 'Conseils tresses'],
];

// Ancien format (une seule annonce texte en bandeau) → liste d'annonces
export const annoncesDe = (contenu) => {
  if (Array.isArray(contenu.annonces)) return contenu.annonces;
  const a = contenu.annonce || {};
  return String(a.texte || '').trim() ? [{ id: 'annonce-1', active: !!a.active, format: 'bandeau', titre: '', texte: a.texte, pages: ['toutes'] }] : [];
};

// Les sections ajoutées dans une page (emplacement choisi) sont placées par pages.mjs, pas dans la zone des annonces
const annoncesVisibles = (contenu, fichier, aujourdhui) => annoncesDe(contenu).filter((a) => a.active && !a.emplacement
  && (a.pages || []).some((p) => p === 'toutes' || p === fichier)
  && !(a.fin && a.fin < aujourdhui));

// Sections ajoutées à une page, avec leur emplacement : [{ apres, html }]
const sectionsAjoutees = (contenu, fichier, aujourdhui, NL) => annoncesDe(contenu)
  .filter((a) => a.active && a.emplacement?.page === fichier && !(a.fin && a.fin < aujourdhui))
  .map((a) => ({ apres: a.emplacement.apres, html: rendrePromo(a, aujourdhui, NL, true) }));

// Destination d'un bouton : WhatsApp (message prérempli), page du site, téléphone ou lien externe
export const attributsLien = (b) => {
  const v = String(b?.valeur || '').trim();
  if (b?.type === 'whatsapp') return `data-wa="${echapper(v || 'Bonjour Nelly, je souhaite prendre rendez-vous pour une coiffure.')}" href="contact.html"`;
  if (b?.type === 'telephone') return `href="tel:${formatsTelephone(v).international}"`;
  if (b?.type === 'externe') return `href="${echapper(v)}" target="_blank" rel="noopener"`;
  return `href="${echapper(v || 'contact.html')}"`;
};

const dates = (a, aujourdhui) => `${a.debut ? ` data-debut="${a.debut}"` : ''}${a.fin ? ` data-fin="${a.fin}"` : ''}${a.debut && a.debut > aujourdhui ? ' hidden' : ''}`;

// Cadre adapté à l'orientation de la photo : une photo en largeur n'est pas rognée dans un cadre en hauteur
const classeMedia = (img) => `promo__media${Number(img?.largeur) > Number(img?.hauteur) * 1.1 ? ' promo__media--paysage' : ''}`;

// Vidéo d'une annonce : le cadre prend la forme de la vidéo (rien n'est coupé) ; rien n'est téléchargé avant la lecture
const videoAnnonce = (a) => {
  const img = a.image; const v = a.video;
  return `<video src="${v.src}.mp4" poster="${img.src}.jpg" width="${Number(v.largeur)}" height="${Number(v.hauteur)}" controls playsinline preload="none" controlslist="nodownload" aria-label="${echapper(img.alt || a.titre || 'Vidéo de Nelly Coiffure')}"></video>`;
};

const imageAnnonce = (img, tailles) => {
  if (!img?.src) return '';
  const x = Number(img.x ?? 50); const y = Number(img.y ?? 50); const z = Number(img.zoom ?? 1);
  const style = `object-position: ${x}% ${y}%${z !== 1 ? `; transform: scale(${z}); transform-origin: ${x}% ${y}%` : ''}`;
  return `<img src="${img.src}.jpg" srcset="${img.src}-sm.jpg 800w, ${img.src}.jpg 1600w" sizes="${tailles}" width="${img.largeur || 1600}" height="${img.hauteur || 1200}" loading="lazy" alt="${echapper(img.alt || '')}" style="${style}">`;
};

const boutonAnnonce = (a, classe) => (String(a.bouton?.texte || '').trim()
  ? `<a class="${classe}" ${attributsLien(a.bouton)}>${a.bouton.type === 'whatsapp' ? '<svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg> ' : ''}${echapper(a.bouton.texte.trim())} <svg class="arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>`
  : '');

// Un titre avec un très long mot s'écrit un peu plus petit sur téléphone, pour que le mot ne soit pas coupé
const motLong = (t) => String(t).split(/\s+/).some((m) => m.replace(/[^\p{L}]/gu, '').length >= 12);

const paragraphe = (t, classe = 'body', champ = '') => (String(t || '').trim() ? `<p class="${classe}"${champ}>${echapper(t.trim()).replace(/[ \t]*\n[ \t]*/g, ' <br>')}</p>` : '');

// --- Section film (annonce avec video + film: { accroche, atouts, lire }) ---
// Vraie section du site : titre et texte lisibles par Google, décor dessiné (net à toute taille), vidéo dans un cadre doré.
const sansEmoji = (t) => String(t || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, ' ').replace(/[ \t]+/g, ' ').trim();
const ICONES_ATOUTS = [
  '<path d="M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M8.5 3 7 9l5 12 5-12-1.500-6"/>',
  '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.300 8 20 19M8.300 16 20 5"/>',
  '<path d="M12 21C5 15.500 2.500 12 2.500 8.300A5 5 0 0 1 12 6a5 5 0 0 1 9.500 2.300C21.500 12 19 15.500 12 21z"/>',
];
const PINCEAU = '<path d="M2 118C20 92 38 72 62 50 78 36 96 20 118 6c-8 14-12 22-24 34 12-8 18-10 26-14-12 16-22 26-36 38 8-3 14-5 20-6-22 18-44 32-68 44 6-1 10-1 14 0-22 8-34 12-50 16z"/>';
const rendreFilm = (a, NL) => {
  const v = a.video; const f = a.film;
  const titre = sansEmoji(a.titre);
  const accroche = sansEmoji(f.accroche);
  const nom = [titre, accroche].filter(Boolean).join(' ');
  const atouts = (f.atouts || []).slice(0, 3).map((t, i) => `<li><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_ATOUTS[i]}</svg><span>${echapper(t)}</span></li>`).join('');
  return [
    `    <section class="promo promo--film" aria-label="${echapper(nom || 'Vidéo')}"${dates(a, new Date().toISOString().slice(0, 10))}>`,
    '      <div class="film">',
    '        <svg class="film__decor" viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="film-sombre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B170D"/><stop offset="1" stop-color="#120804"/></linearGradient><linearGradient id="film-or" x1="0" x2="1"><stop offset="0" stop-color="#F7D9A8" stop-opacity="0"/><stop offset=".45" stop-color="#F2C07C"/><stop offset="1" stop-color="#FFF0D6"/></linearGradient></defs><path fill="url(#film-sombre)" d="M1010 0c-46 120 16 214 110 300 112 102 96 262 320 372V0z"/><path class="film__vague" fill="url(#film-sombre)" d="M0 716c190-24 420 10 690 84H0z"/><path class="film__fil" fill="none" stroke="url(#film-or)" stroke-width="3" d="M0 706c196-26 430 8 704 90"/></svg>',
    `        <img class="film__filigrane" src="${a.image.src}-sm.jpg" alt="" aria-hidden="true" loading="lazy" decoding="async">`,
    '        <div class="container film__grille">',
    '          <div class="film__texte">',
    String(a.etiquette || '').trim() && `            <p class="film__surtitre">${echapper(a.etiquette.trim())}</p>`,
    `            <h2 class="film__titre">${echapper(titre)}${accroche ? ` <em>${echapper(accroche)}<svg viewBox="0 0 400 18" preserveAspectRatio="none" aria-hidden="true"><path d="M3 12C110 2 280 2 397 8 280 7 130 10 40 16z"/></svg></em>` : ''}</h2>`,
    `            <p class="film__corps">${echapper(sansEmoji(a.texte))}</p>`,
    f.lire && `            <button type="button" class="film__lire"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.200v13.600a1 1 0 0 0 1.500.86l11.200-6.800a1 1 0 0 0 0-1.720L9.500 4.340A1 1 0 0 0 8 5.200z"/></svg></i>${echapper(f.lire)}<svg class="arrow" aria-hidden="true"><use href="#i-arrow"/></svg></button>`,
    atouts && `            <ul class="film__atouts">${atouts}</ul>`,
    '          </div>',
    '          <div class="film__scene">',
    `            <svg class="film__pinceau film__pinceau--haut" viewBox="0 0 122 122" aria-hidden="true">${PINCEAU}</svg>`,
    `            <svg class="film__pinceau film__pinceau--bas" viewBox="0 0 122 122" aria-hidden="true">${PINCEAU}</svg>`,
    '            <svg class="film__eclat" viewBox="0 0 60 60" aria-hidden="true"><path d="M8 52 2 22M28 40l18-26M36 56l22-8"/></svg>',
    '            <i class="film__scintille film__scintille--a" aria-hidden="true"></i><i class="film__scintille film__scintille--b" aria-hidden="true"></i><i class="film__scintille film__scintille--c" aria-hidden="true"></i>',
    `            <div class="film__bord"><div class="film__cadre"><video src="${v.src}.mp4"${VIDEO_SRC.test(v.leger || '') ? ` data-leger="${v.leger}"` : ''} poster="${a.image.src}-sm.jpg" width="${Number(v.largeur)}" height="${Number(v.hauteur)}" controls playsinline preload="none" controlslist="nodownload" aria-label="${echapper(a.image.alt || nom || 'Vidéo de Nelly Coiffure')}"></video></div></div>`,
    '          </div>',
    '        </div>',
    '      </div>',
    '    </section>',
  ].filter(Boolean).join(NL);
};

// Annonce ou section ajoutée. Formats : section (image + texte), carte, encadre (texte seul), cartes (grille de 2 ou 3),
// appel (bande sombre). Fond : clair (carte crème), transparent ou sombre. ajout = section placée dans une page.
const rendrePromo = (a, aujourdhui, NL, ajout = false) => {
  if (!ajout && a.film && typeof a.film === 'object' && a.video?.src && a.image?.src && a.format === 'section') return rendreFilm(a, NL);
  const etiquette = String(a.etiquette || '').trim();
  const sombre = a.format === 'appel' || a.fond === 'sombre';
  // Sections ajoutées : chaque texte indique son champ, pour que l'éditeur visuel le modifie sur place
  const champ = (nom) => (ajout ? ` data-champ="${nom}"` : '');
  const textes = [
    etiquette && `<p class="eyebrow eyebrow--copper"${champ('etiquette')}>${echapper(etiquette)}</p>`,
    String(a.titre || '').trim() && `<h2 class="title${sombre ? ' title--light' : ''}${motLong(a.titre) ? ' title--mot-long' : ''}"${champ('titre')}>${echapper(a.titre.trim())}</h2>`,
    paragraphe(a.texte, sombre ? 'body body--light' : 'body', champ('texte')),
    boutonAnnonce(a, sombre ? 'btn btn--light btn--shine' : 'btn btn--dark btn--shine'),
  ].filter(Boolean);
  const avecImage = ['section', 'carte'].includes(a.format) && a.image?.src;
  const tailles = a.format === 'carte' ? '(min-width: 768px) 260px, 100vw' : '(min-width: 1025px) 45vw, 100vw';
  const classes = ['promo', `promo--${a.format}`, !avecImage && a.format !== 'cartes' && 'promo--sans-image',
    avecImage && ['droite', 'dessus'].includes(a.disposition) && `promo--image-${a.disposition}`,
    a.format !== 'appel' && a.fond && a.fond !== 'clair' && `promo--fond-${a.fond}`, ajout && 'promo--ajout'].filter(Boolean).join(' ');
  const attributs = ajout ? ` data-ajout="${a.id}" data-s="a-${a.id}"` : '';
  const cartes = a.format === 'cartes' ? (a.cartes || []).map((c, i) => ({ ...c, i })).filter((c) => String(c.titre || '').trim()) : [];
  return [
    `    <section class="${classes}" aria-label="${echapper(a.titre || etiquette || 'Annonce')}"${attributs}${dates(a, aujourdhui)}>`,
    '      <div class="container">',
    '        <div class="promo__inner reveal">',
    avecImage && (a.video?.src
      ? `          <div class="${classeMedia(a.video)} promo__media--video" style="aspect-ratio: ${Number(a.video.largeur)} / ${Number(a.video.hauteur)}">${videoAnnonce(a)}</div>`
      : `          <div class="${classeMedia(a.image)}">${imageAnnonce(a.image, tailles)}</div>`),
    textes.length && '          <div class="promo__texte">',
    ...textes.map((t) => `            ${t}`),
    textes.length && '          </div>',
    cartes.length && `          <div class="promo__grille promo__grille--${cartes.length}">`,
    ...cartes.map((c) => [
      '            <article class="promo__carte">',
      c.image?.src && `              <div class="${classeMedia(c.image)}">${imageAnnonce(c.image, '(min-width: 1025px) 30vw, 100vw')}</div>`,
      `              <h3${champ(`carte-${c.i}-titre`)}>${echapper(c.titre.trim())}</h3>`,
      paragraphe(c.texte) && `              ${paragraphe(c.texte, 'body', champ(`carte-${c.i}-texte`))}`,
      '            </article>',
    ].filter(Boolean).join(NL)),
    cartes.length && '          </div>',
    '        </div>',
    '      </div>',
    '    </section>',
  ].filter(Boolean).join(NL);
};

const rendrePromos = (contenu, fichier, aujourdhui, NL) => {
  const liste = annoncesVisibles(contenu, fichier, aujourdhui).filter((a) => a.format !== 'bandeau');
  return liste.length ? `${NL}${liste.map((a) => rendrePromo(a, aujourdhui, NL)).join(NL)}${NL}` : NL;
};

const rendreAnnonce = (contenu, fichier, aujourdhui, NL) => {
  const liste = annoncesVisibles(contenu, fichier, aujourdhui).filter((a) => a.format === 'bandeau');
  if (!liste.length) return NL;
  return `${NL}${liste.map((a) => {
    const texte = echapper(String(a.texte || a.titre || '').trim());
    const lien = String(a.bouton?.texte || '').trim() ? ` <a ${attributsLien(a.bouton)}>${echapper(a.bouton.texte.trim())}</a>` : '';
    return `    <div class="annonce" role="note"${dates(a, aujourdhui)}><p>${texte}${lien}</p></div>`;
  }).join(NL)}${NL}`;
};

// --- Couleurs du site (palettes chaudes accordées au design ; « cuivre » = d'origine) ------------------
export const THEMES = {
  cuivre: null,
  'or-rose': { copper: '#B9806F', light: '#E3B5A6', accent: '#94584A' },
  terracotta: { copper: '#B8653F', light: '#E4A27F', accent: '#8F4527' },
  bronze: { copper: '#9C7A45', light: '#D3B47E', accent: '#75572B' },
};
// Couleurs, logo de l'écran d'ouverture et image de la bande de fin de page (adresses relatives : l'aperçu les remplace)
const rendreTheme = (contenu, NL) => {
  const t = THEMES[contenu.theme];
  const css = [];
  if (t) css.push(`:root { --copper: ${t.copper}; --copper-light: ${t.light}; --accent: ${t.accent}; }`);
  const logo = logoDe(contenu);
  if (logo) css.push(`body::before { background-image: url("${logo.src}.png"); }`);
  const fond = fondDe(contenu);
  if (fond) css.push(`.cta__texture { background-image: url("${fond}.jpg"); } @media (max-width: 760px) { .cta__texture { background-image: url("${fond}-sm.jpg"); } }`);
  return css.length ? `${NL}  <style id="theme">${css.join(' ')}</style>${NL}` : NL;
};

// --- Logo et image de fond ----------------------------------------------------------
// contenu.marque.logo = { src: 'img/marque/logo-…', largeur, hauteur } : fichiers ${src}.png et ${src}-clair.png (fond sombre)
// contenu.fonds.cta = 'img/pages/…' : fichiers .jpg et -sm.jpg. Absents = logo et image d'origine.
export const LOGO_SRC = /^img\/marque\/logo-[0-9]+$/;
export const FOND_SRC = /^img\/pages\/[a-z0-9-]+$/;
const logoDe = (contenu) => (LOGO_SRC.test(contenu.marque?.logo?.src || '') ? contenu.marque.logo : null);
const fondDe = (contenu) => (FOND_SRC.test(contenu.fonds?.cta || '') ? contenu.fonds.cta : null);
const appliquerLogo = (h, contenu) => {
  const logo = logoDe(contenu);
  const img = (l, defaut, hDefaut, suffixe) => (m, debut, milieu, fin) => (logo
    ? `${debut}${logo.src}${suffixe}.png${milieu}${l}" height="${Math.round((l * logo.hauteur) / logo.largeur)}${fin}`
    : `${debut}${defaut}${milieu}${l}" height="${hDefaut}${fin}`);
  h = h.replace(/(<a [^>]*class="header__logo"[^>]*>\s*<img src=")[^"]*("[^>]*? width=")\d+" height="\d+(")/, img(200, 'img/marque/logo.webp', 121, ''));
  return h.replace(/(<a [^>]*class="site-footer__logo"[^>]*><img src=")[^"]*("[^>]*? width=")\d+" height="\d+(")/, img(480, 'img/marque/logo-clair.webp', 291, '-clair'));
};

// --- Réseaux sociaux --------------------------------------------------------------

export const RESEAUX_NOMS = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', snapchat: 'Snapchat', youtube: 'YouTube' };
const reseauxDe = (contenu) => ({ youtube: '', ...(contenu.reseaux || { instagram: RESEAUX[0], tiktok: RESEAUX[1], facebook: RESEAUX[2], snapchat: RESEAUX[3] }) });
const pseudo = (url) => (String(url).match(/(?:instagram\.com\/|tiktok\.com\/@|youtube\.com\/@)([A-Za-z0-9._-]+)/) || [])[1];

// Les liens apparaissent à plusieurs endroits (pied de page, Contact, Réalisations) : on remplace l'ancienne adresse
// complète par la nouvelle. Les pseudos affichés sont repérés par data-reseau="instagram|tiktok…" : chacun suit son réseau
// (Instagram et TikTok peuvent avoir le même pseudo, un remplacement global les mélangerait).
const remplacerReseaux = (t, contenu, ancien) => {
  const n = reseauxDe(contenu);
  if (ancien) {
    const a = reseauxDe(ancien);
    for (const cle of Object.keys(RESEAUX_NOMS)) {
      if (!a[cle] || !n[cle] || a[cle] === n[cle]) continue;
      t = t.split(echapper(a[cle])).join(echapper(n[cle]));
      if (echapper(a[cle]) !== a[cle]) t = t.split(a[cle]).join(n[cle]);
    }
  }
  return t.replace(/(<(?:small|span) data-reseau="([a-z]+)">)@?[^<]*(<\/(?:small|span)>)/g, (m, ouv, cle, fin) => {
    const p = pseudo(n[cle]);
    return p ? `${ouv}@${p}${fin}` : `${ouv}Nelly Coiffure${fin}`;
  });
};

// Horaires pour Google : jours consécutifs aux mêmes heures regroupés
const horairesGoogle = (contenu) => {
  const groupes = [];
  contenu.horaires.forEach((j, i) => {
    if (j.etat !== 'ouvert') return;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.opens === j.debut && dernier.closes === j.fin && dernier.fin === i - 1) { dernier.jours.push(JOURS_EN[i]); dernier.fin = i; }
    else groupes.push({ jours: [JOURS_EN[i]], opens: j.debut, closes: j.fin, fin: i });
  });
  return groupes.map((g) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: g.jours.length > 1 ? g.jours : g.jours[0], opens: g.opens, closes: g.closes }));
};

const salonGoogle = (contenu) => ({
  '@type': 'HairSalon',
  '@id': `${DOMAINE}/#salon`,
  name: NOM,
  description: 'Coiffeuse spécialisée en tresses africaines à Marseille : knotless braids, tresses couchées, nattes collées, twists, locks et tissage, chez elle ou à domicile.',
  url: `${DOMAINE}/`,
  logo: `${DOMAINE}/${logoDe(contenu)?.src || 'img/marque/logo'}.png`,
  image: [IMAGE, `${DOMAINE}/img/nelly/hero-bouclees.webp`, `${DOMAINE}/img/nelly/portrait-nelly-rond.webp`],
  telephone: formatsTelephone(contenu.telephones.principal).international,
  founder: { '@type': 'Person', name: 'Nelly', jobTitle: 'Coiffeuse afro, spécialiste des tresses africaines', image: `${DOMAINE}/img/nelly/portrait-nelly-rond.webp` },
  knowsLanguage: 'fr',
  slogan: 'Révèle votre beauté',
  keywords: 'tresses africaines, knotless braids, box braids, nattes collées, tresses couchées, twists, locks, tissage, coiffure afro à domicile, Marseille',
  geo: { '@type': 'GeoCoordinates', latitude: 43.3064, longitude: 5.4006 },
  hasMap: FICHE_GOOGLE || 'https://www.google.com/maps/search/?api=1&query=13004%20Marseille',
  priceRange: `${prixMin(contenu)} € – ${prixMax(contenu)} €`,
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Espèces, virement instantané',
  address: { '@type': 'PostalAddress', addressLocality: 'Marseille', addressRegion: 'Provence-Alpes-Côte d’Azur', postalCode: '13004', addressCountry: 'FR' },
  areaServed: VILLES.map((v) => ({ '@type': 'City', name: v })),
  openingHoursSpecification: horairesGoogle(contenu),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Coiffures et tarifs',
    itemListElement: visibles(contenu).map((s) => ({
      '@type': 'Offer', price: String(s.prix), priceCurrency: 'EUR', url: `${DOMAINE}/coiffures.html`,
      itemOffered: { '@type': 'Service', name: s.nom, serviceType: 'Coiffure afro', areaServed: 'Marseille' },
    })),
  },
  sameAs: [...Object.values(reseauxDe(contenu)), FICHE_GOOGLE].filter(Boolean),
});

// --- Étapes ---------------------------------------------------------------------

// Contenu modifiable (coiffures, galerie, horaires, annonces, prix, téléphones, réseaux)
const appliquerContenu = (h, fichier, contenu, ancien, aujourdhui) => {
  const NL = h.includes('\r\n') ? '\r\n' : '\n';
  if (PAGES[fichier] && !PAGES[fichier].robots) h = marquer(retirerAjouts(h));
  if (fichier === 'coiffures.html') {
    h = zone(h, 'coiffures', `${NL}${visibles(contenu).map((s) => carteCoiffure(s, contenu, NL)).join(NL)}${NL}`);
    h = h.replace(/(<h2 class="title reveal">)\d+( coiffures?)/, (m, a, b) => `${a}${visibles(contenu).length}${visibles(contenu).length > 1 ? ' coiffures' : ' coiffure'}`);
  }
  if (fichier === 'realisations.html') {
    h = zone(h, 'filtres', `${NL}${rendreFiltres(contenu, NL)}${NL}`);
    h = zone(h, 'galerie', `${NL}${rendreGalerie(contenu, NL)}${NL}`);
  }
  if (fichier === 'contact.html') h = zone(h, 'horaires', `${NL}${rendreHoraires(contenu, NL)}${NL}`);
  h = zone(h, 'annonce', rendreAnnonce(contenu, fichier, aujourdhui, NL));
  h = zone(h, 'promos', rendrePromos(contenu, fichier, aujourdhui, NL));
  // Prix repris dans les textes : seul le nombre change, la mise en forme (espace insécable…) reste
  h = h.replace(/(<span data-prix="([a-z0-9 -]+)">)([^<]*?)(\d+)([^<]*<\/span>)/g, (m, ouv, cles, avant, nb, apres) => {
    const p = prixDe(contenu, cles.trim().split(/\s+/));
    return p === null ? m : `${ouv}${avant}${p}${apres}`;
  });
  if (PAGES[fichier] && !PAGES[fichier].robots) h = appliquerPages(h, fichier, contenu, formatsTelephone, sectionsAjoutees(contenu, fichier, aujourdhui, NL));
  h = zone(h, 'theme', rendreTheme(contenu, NL));
  h = appliquerLogo(h, contenu);
  if (PAGES[fichier]) h = appliquerNavigation(h, fichier, contenu, attributsLien, reseauxDe(contenu));
  return remplacerReseaux(remplacerTelephones(h, contenu, ancien), contenu, ancien);
};

const remplacerTelephones = (t, contenu, ancien) => {
  if (!ancien) return t;
  for (const cle of ['principal', 'secondaire']) {
    const a = formatsTelephone(ancien.telephones[cle]);
    const n = formatsTelephone(contenu.telephones[cle]);
    if (a.international === n.international) continue;
    t = t.split(a.international).join(n.international).split(a.whatsapp).join(n.whatsapp).split(a.affiche).join(n.affiche);
  }
  return t;
};

// Balises de référencement et données structurées
const appliquerSeo = (h, fichier, contenu, aujourdhui) => {
  const P = PAGES[fichier];
  const NL = h.includes('\r\n') ? '\r\n' : '\n';
  const url = `${DOMAINE}${P.chemin}`;

  // 1. Nettoyage des anciennes balises gérées ici
  h = h.replace(/[ \t]*<!-- seo:debut -->[\s\S]*?<!-- seo:fin -->\r?\n?/g, '')
    .replace(/[ \t]*<meta property="og:[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<meta name="(twitter:[^"]*|robots|google-site-verification|geo\.[a-z]+)"[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<link rel="canonical"[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\r?\n/g, '');

  // 2. Titre et description
  const descriptionModele = P.description && remplirPrix(P.description, contenu);
  const titre = P.titre || (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const description = descriptionModele || (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (P.titre) h = h.replace(/<title>[^<]*<\/title>/, `<title>${echapper(P.titre)}</title>`);
  if (descriptionModele) h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${echapper(descriptionModele)}">`);

  // 3. Titre principal (H1) porteur des mots-clés : le surtitre devient le H1, le slogan reste un grand titre visuel
  if (P.h1) {
    h = h.replace(/<(p|h1) class="eyebrow((?: hero__eyebrow)?) intro"( style="[^"]*")?>[\s\S]*?<\/(p|h1)>/, (m, t, c, st) => `<h1 class="eyebrow${c} intro"${st || ''}>${P.h1}</h1>`);
    h = h.replace(/<h1 class="(hero__title|page-hero__title)">([\s\S]*?)<\/h1>/, '<p class="$1">$2</p>');
  }

  // 4. Données structurées
  const graphe = [
    { '@type': 'WebSite', '@id': `${DOMAINE}/#site`, url: `${DOMAINE}/`, name: NOM, inLanguage: 'fr-FR', publisher: { '@id': `${DOMAINE}/#salon` } },
    salonGoogle(contenu),
    { '@type': 'WebPage', '@id': `${url}#page`, url, name: titre, description, inLanguage: 'fr-FR',
      isPartOf: { '@id': `${DOMAINE}/#site` }, about: { '@id': `${DOMAINE}/#salon` }, primaryImageOfPage: IMAGE },
  ];
  if (P.ariane) {
    graphe.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${DOMAINE}/` },
      { '@type': 'ListItem', position: 2, name: P.ariane, item: url },
    ] });
  }
  if (P.article) {
    graphe.push({ '@type': 'Article', '@id': `${url}#article`, headline: titre.split(' | ')[0], description, inLanguage: 'fr-FR', url,
      image: IMAGE, datePublished: '2026-10-31', dateModified: aujourdhui, mainEntityOfPage: { '@id': `${url}#page` },
      author: { '@type': 'Person', name: 'Nelly', url: `${DOMAINE}/a-propos.html` }, publisher: { '@id': `${DOMAINE}/#salon` } });
  }
  // Questions fréquentes lues directement dans la page
  const faq = [...h.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)];
  if (faq.length) {
    graphe.push({ '@type': 'FAQPage', mainEntity: faq.map(([, q, r]) => ({ '@type': 'Question', name: texte(q), acceptedAnswer: { '@type': 'Answer', text: texte(r) } })) });
  }

  // 5. Bloc de balises
  const robots = P.robots || 'index, follow, max-image-preview:large';
  const bloc = [
    '<!-- seo:debut -->',
    `<link rel="canonical" href="${url}">`,
    `<meta name="robots" content="${robots}">`,
    GOOGLE_VERIFICATION && `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">`,
    '<meta name="geo.region" content="FR-13">',
    '<meta name="geo.placename" content="Marseille">',
    `<meta property="og:type" content="${P.article ? 'article' : 'website'}">`,
    '<meta property="og:locale" content="fr_FR">',
    `<meta property="og:site_name" content="${NOM}">`,
    `<meta property="og:title" content="${echapper(titre)}">`,
    `<meta property="og:description" content="${echapper(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="Nelly Coiffure, tresses africaines à Marseille">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${echapper(titre)}">`,
    `<meta name="twitter:description" content="${echapper(description)}">`,
    `<meta name="twitter:image" content="${IMAGE}">`,
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graphe })}</script>`,
    '<!-- seo:fin -->',
  ].filter(Boolean).map((l) => `  ${l}`).join(NL);
  return h.replace(/([ \t]*<meta name="description"[^>]*>\r?\n)/, `$1${bloc}${NL}`);
};

// Plan du site (pages indexables uniquement) ; les photos de Nelly sont listées pour Google Images
const planDuSite = (fichiers, aujourdhui) => {
  const imagesDe = (h) => {
    const vues = new Set();
    return [...h.matchAll(/<img[^>]*\ssrc="(img\/(?:nelly|realisations)\/[^"]+)"[^>]*>/g)]
      .filter(([, src]) => !vues.has(src) && vues.add(src))
      .map(([, src]) => `    <image:image><image:loc>${DOMAINE}/${src}</image:loc></image:image>`);
  };
  const indexables = Object.entries(PAGES).filter(([, P]) => !P.robots);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexables.map(([f, P]) => [`  <url><loc>${DOMAINE}${P.chemin}</loc><lastmod>${aujourdhui}</lastmod><priority>${P.priorite}</priority>`, ...imagesDe(fichiers[f]), '  </url>'].join('\n')).join('\n')}
</urlset>
`;
};

/**
 * Régénère le site.
 * @param {Record<string,string>} fichiers contenu actuel des fichiers de FICHIERS (chemins relatifs à site/)
 * @param {object} contenu contenu modifiable (contenu/site.json)
 * @param {{ancien?: object, aujourdhui?: string}} options ancien : contenu précédent (pour remplacer les téléphones)
 * @returns {Record<string,string>} fichiers à jour (seulement ceux qui ont changé)
 */
export function regenerer(fichiers, contenu, { ancien, aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const sortie = { ...fichiers };
  for (const f of [...Object.keys(PAGES), 'tarifs.html']) {
    if (sortie[f] === undefined) continue;
    sortie[f] = appliquerContenu(sortie[f], f, contenu, ancien, aujourdhui);
    if (PAGES[f]) sortie[f] = appliquerSeo(sortie[f], f, contenu, aujourdhui);
  }
  if (sortie['js/main.js'] !== undefined) sortie['js/main.js'] = remplacerReseaux(remplacerTelephones(sortie['js/main.js'], contenu, ancien), contenu, ancien);

  // Version du CSS et du JS dans leurs adresses : chaque modification force les téléphones à recharger la nouvelle version
  const versions = {};
  for (const res of ['css/style.css', 'js/main.js']) {
    if (sortie[res] !== undefined) versions[res] = createHash('sha1').update(sortie[res].replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
  }
  for (const f of [...Object.keys(PAGES), 'tarifs.html']) {
    if (sortie[f] === undefined) continue;
    for (const [res, v] of Object.entries(versions)) sortie[f] = sortie[f].replace(new RegExp(`(["'])${res.replace('.', '\\.')}(\\?v=[0-9a-f]+)?\\1`, 'g'), `$1${res}?v=${v}$1`);
  }

  sortie['sitemap.xml'] = planDuSite(sortie, aujourdhui);
  sortie['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${DOMAINE}/sitemap.xml\n`;

  return Object.fromEntries(Object.entries(sortie).filter(([f, t]) => t !== fichiers[f]));
}

const videoValide = (v) => VIDEO_SRC.test(v?.src || '') && (v.leger === undefined || VIDEO_SRC.test(v.leger)) && Number.isInteger(v.largeur) && Number.isInteger(v.hauteur) && v.largeur > 0 && v.hauteur > 0;
function verifierAlbum(x, nom) {
  if (x.suite === undefined) return [];
  if (!Array.isArray(x.suite)) return [`Album illisible pour ${nom}.`];
  const erreurs = [];
  if (x.suite.length >= MAX_ALBUM) erreurs.push(`Album trop grand pour ${nom} (${MAX_ALBUM} éléments maximum).`);
  for (const m of x.suite) {
    if (!IMAGE_CATALOGUE.test(m?.image || '')) erreurs.push(`Photo d’album invalide pour ${nom}.`);
    if (m?.video && !videoValide(m.video)) erreurs.push(`Vidéo invalide pour ${nom}.`);
  }
  return erreurs;
}

// Vérifie un contenu reçu de l'espace de gestion avant de publier (renvoie la liste des problèmes)
export function verifierContenu(c) {
  const erreurs = [];
  const tel = /^0[1-9](?:[ .]?\d{2}){4}$/;
  if (!c || typeof c !== 'object') return ['Contenu illisible.'];
  if (!tel.test(String(c.telephones?.principal || '').trim())) erreurs.push('Le numéro principal doit ressembler à 06 12 34 56 78.');
  if (!tel.test(String(c.telephones?.secondaire || '').trim())) erreurs.push('Le second numéro doit ressembler à 06 12 34 56 78.');
  if (!Array.isArray(c.horaires) || c.horaires.length !== 7) erreurs.push('Les horaires doivent couvrir les 7 jours.');
  else c.horaires.forEach((j, i) => {
    if (j.jour !== JOURS[i]) erreurs.push(`Jour inattendu : ${j.jour}.`);
    if (!['ouvert', 'ferme', 'demande'].includes(j.etat)) erreurs.push(`État inconnu pour ${j.jour}.`);
    if (j.etat === 'ouvert' && !(/^\d{2}:\d{2}$/.test(j.debut) && /^\d{2}:\d{2}$/.test(j.fin) && j.debut < j.fin)) erreurs.push(`Horaires de ${j.jour} incomplets.`);
  });
  if (!Array.isArray(c.services) || !c.services.some((s) => s.visible !== false)) erreurs.push('Il faut au moins une coiffure visible.');
  else {
    const cles = new Set();
    c.services.forEach((s) => {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.cle || '') || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.ancre || '')) erreurs.push(`Identifiant invalide pour ${s.nom || 'une coiffure'}.`);
      if (cles.has(s.cle)) erreurs.push(`Deux coiffures portent le même nom : ${s.nom}.`);
      cles.add(s.cle);
      if (!String(s.nom || '').trim() || String(s.nom).length > 60) erreurs.push('Chaque coiffure doit avoir un nom (60 caractères maximum).');
      if (String(s.description || '').length > 160) erreurs.push(`Description trop longue pour ${s.nom} (160 caractères maximum).`);
      if (!Number.isInteger(Number(s.prix)) || Number(s.prix) < 1 || Number(s.prix) > 2000) erreurs.push(`Prix invalide pour ${s.nom}.`);
      if (!/^img\/realisations\/catalogue\/[a-z0-9-]+$/.test(s.photo || '')) erreurs.push(`Photo manquante pour ${s.nom}.`);
      erreurs.push(...verifierAlbum(s, s.nom));
    });
  }
  if (!Array.isArray(c.photos)) erreurs.push('Liste de photos illisible.');
  else c.photos.forEach((p) => {
    if (!/^img\/realisations\/catalogue\/[a-z0-9-]+$/.test(p.image || '')) erreurs.push('Photo invalide.');
    if (p.video && !videoValide(p.video)) erreurs.push('Vidéo invalide dans la galerie.');
    erreurs.push(...verifierAlbum(p, 'la galerie'));
  });
  if (String(c.annonce?.texte || '').length > 160) erreurs.push('L’annonce est trop longue (160 caractères maximum).');
  erreurs.push(...verifierAnnonces(c.annonces));
  erreurs.push(...verifierPages(c.pages));
  if (c.theme !== undefined && !(c.theme in THEMES)) erreurs.push('Couleurs du site inconnues.');
  const logo = c.marque?.logo;
  if (logo !== undefined && logo !== null && !(LOGO_SRC.test(logo.src || '') && Number.isInteger(logo.largeur) && Number.isInteger(logo.hauteur)
    && logo.largeur > 0 && logo.hauteur > 0 && logo.hauteur / logo.largeur <= 0.85)) erreurs.push('Le logo est invalide.');
  if (c.fonds?.cta !== undefined && c.fonds.cta !== null && !FOND_SRC.test(c.fonds.cta)) erreurs.push('L’image de fond est invalide.');
  if (c.reseaux !== undefined) {
    // Instagram est obligatoire (boutons de la page Réalisations) ; les autres réseaux peuvent être laissés vides
    for (const [cle, nom] of Object.entries(RESEAUX_NOMS)) {
      const v = String(c.reseaux?.[cle] || '').trim();
      if ((cle === 'instagram' || v) && !urlValide(v)) erreurs.push(`Le lien ${nom} doit être une adresse complète commençant par https://`);
    }
  }
  erreurs.push(...verifierNavigation(c.navigation, PAGES_PUBLIQUES, verifierLien));
  return erreurs;
}

// Destination d'un lien ou d'un bouton : renvoie le problème, ou une chaîne vide
export const verifierLien = (b) => {
  if (!b || !['whatsapp', 'page', 'externe', 'telephone'].includes(b.type)) return 'destination inconnue.';
  if (b.type === 'externe' && !urlValide(b.valeur)) return 'l’adresse doit commencer par https://';
  if (b.type === 'page' && !PAGES_PUBLIQUES.has(String(b.valeur || '').split('#')[0])) return 'choisissez une page du site.';
  if (b.type === 'telephone' && !/^0[1-9](?:[ .]?\d{2}){4}$/.test(String(b.valeur || '').trim())) return 'numéro de téléphone invalide.';
  return '';
};

export const urlValide = (u) => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; } };
const PAGES_PUBLIQUES = new Set(Object.keys(PAGES).filter((f) => !PAGES[f].robots));

// Modifications des pages : textes, images, boutons, ordre et sections masquées
export function verifierPages(pages) {
  if (pages === undefined) return [];
  if (typeof pages !== 'object' || Array.isArray(pages)) return ['Modifications des pages illisibles.'];
  const erreurs = [];
  for (const [f, p] of Object.entries(pages)) {
    const nom = PAGES_ANNONCES.find(([x]) => x === f)?.[1];
    if (!nom) { erreurs.push('Page inconnue.'); continue; }
    for (const [id, t] of Object.entries(p.textes || {})) {
      if (!/^t\d+$/.test(id) || typeof t !== 'string') erreurs.push(`${nom} : texte illisible.`);
      else if (!t.trim()) erreurs.push(`${nom} : un texte a été vidé. Écrivez quelque chose ou annulez la modification.`);
      else if (t.length > 2000) erreurs.push(`${nom} : un texte est trop long.`);
    }
    for (const [id, im] of Object.entries(p.images || {})) {
      if (!/^i\d+$/.test(id) || !/^img\/pages\/[a-z0-9-]+$/.test(im?.src || '')) erreurs.push(`${nom} : image invalide.`);
    }
    for (const [id, b] of Object.entries(p.boutons || {})) {
      if (!/^b\d+$/.test(id)) { erreurs.push(`${nom} : bouton illisible.`); continue; }
      if (String(b.texte || '').length > 60) erreurs.push(`${nom} : texte de bouton trop long (60 caractères maximum).`);
      if (b.type === 'externe' && !urlValide(b.valeur)) erreurs.push(`${nom} : le lien du bouton « ${b.texte || ''} » doit commencer par https://`);
      if (b.type === 'page' && !PAGES_PUBLIQUES.has(String(b.valeur || '').split('#')[0])) erreurs.push(`${nom} : choisissez la page de destination du bouton « ${b.texte || ''} ».`);
      if (b.type === 'telephone' && !/^0[1-9](?:[ .]?\d{2}){4}$/.test(String(b.valeur || '').trim())) erreurs.push(`${nom} : numéro de téléphone invalide pour le bouton « ${b.texte || ''} ».`);
      if (b.type && !['whatsapp', 'page', 'externe', 'telephone'].includes(b.type)) erreurs.push(`${nom} : destination de bouton inconnue.`);
    }
    if (p.ordre && !(Array.isArray(p.ordre) && p.ordre.every((id) => /^(s\d+|a-[a-z0-9-]+)$/.test(id)))) erreurs.push(`${nom} : ordre des sections illisible.`);
    if (p.masquees && !(Array.isArray(p.masquees) && p.masquees.every((id) => /^(s\d+|a-[a-z0-9-]+)$/.test(id)))) erreurs.push(`${nom} : sections masquées illisibles.`);
    if (p.inversees && !(Array.isArray(p.inversees) && p.inversees.every((id) => /^s\d+$/.test(id)))) erreurs.push(`${nom} : sections inversées illisibles.`);
  }
  return erreurs;
}

// Chaque annonce : format connu, texte présent, bouton complet, pages existantes, dates cohérentes
export function verifierAnnonces(annonces) {
  if (annonces === undefined) return [];
  if (!Array.isArray(annonces)) return ['Liste d’annonces illisible.'];
  const erreurs = [];
  const date = /^\d{4}-\d{2}-\d{2}$/;
  annonces.forEach((a, i) => {
    const nom = String(a.titre || a.texte || '').trim().slice(0, 30) || `n° ${i + 1}`;
    if (!/^[a-z0-9-]+$/.test(a.id || '')) erreurs.push(`Annonce « ${nom} » : identifiant invalide.`);
    if (!FORMATS_ANNONCE.includes(a.format)) erreurs.push(`Annonce « ${nom} » : choisissez une présentation.`);
    if (a.disposition && !['gauche', 'droite', 'dessus'].includes(a.disposition)) erreurs.push(`Annonce « ${nom} » : disposition inconnue.`);
    if (a.fond && !FONDS.includes(a.fond)) erreurs.push(`Annonce « ${nom} » : fond inconnu.`);
    if (a.emplacement && !(PAGES_PUBLIQUES.has(a.emplacement.page) && /^(s\d+|a-[a-z0-9-]+|fin)$/.test(a.emplacement.apres || ''))) erreurs.push(`Section « ${nom} » : emplacement invalide.`);
    if (a.format === 'cartes') {
      const cartes = (a.cartes || []).filter((c) => String(c.titre || '').trim());
      if (cartes.length < 2 || cartes.length > 3) erreurs.push(`Section « ${nom} » : la grille doit contenir 2 ou 3 cartes avec un titre.`);
      cartes.forEach((c) => {
        if (String(c.titre).length > 60 || String(c.texte || '').length > 300) erreurs.push(`Section « ${nom} » : texte de carte trop long.`);
        if (c.image && !/^img\/annonces\/[a-z0-9-]+$/.test(c.image.src || '')) erreurs.push(`Section « ${nom} » : image de carte invalide.`);
      });
    }
    if (a.format === 'bandeau' && a.emplacement) erreurs.push(`Section « ${nom} » : le bandeau ne peut pas être placé dans une page.`);
    if (a.format === 'bandeau' ? !String(a.texte || '').trim() : !String(a.titre || '').trim()) erreurs.push(`Annonce « ${nom} » : ${a.format === 'bandeau' ? 'le texte' : 'le titre'} est obligatoire.`);
    if (String(a.titre || '').length > 90) erreurs.push(`Annonce « ${nom} » : titre trop long (90 caractères maximum).`);
    if (String(a.texte || '').length > (a.format === 'bandeau' ? 160 : 400)) erreurs.push(`Annonce « ${nom} » : texte trop long.`);
    if (String(a.etiquette || '').length > 40) erreurs.push(`Annonce « ${nom} » : petit titre trop long (40 caractères maximum).`);
    if (!a.emplacement && (!Array.isArray(a.pages) || !a.pages.length) || !a.pages.every((p) => p === 'toutes' || PAGES_PUBLIQUES.has(p))) erreurs.push(`Annonce « ${nom} » : choisissez au moins une page.`);
    if ((a.debut && !date.test(a.debut)) || (a.fin && !date.test(a.fin))) erreurs.push(`Annonce « ${nom} » : date invalide.`);
    if (a.debut && a.fin && a.fin < a.debut) erreurs.push(`Annonce « ${nom} » : la date de fin est avant la date de début.`);
    if (a.image && !/^img\/annonces\/[a-z0-9-]+$/.test(a.image.src || '')) erreurs.push(`Annonce « ${nom} » : image invalide.`);
    if (a.video && !(videoValide(a.video) && a.image?.src)) erreurs.push(`Annonce « ${nom} » : vidéo invalide.`);
    if (String(a.bouton?.texte || '').trim()) {
      const b = a.bouton;
      if (String(b.texte).length > 40) erreurs.push(`Annonce « ${nom} » : texte du bouton trop long (40 caractères maximum).`);
      if (b.type === 'externe' && !urlValide(b.valeur)) erreurs.push(`Annonce « ${nom} » : le lien du bouton doit commencer par https://`);
      if (b.type === 'page' && !PAGES_PUBLIQUES.has(String(b.valeur || '').split('#')[0])) erreurs.push(`Annonce « ${nom} » : choisissez la page de destination du bouton.`);
      if (b.type === 'telephone' && !/^0[1-9](?:[ .]?\d{2}){4}$/.test(String(b.valeur || '').trim())) erreurs.push(`Annonce « ${nom} » : numéro de téléphone invalide.`);
      if (!['whatsapp', 'page', 'externe', 'telephone'].includes(b.type)) erreurs.push(`Annonce « ${nom} » : choisissez où mène le bouton.`);
    }
  });
  return erreurs;
}
