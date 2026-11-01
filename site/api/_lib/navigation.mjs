// Menu, bouton de rendez-vous de l'en-tête, pied de page et listes de réseaux sociaux, générés à partir de
// contenu.navigation et contenu.reseaux (identiques sur toutes les pages, sauf la page « courante » du menu).
// Sans contenu.navigation, les valeurs par défaut reproduisent le site d'origine.

export const NAVIGATION_DEFAUT = {
  menu: [
    { texte: 'Accueil', page: 'index.html' },
    { texte: 'Coiffures et tarifs', page: 'coiffures.html' },
    { texte: 'Réalisations', page: 'realisations.html' },
    { texte: 'À propos', page: 'a-propos.html' },
    { texte: 'Contact', page: 'contact.html' },
  ],
  rendezVous: { texte: 'Prendre rendez-vous', court: 'Rendez-vous', message: 'Bonjour Nelly, je souhaite prendre rendez-vous pour une coiffure.' },
  pied: {
    invite: 'Une envie, une question ? *Je vous réponds sur WhatsApp.*',
    presentation: 'Tresses africaines à Marseille, chez moi ou à votre domicile. Des coiffures soignées, réalisées avec écoute et passion.',
    colonnes: [
      { titre: 'Le salon', liens: [
        { texte: 'Accueil', lien: { type: 'page', valeur: 'index.html' } },
        { texte: 'Réalisations', lien: { type: 'page', valeur: 'realisations.html' } },
        { texte: 'À propos', lien: { type: 'page', valeur: 'a-propos.html' } },
        { texte: 'Contact', lien: { type: 'page', valeur: 'contact.html' } },
        { texte: 'Coiffure à domicile', lien: { type: 'page', valeur: 'coiffure-afro-domicile-marseille.html' } },
        { texte: 'Conseils tresses', lien: { type: 'page', valeur: 'conseils-tresses-africaines.html' } },
      ] },
      { titre: 'Coiffures', liens: [
        { texte: 'Knotless et box braids', lien: { type: 'page', valeur: 'knotless-braids-marseille.html' } },
        { texte: 'Tresses couchées', lien: { type: 'page', valeur: 'coiffures.html#tresses-couchees' } },
        { texte: 'Nattes collées', lien: { type: 'page', valeur: 'coiffures.html#nattes-collees' } },
        { texte: 'Tresses enfant', lien: { type: 'page', valeur: 'tresses-enfant-marseille.html' } },
        { texte: 'Locks', lien: { type: 'page', valeur: 'locks-marseille.html' } },
        { texte: 'Tous les tarifs', lien: { type: 'page', valeur: 'coiffures.html#carte' } },
      ] },
    ],
    infos: ['Marseille et alentours', 'Chez moi ou à votre domicile', 'Du lundi au samedi, sur rendez-vous'],
  },
};

export const RESEAUX_LISTE = [
  ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['snapchat', 'Snapchat'], ['youtube', 'YouTube'],
];

export const navigationDe = (contenu) => contenu.navigation || NAVIGATION_DEFAUT;

const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Typographie française : espace insécable avant ? ! : ; et mots mis en valeur (*mot*)
const typographie = (t) => echapper(String(t).trim()).replace(/ ([?!:;])/g, '&nbsp;$1').replace(/\*([^*]+)\*/g, '<em>$1</em>');
const pseudo = (url) => (String(url).match(/(?:instagram\.com\/|tiktok\.com\/@|youtube\.com\/@)([A-Za-z0-9._-]+)/) || [])[1];

/**
 * @param {string} h page HTML
 * @param {string} fichier nom de la page (pour l'entrée « courante » du menu)
 * @param {object} contenu
 * @param {(lien: object) => string} attributsLien attributs d'un lien (href, data-wa…)
 * @param {object} reseaux adresses des réseaux (vides = absents)
 */
export function appliquerNavigation(h, fichier, contenu, attributsLien, reseaux) {
  const nav = navigationDe(contenu);
  const NL = h.includes('\r\n') ? '\r\n' : '\n';
  const remplacer = (re, fn) => { h = h.replace(re, fn); };

  // Menu principal
  remplacer(/(<ul class="nav__list">)[\s\S]*?(\r?\n {8}<\/ul>)/, (m, debut, fin) => `${debut}${NL}${nav.menu.map((x) => {
    const courant = x.page.split('#')[0] === fichier ? ' aria-current="page"' : '';
    return `          <li><a href="${echapper(x.page)}"${courant}>${echapper(x.texte)}</a></li>`;
  }).join(NL)}${fin}`);

  // Bouton de rendez-vous (en-tête, menu mobile)
  const rdv = nav.rendezVous;
  remplacer(/(<a class="(?:header__cta|btn btn--dark nav__mobile-cta)" data-wa=")[^"]*(")/g, (m, a, b) => `${a}${echapper(rdv.message)}${b}`);
  remplacer(/<span class="cta-long">[^<]*<\/span><span class="cta-short">[^<]*<\/span>/, `<span class="cta-long">${echapper(rdv.texte)}</span><span class="cta-short">${echapper(rdv.court || rdv.texte)}</span>`);
  remplacer(/(<a class="btn btn--dark nav__mobile-cta"[^>]*>\s*<svg class="icon" aria-hidden="true"><use href="#i-whatsapp"\/><\/svg> )[^<\r\n]*/, (m, a) => `${a}${echapper(rdv.texte)}`);

  // Pied de page : invitation, présentation, réseaux, colonnes de liens, infos de contact
  remplacer(/<p class="site-footer__invite">[\s\S]*?<\/p>/, `<p class="site-footer__invite">${typographie(nav.pied.invite)}</p>`);
  remplacer(/(<div class="site-footer__brand">[\s\S]*?<\/a>\s*)<p>[\s\S]*?<\/p>/, (m, a) => `${a}<p>${typographie(nav.pied.presentation)}</p>`);
  remplacer(/(<div class="site-footer__social">)[\s\S]*?(\r?\n {10}<\/div>)/, (m, debut, fin) => {
    const liens = RESEAUX_LISTE.filter(([cle]) => reseaux[cle]).map(([cle, nom]) => `            <a href="${echapper(reseaux[cle])}" target="_blank" rel="noopener" aria-label="${nom} de Nelly Coiffure"><svg aria-hidden="true"><use href="#i-${cle}"/></svg></a>`);
    liens.push(`            <a data-wa="Bonjour Nelly, j'aimerais un renseignement pour une coiffure." href="contact.html" aria-label="WhatsApp de Nelly Coiffure"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg></a>`);
    return `${debut}${NL}${liens.join(NL)}${fin}`;
  });
  remplacer(/ {8}<nav class="site-footer__col"[\s\S]*<\/nav>(?=\r?\n {8}<div class="site-footer__col">)/, () => nav.pied.colonnes.map((col) => [
    `        <nav class="site-footer__col" aria-label="${echapper(col.titre)}">`,
    `          <p class="site-footer__title">${echapper(col.titre)}</p>`,
    '          <ul>',
    ...col.liens.map((l) => {
      const courant = l.lien.type === 'page' && l.lien.valeur === fichier ? ' aria-current="page"' : '';
      return `            <li><a ${attributsLien(l.lien)}${courant}>${echapper(l.texte)}</a></li>`;
    }),
    '          </ul>',
    '        </nav>',
  ].join(NL)).join(NL));
  remplacer(/(<li><a href="https:\/\/www\.google\.com\/maps[^\n]*<\/li>)(?:\r?\n {12}<li>[^<]*<\/li>)*/, (m, adresse) => [adresse, ...nav.pied.infos.filter((x) => String(x).trim()).map((x) => `            <li>${typographie(x)}</li>`)].join(NL));

  // Liste « Me suivre » de la page Contact
  h = h.replace(/(<!-- cms:reseaux -->)[\s\S]*?([ \t]*<!-- \/cms:reseaux -->)/, (m, a, b) => `${a}${NL}${RESEAUX_LISTE.filter(([cle]) => reseaux[cle]).map(([cle, nom]) => {
    const p = pseudo(reseaux[cle]);
    return `              <li><a href="${echapper(reseaux[cle])}" target="_blank" rel="noopener"><span>${nom}</span><small data-reseau="${cle}">${p ? `@${p}` : 'Nelly Coiffure'}</small><svg aria-hidden="true"><use href="#i-arrow"/></svg></a></li>`;
  }).join(NL)}${NL}${b}`);
  return h;
}

// Vérification de contenu.navigation (renvoie la liste des problèmes)
export function verifierNavigation(nav, pagesPubliques, verifierLien) {
  if (nav === undefined) return [];
  const e = [];
  if (!Array.isArray(nav.menu) || nav.menu.length < 2 || nav.menu.length > 7) e.push('Le menu doit contenir entre 2 et 7 liens.');
  else nav.menu.forEach((x) => {
    if (!String(x.texte || '').trim() || String(x.texte).length > 30) e.push('Chaque lien du menu a besoin d’un nom (30 caractères maximum).');
    if (!pagesPubliques.has(String(x.page || '').split('#')[0])) e.push(`Le lien du menu « ${x.texte} » doit mener à une page du site.`);
  });
  const r = nav.rendezVous || {};
  if (!String(r.texte || '').trim() || String(r.texte).length > 30 || String(r.court || '').length > 16) e.push('Le bouton de rendez-vous a besoin d’un texte court (30 caractères maximum, 16 pour la version courte).');
  const p = nav.pied || {};
  if (String(p.invite || '').length > 140 || String(p.presentation || '').length > 300) e.push('Un texte du pied de page est trop long.');
  if (!Array.isArray(p.colonnes) || p.colonnes.length > 3) e.push('Le pied de page peut contenir jusqu’à 3 colonnes de liens.');
  else p.colonnes.forEach((c) => {
    if (!String(c.titre || '').trim()) e.push('Chaque colonne du pied de page a besoin d’un titre.');
    if (!Array.isArray(c.liens) || c.liens.length > 10) e.push(`La colonne « ${c.titre} » contient trop de liens (10 maximum).`);
    else c.liens.forEach((l) => {
      if (!String(l.texte || '').trim()) e.push(`Un lien de la colonne « ${c.titre} » n’a pas de texte.`);
      const pb = verifierLien(l.lien);
      if (pb) e.push(`Lien « ${l.texte} » : ${pb}`);
    });
  });
  if (!Array.isArray(p.infos) || p.infos.length > 5) e.push('5 lignes d’informations au maximum dans le pied de page.');
  return e;
}
