import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Référencement : met à jour les balises de toutes les pages à partir d'une seule configuration.
// - titre, description, adresse canonique, robots, aperçus de partage (Open Graph, X)
// - données structurées (salon, prestations et prix, site, fil d'Ariane, questions fréquentes)
// - titre principal (H1) contenant les mots-clés, sitemap.xml et robots.txt
// À relancer après chaque modification des pages : node outils/seo.mjs (sans danger, peut tourner plusieurs fois)

// ⚠️ À changer le jour où le nom de domaine est choisi (ex. https://www.nellycoiffure.fr), puis relancer le script
const DOMAINE = 'https://nelly-coiffure.vercel.app';
// Code de vérification Google Search Console (méthode « balise HTML »), à coller ici une fois obtenu
const GOOGLE_VERIFICATION = '';
// Liens officiels, à remplir dès qu'ils existent (fiche Google, Instagram, TikTok…) : ils renforcent l'identité du salon
const RESEAUX = [];

const SITE = path.resolve(import.meta.dirname, '../site');
const NOM = 'Nelly Coiffure';
const IMAGE = `${DOMAINE}/img/marque/partage.jpg`;
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const PRESTATIONS = [
  ['Knotless braids', 60], ['Short braids', 50], ['Tresses couchées', 50], ['Nattes collées', 30],
  ['Twists', 60], ['Locks', 80], ['Locks courtes', 50], ['Tissage', 50],
  ['Tresses collées homme', 30], ['Twists homme', 30], ['Tresses couchées enfant', 30],
];
const VILLES = ['Marseille', 'Aubagne', 'Allauch', 'Plan-de-Cuques', 'Les Pennes-Mirabeau', 'Septèmes-les-Vallons', 'Cassis'];

// Une page = un sujet et ses mots-clés. h1 : titre principal lu en premier par Google (affiché comme surtitre).
const PAGES = {
  'index.html': {
    chemin: '/', priorite: '1.0',
    titre: 'Tresses africaines à Marseille, à domicile | Nelly Coiffure',
    description: 'Coiffeuse afro à Marseille : knotless braids, tresses couchées, twists, locks, tissage, dès 30 €. Chez moi ou à votre domicile, rendez-vous sur WhatsApp.',
    h1: 'Coiffeuse tresses africaines <br>à Marseille',
  },
  'coiffures.html': {
    chemin: '/coiffures.html', priorite: '0.9', ariane: 'Coiffures et tarifs',
    titre: 'Tarifs tresses, locks, twists à Marseille | Nelly Coiffure',
    description: 'Prix des tresses africaines à Marseille : knotless braids 60 €, locks 80 €, twists, tissage, nattes collées, coiffures homme et enfant dès 30 €.',
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
  'mentions-legales.html': { chemin: '/mentions-legales.html', ariane: 'Mentions légales', robots: 'noindex, follow' },
  'confidentialite.html': { chemin: '/confidentialite.html', ariane: 'Confidentialité', robots: 'noindex, follow' },
  '404.html': { chemin: '/404.html', robots: 'noindex, follow' },
};

const salon = {
  '@type': 'HairSalon',
  '@id': `${DOMAINE}/#salon`,
  name: NOM,
  description: 'Coiffeuse spécialisée en tresses africaines à Marseille : knotless braids, tresses couchées, nattes collées, twists, locks et tissage, chez elle ou à domicile.',
  url: `${DOMAINE}/`,
  logo: `${DOMAINE}/img/marque/logo.png`,
  image: IMAGE,
  priceRange: '30 € – 80 €',
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Espèces, virement instantané',
  address: { '@type': 'PostalAddress', addressLocality: 'Marseille', addressRegion: 'Provence-Alpes-Côte d’Azur', postalCode: '13000', addressCountry: 'FR' },
  areaServed: VILLES.map((v) => ({ '@type': 'City', name: v })),
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '19:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '08:00', closes: '18:00' },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Coiffures et tarifs',
    itemListElement: PRESTATIONS.map(([nom, prix]) => ({
      '@type': 'Offer', price: String(prix), priceCurrency: 'EUR', url: `${DOMAINE}/coiffures.html`,
      itemOffered: { '@type': 'Service', name: nom, serviceType: 'Coiffure afro', areaServed: 'Marseille' },
    })),
  },
  ...(RESEAUX.length ? { sameAs: RESEAUX } : {}),
};
const siteWeb = { '@type': 'WebSite', '@id': `${DOMAINE}/#site`, url: `${DOMAINE}/`, name: NOM, inLanguage: 'fr-FR', publisher: { '@id': `${DOMAINE}/#salon` } };

const echapper = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const texte = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

for (const [fichier, P] of Object.entries(PAGES)) {
  const f = path.join(SITE, fichier);
  let h = readFileSync(f, 'utf8');
  const NL = h.includes('\r\n') ? '\r\n' : '\n';
  const url = `${DOMAINE}${P.chemin}`;

  // 1. Nettoyage des anciennes balises gérées par ce script
  h = h.replace(/[ \t]*<!-- seo:debut -->[\s\S]*?<!-- seo:fin -->\r?\n?/g, '')
    .replace(/[ \t]*<meta property="og:[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<meta name="(twitter:[^"]*|robots|google-site-verification)"[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<link rel="canonical"[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\r?\n/g, '');

  // 2. Titre et description
  const titre = P.titre || (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const description = P.description || (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (P.titre) h = h.replace(/<title>[^<]*<\/title>/, `<title>${echapper(P.titre)}</title>`);
  if (P.description) h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${echapper(P.description)}">`);

  // 3. Titre principal (H1) porteur des mots-clés : le surtitre devient le H1, le slogan reste un grand titre visuel
  if (P.h1) {
    h = h.replace(/<(p|h1) class="eyebrow((?: hero__eyebrow)?) intro"( style="[^"]*")?>[\s\S]*?<\/(p|h1)>/, (m, t, c, st) => `<h1 class="eyebrow${c} intro"${st || ''}>${P.h1}</h1>`);
    h = h.replace(/<h1 class="(hero__title|page-hero__title)">([\s\S]*?)<\/h1>/, '<p class="$1">$2</p>');
  }

  // 4. Données structurées
  const graphe = [siteWeb, salon, {
    '@type': 'WebPage', '@id': `${url}#page`, url, name: titre, description, inLanguage: 'fr-FR',
    isPartOf: { '@id': `${DOMAINE}/#site` }, about: { '@id': `${DOMAINE}/#salon` }, primaryImageOfPage: IMAGE,
  }];
  if (P.ariane) {
    graphe.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${DOMAINE}/` },
      { '@type': 'ListItem', position: 2, name: P.ariane, item: url },
    ] });
  }
  // Questions fréquentes lues directement dans la page (toujours à jour, même après une modification à la main)
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
    '<meta property="og:type" content="website">',
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
  h = h.replace(/([ \t]*<meta name="description"[^>]*>\r?\n)/, `$1${bloc}${NL}`);
  writeFileSync(f, h);
}

// 6. Plan du site (pages indexables uniquement) et robots.txt
const indexables = Object.values(PAGES).filter((P) => !P.robots);
writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexables.map((P) => `  <url><loc>${DOMAINE}${P.chemin}</loc><lastmod>${AUJOURDHUI}</lastmod><priority>${P.priorite}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${DOMAINE}/sitemap.xml
`);
console.log(`${Object.keys(PAGES).length} pages mises à jour, ${indexables.length} dans le sitemap (${DOMAINE}).`);
