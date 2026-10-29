// Génère les pages intérieures (coiffures, tarifs, réalisations, à propos, contact, pages légales, 404)
// à partir de l'en-tête et du pied de page d'index.html. Usage : node outils/construire-pages.mjs
// Attention : écrase ces pages ; modifier leur contenu ici, pas directement dans le HTML.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE = 'C:/Users/PC/Desktop/nelly_coiffe/site';
const index = readFileSync(`${SITE}/index.html`, 'utf8');
const HEADER = index.slice(index.indexOf('  <a class="skip-link"'), index.indexOf('</header>') + 9);
const TAIL = index.slice(index.indexOf('  <footer class="site-footer">'));

const current = (html, file) => html
  .replaceAll(' aria-current="page"', '')
  .replace(new RegExp(`(<li><a href="${file}")`, 'g'), '$1 aria-current="page"')
  .replace(new RegExp(`(<a href="${file}">Coiffures)`, 'g'), `<a href="${file}" aria-current="page">Coiffures`);

const WA = '<svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg>';
const ARROW = '<svg class="arrow" aria-hidden="true"><use href="#i-arrow"/></svg>';
const STARS = `<div class="review__stars" aria-label="5 étoiles sur 5">${'<svg aria-hidden="true"><use href="#i-star"/></svg>'.repeat(5)}</div>`;

export const REVIEWS = [
  ['Sarah M.', 'Je suis vraiment satisfaite de ma coiffure ! Nelly est très professionnelle, douce et à l’écoute. Mes tresses sont magnifiques et le résultat correspond exactement à ce que je voulais. Je recommande à 100 % ! ❤️'],
  ['Aïcha D.', 'Première expérience avec Nelly et certainement pas la dernière ! Elle travaille avec soin et prend le temps de bien faire les choses. Le résultat est superbe. Merci encore pour cette belle prestation ! 🥰'],
  ['Jessica L.', 'J’ai choisi la prestation à domicile et je ne regrette absolument pas ! Nelly est ponctuelle, agréable et très professionnelle. C’est vraiment pratique de pouvoir se faire coiffer chez soi. Je recommande vivement !'],
  ['Grâce N.', 'Nelly a des doigts de fée ! Mes tresses sont propres, élégantes et exactement comme je les imaginais. J’ai reçu beaucoup de compliments sur ma coiffure. Je reviendrai sans hésiter ! ✨'],
  ['Mélissa B.', 'Une coiffeuse à l’écoute et très appliquée. Elle a parfaitement compris ce que je voulais et le résultat est magnifique. Le rapport qualité-prix est excellent. Je suis ravie !'],
  ['Vanessa K.', 'Très belle expérience avec Nelly Coiffure ! Elle est accueillante, patiente et soucieuse du détail. J’ai particulièrement apprécié son professionnalisme et la qualité de son travail. Je recommande les yeux fermés !'],
];
export const review = ([n, q], extra = '') => `<figure class="review${extra}">${STARS}<blockquote>« ${q} »</blockquote><figcaption><span aria-hidden="true">${n[0]}</span>${n}</figcaption></figure>`;

function head({ title, desc, preload, ld = '', bodyClass = 'page' }) {
  return `<!doctype html>
<html lang="fr" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="#F6ECE2">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="img/marque/partage.jpg">
  <link rel="icon" type="image/png" sizes="32x32" href="img/marque/favicon-32.png">
  <link rel="apple-touch-icon" href="img/marque/apple-touch-icon.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Poppins:wght@300;400;500;600&family=Sacramento&display=swap" rel="stylesheet">
${preload ? `  <link rel="preload" as="image" href="${preload}">\n` : ''}  <link rel="stylesheet" href="css/style.css">
${ld}</head>
<body class="${bodyClass}">
`;
}

function pageHero({ crumb, eyebrow, lines, lead, actions, media }) {
  const t = lines.map((l, i) => `<span class="line"><span class="intro${i === lines.length - 1 ? ' accent' : ''}" style="--d: ${(0.2 + i * 0.12).toFixed(2)}s">${l}</span></span>`).join('\n            ');
  return `    <section class="page-hero">
      <div class="container page-hero__inner">
        <div class="page-hero__text">
          <ol class="crumbs intro" style="--d: 0s" aria-label="Fil d'Ariane"><li><a href="index.html">Accueil</a></li><li aria-current="page">${crumb}</li></ol>
          <p class="eyebrow intro" style="--d: .1s">${eyebrow}</p>
          <h1 class="page-hero__title">
            ${t}
          </h1>
          <p class="page-hero__lead intro" style="--d: .6s">${lead}</p>
          <div class="page-hero__actions intro" style="--d: .72s">${actions}</div>
        </div>
${media}
      </div>
    </section>
`;
}

const archMedia = ({ src, pos = '50% 40%', script, w = 800, h = 1000 }) => `        <div class="page-hero__media intro" style="--d: .3s">
          <svg class="arch-line" viewBox="0 0 100 125" aria-hidden="true"><path class="draw draw--slow" d="M1 124 V50 A49 49 0 0 1 99 50 V124" fill="none" stroke="#B57A50" stroke-width="1.2" vector-effect="non-scaling-stroke" pathLength="1"/></svg>
          <div class="arch"><div class="arch__img" data-parallax="0.08"><img src="${src}" width="${w}" height="${h}" alt="" style="object-position: ${pos}" fetchpriority="high"></div></div>
          <p class="page-hero__script" aria-hidden="true">${script.map((s) => `<span>${s}</span>`).join(' ')}</p>
          <div class="seal" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="seal-path" d="M60 60 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0"/></defs><text><textPath href="#seal-path" textLength="290" lengthAdjust="spacing">Tresses africaines ✦ Marseille ✦ </textPath></text></svg><span>N</span></div>
        </div>`;

const CTA = (title = 'Prenez rendez-vous <br>dès maintenant', text = 'Contactez-moi sur WhatsApp pour discuter de votre projet, obtenir un devis personnalisé ou réserver votre prochaine coiffure.') => `    <section class="cta" id="rendez-vous">
      <svg class="cta__curve" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L1440 0 L1440 34 C 1260 96, 1060 108, 860 96 C 760 90, 720 40, 600 26 C 380 4, 160 30, 0 22 Z" fill="var(--cream)"/>
      </svg>
      <div class="cta__texture" data-parallax="-0.06" aria-hidden="true"></div>
      <svg class="cta__arc" viewBox="0 0 600 600" aria-hidden="true">
        <circle class="draw draw--slow" cx="300" cy="300" r="296" fill="none" stroke="#B57A50" stroke-width="2" pathLength="1" transform="rotate(150 300 300)"/>
      </svg>
      <div class="container cta__inner">
        <div class="cta__text">
          <p class="eyebrow eyebrow--copper reveal">Prête à révéler votre beauté&nbsp;?</p>
          <h2 class="title title--light reveal">${title}</h2>
          <p class="body body--light reveal">${text}</p>
          <a class="btn btn--light btn--shine reveal" data-wa="Bonjour Nelly, je souhaite prendre rendez-vous pour une coiffure." href="contact.html">
            ${WA} Prendre rendez-vous sur WhatsApp ${ARROW}
          </a>
        </div>
        <ul class="cta__list" data-stagger>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-calendar"/></svg></span>Conseils personnalisés</li>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-shield"/></svg></span>Réponse rapide</li>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-heart"/></svg></span>Un accompagnement <br>bienveillant</li>
        </ul>
      </div>
    </section>
`;

function page(file, meta, body) {
  const html = head(meta) + current(HEADER, file) + '\n\n  <main id="contenu">\n' + body + '  </main>\n\n' + current(TAIL, file);
  writeFileSync(`${SITE}/${file}`, html);
  console.log('ok', file, html.length);
}

/* ------------------------------------------------------------------ CARTE DES PRESTATIONS */
// Source unique des prestations et des prix (noms des dossiers de Nelly dans coiffure/).
// L'estimateur de la page Tarifs lit ces prix directement dans la carte affichée.
const CARTE = [
  { groupe: 'Tresses', items: [
    { id: 'knotless', nom: 'Knotless braids', prix: 60, desc: 'Sans nœud à la racine : légères, naturelles et sans tension.' },
    { id: 'short-braids', nom: 'Short braids', prix: 50, desc: 'Tresses courtes au carré, faciles à vivre et pleines de style.' },
    { id: 'tresses-couchees', nom: 'Tresses couchées', prix: 50, desc: 'Plaquées sur le cuir chevelu, droites ou en motifs.' },
    { id: 'nattes-collees', nom: 'Nattes collées', prix: 30, desc: 'Quelques nattes plaquées, nettes et rapides à réaliser.' },
  ] },
  { groupe: 'Twists et locks', items: [
    { id: 'twists', nom: 'Twists', prix: 60, desc: 'Vanilles torsadées, souples et légères à porter.' },
    { id: 'locks', nom: 'Locks', prix: 80, desc: 'Fausses locks longues, pour un effet bohème.' },
    { id: 'locks-courtes', nom: 'Locks courtes', prix: 50, desc: 'Locks au carré, bouclées et légères.' },
  ] },
  { groupe: 'Tissage', items: [
    { id: 'tissage', nom: 'Tissage', prix: 50, desc: 'Pose de tissage pour un rendu lisse, ondulé ou bouclé.' },
  ] },
  { groupe: 'Homme', items: [
    { id: 'tresses-homme', nom: 'Tresses collées homme', prix: 30, desc: 'Tresses plaquées, droites ou graphiques.' },
    { id: 'twists-homme', nom: 'Twists homme', prix: 30, desc: 'Twists courts, nets et structurés.' },
  ] },
  { groupe: 'Enfant', items: [
    { id: 'tresses-enfant', nom: 'Tresses couchées enfant', prix: 30, desc: 'Coiffures douces et adaptées aux petites têtes.' },
  ] },
];
const PRESTATIONS = CARTE.flatMap((g) => g.items);
const PRIX_MIN = Math.min(...PRESTATIONS.map((p) => p.prix));
const PRIX_MAX = Math.max(...PRESTATIONS.map((p) => p.prix));
const waStyle = (nom) => `Bonjour Nelly, je suis intéressée par : ${nom}. Pouvez-vous me donner vos disponibilités ?`;

const carteHtml = () => `        <div class="carte" data-stagger>
${CARTE.map((g, gi) => `          <div class="carte__groupe reveal">
            <h3 class="carte__titre"><span>0${gi + 1}</span>${g.groupe}</h3>
            <ul>
${g.items.map((p) => `              <li class="carte__row" id="${p.id}-prix" data-name="${p.nom}" data-price="${p.prix}">
                <div class="carte__info"><b>${p.nom}</b><span>${p.desc}</span></div>
                <span class="carte__prix">${p.prix} €</span>
                <a class="carte__wa" data-wa="${waStyle(p.nom.toLowerCase())}" href="contact.html" aria-label="Demander ${p.nom} sur WhatsApp"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg></a>
              </li>`).join('\n')}
            </ul>
          </div>`).join('\n')}
        </div>`;

/* ------------------------------------------------------------------ COIFFURES ET TARIFS */
// Styles mis en avant : seulement ceux pour lesquels une photo correspond vraiment
const STYLES = [
  { id: 'knotless', name: 'Knotless braids', tag: 'Légèreté et élégance', img: 'style-knotless', w: 700, h: 756, prix: 60,
    body: 'Des tresses sans nœud à la racine : la mèche est ajoutée progressivement pour un départ plat, naturel et sans tension. Plus légères à porter, elles respectent votre cuir chevelu dès le premier jour.',
    meta: ['4 à 6 h', '6 à 8 sem.'], ideal: ['Vous avez le cuir chevelu sensible', 'Vous voulez un rendu naturel dès la racine', 'Vous aimez les coiffures hautes, sans douleur'] },
  { id: 'tresses-couchees', name: 'Tresses couchées', tag: 'Un style graphique', img: 'style-couchees', w: 700, h: 756, prix: 50,
    body: 'Des tresses plaquées au plus près du cuir chevelu, droites, en diagonale ou en motifs. Elles dégagent le visage et se personnalisent avec des perles ou des anneaux.',
    meta: ['2 à 4 h', '3 à 5 sem.'], ideal: ['Vous aimez les coiffures nettes et dessinées', 'Vous voulez un style original', 'Vous préparez un événement'] },
  { id: 'nattes-collees', name: 'Nattes collées', tag: 'Simple et efficace', img: 'style-nattes', w: 700, h: 756, prix: 30,
    body: 'Quelques nattes plaquées, bien tirées et régulières. Rapides à réaliser, pratiques au quotidien, elles conviennent aussi bien pour le sport que pour les vacances.',
    meta: ['1 à 2 h', '2 à 3 sem.'], ideal: ['Vous voulez une coiffure rapide', 'Vous faites du sport', 'Vous cherchez un petit budget'] },
];
const styleRow = (s, i) => `        <article class="style" id="${s.id}">
          <div class="style__media reveal">
            <span class="style__num" aria-hidden="true">0${i + 1}</span>
            <span class="style__frame" aria-hidden="true"></span>
            <div class="style__img"><img src="img/nelly/${s.img}.webp" width="${s.w}" height="${s.h}" loading="lazy" alt="${s.name}"></div>
          </div>
          <div class="style__text">
            <h2 class="title reveal">${s.name}</h2>
            <p class="style__tag reveal">${s.tag}</p>
            <p class="body reveal">${s.body}</p>
            <dl class="style__meta reveal">
              <div><dt>Durée</dt><dd>${s.meta[0]}</dd></div>
              <div><dt>Tenue</dt><dd>${s.meta[1]}</dd></div>
              <div><dt>Tarif</dt><dd>${s.prix} €</dd></div>
            </dl>
            <ul class="check-list reveal">${s.ideal.map((x) => `<li>${x}</li>`).join('')}</ul>
            <div class="style__actions reveal">
              <a class="btn btn--dark btn--shine" data-wa="${waStyle(s.name.toLowerCase())}" href="contact.html">${WA} Demander ce style ${ARROW}</a>
              <a class="btn btn--outline" href="#carte">Tous les tarifs</a>
            </div>
          </div>
        </article>
`;

// Coiffures et tarifs réunis sur une seule page : les styles, la carte des prix, l'essentiel à savoir
const FAQ = [
  ['Les mèches sont-elles comprises dans le prix ?', 'Cela dépend de la coiffure et de la longueur souhaitée. Envoyez-moi le style qui vous plaît sur WhatsApp : je vous dis tout de suite quelles mèches prévoir, ou si je peux les fournir.'],
  ['Comment préparer mes cheveux avant le rendez-vous ?', 'Venez avec des cheveux lavés, bien démêlés et secs, sans huile ni produit gras. Si vous portez encore des tresses, prévenez-moi : je peux les défaire avant la séance.'],
  ['Et si je dois annuler ou décaler ?', 'Prévenez-moi au moins 24 heures à l’avance sur WhatsApp, on trouve un autre créneau sans souci.'],
  ['Quels moyens de paiement acceptez-vous ?', 'Espèces ou virement instantané, le jour du rendez-vous.'],
];
const faqLd = `  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}
  </script>
`;

page('coiffures.html', {
  title: 'Coiffures et tarifs : tresses, twists, locks, tissage à Marseille — Nelly Coiffure',
  desc: `Coiffures et tarifs de Nelly Coiffure à Marseille : knotless braids ${CARTE[0].items[0].prix} €, short braids, tresses couchées, nattes collées, twists, locks, tissage, homme et enfant, dès ${PRIX_MIN} €. Réservez sur WhatsApp.`,
  preload: 'img/nelly/arch-coiffures.webp', ld: faqLd,
}, pageHero({
  crumb: 'Coiffures et tarifs', eyebrow: 'Coiffures et tarifs',
  lines: ['Des tresses', 'pensées pour', 'votre style.'],
  lead: `Tresses, twists, locks ou tissage, pour femme, homme et enfant, de ${PRIX_MIN} à ${PRIX_MAX} €. Choisissez votre coiffure, puis écrivez-moi sur WhatsApp : je vous confirme le prix et mes disponibilités.`,
  actions: `<a class="btn btn--dark btn--shine" href="#carte">Voir les tarifs ${ARROW}</a><a class="btn btn--outline" href="realisations.html">Mes réalisations</a>`,
  media: archMedia({ src: 'img/nelly/arch-coiffures.webp', pos: '50% 30%', script: ['Chaque tresse', 'a son histoire'], w: 800, h: 1000 }),
}) + `
    <section class="section section--tight">
      <div class="container">
        <nav class="style-nav" aria-label="Les coiffures">
          ${STYLES.map((s) => `<a class="chip" href="#${s.id}">${s.name}</a>`).join('\n          ')}
          <a class="chip" href="#carte">Tous les tarifs</a>
        </nav>
${STYLES.map(styleRow).join('')}      </div>
    </section>

    <section class="section" id="carte">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">La carte</p>
          <h2 class="title reveal">Prestations et tarifs</h2>
          <p class="body reveal">Tarifs de base, chez moi ou à votre domicile. Pour une longueur ou un volume particulier, je vous confirme le prix exact sur WhatsApp avant le rendez-vous.</p>
        </div>
${carteHtml()}
      </div>
    </section>

    <section class="section section--tight" id="faq">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Bon à savoir</p>
          <h2 class="title reveal">Questions fréquentes</h2>
        </div>
        <div class="faq reveal">
${FAQ.map(([q, a]) => `          <details><summary>${q.replace(' ?', '&nbsp;?')}</summary><p>${a}</p></details>`).join('\n')}
        </div>
      </div>
    </section>

` + CTA());

// Ancienne page Tarifs : redirection vers la carte (Vercel redirige aussi, voir site/vercel.json)
writeFileSync(`${SITE}/tarifs.html`, `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Tarifs — Nelly Coiffure</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="coiffures.html">
  <meta http-equiv="refresh" content="0; url=coiffures.html#carte">
</head>
<body>
  <p>Les tarifs se trouvent désormais sur la page <a href="coiffures.html#carte">Coiffures et tarifs</a>.</p>
</body>
</html>
`);

/* ------------------------------------------------------------------ RÉALISATIONS */
const GALLERY = [
  ['real-a', 'knotless', 'Knotless braids longues', 512, 688],
  ['coiffure-box', 'tresses', 'Tresses en chignon', 644, 652],
  ['real-c', 'details', 'Tresses cuivrées', 620, 308],
  ['coiffure-fulani', 'couchees', 'Tresses couchées et anneaux', 644, 652],
  ['real-b', 'tresses', 'Tresses fines, vue de dos', 440, 500],
  ['hero-sm', 'knotless', 'Knotless braids, mi-dos', 624, 768],
  ['coiffure-cornrows', 'nattes', 'Nattes collées de profil', 604, 652],
  ['real-e', 'knotless', 'Knotless braids fines', 620, 552],
  ['real-d', 'couchees', 'Tresses couchées de profil', 440, 356],
  ['univers-sm', 'tresses', 'Tresses fines aux fils cuivrés', 762, 584],
  ['coiffure-knotless', 'knotless', 'Knotless braids lâchées', 648, 652],
  ['cta-tresses-sm', 'details', 'Le détail des tresses', 392, 364],
  ['real-f', 'details', 'Finitions soignées', 512, 168],
];
const CATS = { knotless: 'Knotless', tresses: 'Tresses', couchees: 'Tresses couchées', nattes: 'Nattes collées', details: 'Détails' };
// Vraies réalisations (outils/preparer-realisations.mjs) : remplacent les visuels de la maquette dès qu'il y en a
const REELLES_FILE = new URL('./realisations.json', import.meta.url);
const REELLES = existsSync(REELLES_FILE) ? JSON.parse(readFileSync(REELLES_FILE, 'utf8')) : [];
const ITEMS = REELLES.length
  ? REELLES.map((r) => ({ src: r.src, srcset: `${r.sm} 500w, ${r.src} 1000w`, cat: r.cat, label: r.style, sub: r.prix ? `${r.prix} €` : '', w: 1000, h: 1250 }))
  : GALLERY.map(([src, cat, label, w, h]) => ({ src: `img/maquette/${src}.webp`, cat, label, sub: CATS[cat], w, h }));
const FILTRES = REELLES.length ? Object.fromEntries(REELLES.map((r) => [r.cat, r.style])) : CATS;

page('realisations.html', {
  title: 'Réalisations : tresses africaines à Marseille — Nelly Coiffure',
  desc: 'Galerie des réalisations de Nelly Coiffure : knotless braids, tresses couchées, nattes collées et plus encore à Marseille. Trouvez l’inspiration et demandez le même style sur WhatsApp.',
  preload: 'img/nelly/arch-realisations.webp',
}, pageHero({
  crumb: 'Réalisations', eyebrow: 'Réalisations',
  lines: ['Des coiffures', 'qui racontent', 'une histoire.'],
  lead: 'Parcourez mes réalisations, filtrez par style et agrandissez une photo pour la demander en un clic sur WhatsApp.',
  actions: `<a class="btn btn--dark btn--shine" href="#galerie">Voir la galerie ${ARROW}</a><a class="btn btn--outline" href="#" aria-label="Suivre Nelly Coiffure sur Instagram">Suivre sur Instagram</a>`,
  media: archMedia({ src: 'img/nelly/arch-realisations.webp', pos: '50% 20%', script: ['Laissez-vous', 'inspirer'], w: 736, h: 920 }),
}) + `
    <section class="section section--tight" id="galerie">
      <div class="container">
        <div class="filters reveal" role="group" aria-label="Filtrer par style">
          <button type="button" class="chip" aria-pressed="true" data-filter="tout">Tout <small>${ITEMS.length}</small></button>
${Object.entries(FILTRES).map(([k, v]) => `          <button type="button" class="chip" aria-pressed="false" data-filter="${k}">${v} <small>${ITEMS.filter((it) => it.cat === k).length}</small></button>`).join('\n')}
        </div>
        <div class="gallery" id="gallery">
${ITEMS.map((it) => `          <button type="button" class="gallery__item reveal" data-cat="${it.cat}" data-label="${it.label}${it.sub.endsWith('€') ? ` (${it.sub})` : ''}"><img src="${it.src}"${it.srcset ? ` srcset="${it.srcset}" sizes="(min-width: 1025px) 33vw, 50vw"` : ''} width="${it.w}" height="${it.h}" loading="lazy" alt="${it.label}"><span class="gallery__cap"><b>${it.label}</b><span>${it.sub}</span></span></button>`).join('\n')}
        </div>
        <div class="insta-band reveal">
          <div>
            <h2>Encore plus d’inspiration</h2>
            <p>Mes dernières créations et coulisses, chaque semaine sur Instagram et TikTok.</p>
          </div>
          <a class="btn btn--dark btn--shine" href="#"><svg class="icon" aria-hidden="true"><use href="#i-instagram"/></svg> Suivre @nellycoiffure</a>
        </div>
      </div>
    </section>

` + CTA('Un style vous plaît ? <br>Il peut être le vôtre.', 'Envoyez-moi la photo de la réalisation qui vous inspire, je vous réponds avec un tarif et mes disponibilités.'));

/* ------------------------------------------------------------------ À PROPOS */
page('a-propos.html', {
  title: 'À propos de Nelly, coiffeuse tresses africaines à Marseille — Nelly Coiffure',
  desc: 'Nelly, coiffeuse spécialisée en tresses africaines à Marseille : son histoire, ses valeurs et les avis de ses clientes. Chez elle ou à domicile.',
  preload: 'img/nelly/arch-apropos.webp',
}, pageHero({
  crumb: 'À propos', eyebrow: 'À propos',
  lines: ['Des mains', 'qui tressent,', 'un cœur qui écoute.'],
  lead: 'Je m’appelle Nelly. Depuis toujours, je tresse avec patience et passion pour que chaque cliente reparte belle, à l’aise et fière de sa couronne.',
  actions: `<a class="btn btn--dark btn--shine" href="#histoire">Mon histoire ${ARROW}</a><a class="btn btn--outline" href="#avis">Les avis clientes</a>`,
  media: archMedia({ src: 'img/nelly/arch-apropos.webp', pos: '50% 25%', script: ['Bienvenue', 'chez moi'], w: 800, h: 1000 }),
}) + `
    <section class="section" id="histoire">
      <div class="container story">
        <p class="story__quote reveal">Une belle tresse, c’est d’abord une cliente qui se sent écoutée.<span class="story__sign">Nelly</span></p>
        <div class="story__text">
          <p class="reveal">Tout a commencé dans la cuisine familiale, entre les mains de ma mère et de mes tantes. Très tôt, j’ai appris que tresser, c’est prendre le temps : écouter, démêler, rassurer, et transmettre un savoir-faire qui traverse les générations.</p>
          <p class="reveal">Aujourd’hui installée à Marseille, j’ai fait de cette passion mon métier. Tresses, twists, locks ou tissage : chaque coiffure est pensée pour votre visage, votre rythme de vie et la santé de vos cheveux.</p>
          <p class="reveal">Je vous reçois chez moi, dans un espace calme et chaleureux, ou je me déplace chez vous. Dans les deux cas, ma priorité reste la même : que vous vous sentiez bien, du premier message jusqu’à la dernière tresse.</p>
          <a class="btn btn--dark btn--shine reveal" data-wa="Bonjour Nelly, j'ai lu votre histoire sur votre site et j'aimerais prendre rendez-vous." href="contact.html">${WA} Faire connaissance ${ARROW}</a>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Mes engagements</p>
          <h2 class="title reveal">Ce qui guide chaque séance</h2>
        </div>
        <div class="values" data-stagger>
          <div class="value reveal"><h3>Écoute</h3><p>On définit ensemble le style, la longueur et l’épaisseur avant de commencer. Rien n’est laissé au hasard.</p></div>
          <div class="value reveal"><h3>Douceur</h3><p>Des tresses sans tension excessive, qui respectent vos racines et votre cuir chevelu.</p></div>
          <div class="value reveal"><h3>Exigence</h3><p>Des sections nettes, des tresses régulières et des finitions soignées, jusqu’aux pointes.</p></div>
          <div class="value reveal"><h3>Hygiène</h3><p>Matériel nettoyé et désinfecté entre chaque cliente, mèches neuves à chaque prestation.</p></div>
        </div>
      </div>
    </section>

    <section class="reviews-section" id="avis">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Avis clientes</p>
          <h2 class="title reveal">Elles en parlent mieux que moi</h2>
        </div>
        <div class="reviews" data-stagger>
${REVIEWS.map((r) => '          ' + review(r, ' reveal')).join('\n')}
        </div>
      </div>
    </section>

` + CTA());

/* ------------------------------------------------------------------ CONTACT */
page('contact.html', {
  title: 'Contact — Discutez avec Nelly sur WhatsApp | Nelly Coiffure, Marseille',
  desc: 'Une envie de tresses ? Discutez directement avec Nelly sur WhatsApp : conseils, tarif et rendez-vous, chez elle ou à domicile à Marseille.',
  bodyClass: 'page page--contact',
  ld: "  <script type=\"application/ld+json\">\n  {\"@context\": \"https://schema.org\", \"@type\": \"HairSalon\", \"name\": \"Nelly Coiffure\", \"description\": \"Tresses africaines à Marseille, chez la coiffeuse ou à domicile.\", \"image\": \"img/marque/partage.jpg\", \"priceRange\": \"30 € – 80 €\", \"address\": {\"@type\": \"PostalAddress\", \"addressLocality\": \"Marseille\", \"addressRegion\": \"Provence-Alpes-Côte d'Azur\", \"addressCountry\": \"FR\"}, \"areaServed\": [\"Marseille\", \"Aubagne\", \"Allauch\", \"Plan-de-Cuques\", \"Cassis\"], \"openingHoursSpecification\": [{\"@type\": \"OpeningHoursSpecification\", \"dayOfWeek\": [\"Monday\", \"Tuesday\", \"Wednesday\", \"Thursday\", \"Friday\"], \"opens\": \"09:00\", \"closes\": \"19:00\"}, {\"@type\": \"OpeningHoursSpecification\", \"dayOfWeek\": \"Saturday\", \"opens\": \"08:00\", \"closes\": \"18:00\"}]}\n  </script>\n",
}, `    <section class="page-hero contact-hero">
      <div class="container page-hero__inner">
        <div class="page-hero__text">
          <ol class="crumbs intro" style="--d: 0s" aria-label="Fil d'Ariane"><li><a href="index.html">Accueil</a></li><li aria-current="page">Contact</li></ol>
          <p class="eyebrow intro" style="--d: .1s">Contact</p>
          <h1 class="page-hero__title">
            <span class="line"><span class="intro" style="--d: .2s">Parlons de</span></span>
            <span class="line"><span class="intro" style="--d: .32s">votre prochaine</span></span>
            <span class="line"><span class="intro accent" style="--d: .44s">coiffure.</span></span>
          </h1>
          <p class="page-hero__lead intro" style="--d: .6s">Pas de formulaire&nbsp;: écrivez-moi simplement sur WhatsApp. Envoyez une photo du style qui vous plaît, on discute ensemble de vos envies, du tarif et du moment qui vous convient.</p>
          <div class="contact-hero__action intro" style="--d: .72s">
            <a class="btn btn--wa btn--shine" data-wa="Bonjour Nelly, j'ai vu votre site et j'aimerais discuter d'une coiffure avec vous." href="https://wa.me/">${WA} Discuter avec Nelly ${ARROW}</a>
            <ul class="contact-hero__trust">
              <li>Réponse rapide</li><li>Sans engagement</li><li>Conseils personnalisés</li>
            </ul>
          </div>
        </div>

        <div class="chat intro" style="--d: .3s" id="chat" aria-hidden="true">
          <div class="chat__head">
            <span class="chat__avatar">N</span>
            <div><b>Nelly Coiffure</b><small class="chat__status" id="chat-status">en ligne</small></div>
          </div>
          <div class="chat__body" id="chat-body">
            <p class="chat__day">Aujourd’hui</p>
          </div>
          <div class="chat__input">
            <span class="chat__field" id="chat-field">Message</span>
            <span class="chat__send"><svg aria-hidden="true"><use href="#i-arrow"/></svg></span>
          </div>
        </div>
      </div>
    </section>

    <section class="section contact-info">
      <div class="container">
        <div class="info-band" data-stagger>
          <div class="info-band__item reveal">
            <h2 class="eyebrow">Disponibilités</h2>
            <dl class="hours">
              <div><dt>Lundi – vendredi</dt><dd>9 h – 19 h</dd></div>
              <div><dt>Samedi</dt><dd>8 h – 18 h</dd></div>
              <div><dt>Dimanche</dt><dd>Sur demande</dd></div>
            </dl>
          </div>
          <div class="info-band__item reveal">
            <h2 class="eyebrow">Où<p class="eyebrow">Où&nbsp;?</p>nbsp;?</h2>
            <p class="info-band__big">Marseille <span>et alentours</span></p>
            <p>Chez moi, dans un espace calme et dédié, ou directement chez vous, du 1er au 16e arrondissement et dans les communes voisines (Aubagne, Allauch, Plan-de-Cuques, Les Pennes-Mirabeau, Septèmes-les-Vallons, Cassis). Le lieu se décide ensemble sur WhatsApp&nbsp;; l’adresse exacte vous est envoyée à la confirmation.</p>
          </div>
          <div class="info-band__item reveal">
            <h2 class="eyebrow">Me suivre</h2>
            <ul class="social-links">
              <li><a href="#"><span>Instagram</span><small>@nellycoiffure</small><svg aria-hidden="true"><use href="#i-arrow"/></svg></a></li>
              <li><a href="#"><span>TikTok</span><small>@nellycoiffure</small><svg aria-hidden="true"><use href="#i-arrow"/></svg></a></li>
            </ul>
            <p class="note">Mes dernières créations et coulisses, chaque semaine.</p>
          </div>
        </div>
      </div>
    </section>
`);

/* ------------------------------------------------------------------ PAGES LÉGALES */
const legal = (file, crumb, title, body) => page(file, {
  title: `${crumb} — Nelly Coiffure`, desc: `${crumb} du site Nelly Coiffure, tresses africaines à Marseille.`, bodyClass: 'page page--legal',
}, `    <section class="page-hero legal-hero">
      <div class="container">
        <ol class="crumbs intro" style="--d: 0s" aria-label="Fil d'Ariane"><li><a href="index.html">Accueil</a></li><li aria-current="page">${crumb}</li></ol>
        <h1 class="page-hero__title"><span class="line"><span class="intro" style="--d: .15s">${title}</span></span></h1>
      </div>
    </section>
    <section class="section section--tight">
      <div class="container legal reveal">
${body}
      </div>
    </section>
`);

legal('mentions-legales.html', 'Mentions légales', 'Mentions légales', `        <p class="legal__todo">Les éléments entre crochets sont à compléter avant la mise en ligne.</p>
        <h2>Éditrice du site</h2>
        <p>Nelly Coiffure, entreprise individuelle de [Prénom Nom].<br>SIRET&nbsp;: [numéro SIRET].<br>Adresse&nbsp;: [adresse professionnelle], Marseille.<br>Contact&nbsp;: via WhatsApp au [numéro].</p>
        <p>Directrice de la publication&nbsp;: [Prénom Nom].</p>
        <h2>Hébergement</h2>
        <p>[Nom de l’hébergeur], [adresse de l’hébergeur], [téléphone ou site web].</p>
        <h2>Propriété intellectuelle</h2>
        <p>L’ensemble des contenus de ce site (textes, logo, photographies, mise en page) est la propriété de Nelly Coiffure ou de ses partenaires. Toute reproduction sans autorisation écrite préalable est interdite.</p>
        <h2>Tarifs</h2>
        <p>Les tarifs affichés sont indicatifs et exprimés en euros. Le prix définitif est confirmé avec Nelly avant chaque prestation.</p>`);

legal('confidentialite.html', 'Confidentialité', 'Politique de confidentialité', `        <h2>Données collectées</h2>
        <p>Ce site ne comporte aucun formulaire et ne collecte directement aucune donnée personnelle. Il n’utilise ni cookie publicitaire ni outil de mesure d’audience.</p>
        <h2>Contact via WhatsApp</h2>
        <p>Les boutons « WhatsApp » ouvrent une conversation avec Nelly dans l’application WhatsApp, éditée par WhatsApp Ireland Limited. Les messages échangés sont alors soumis à la <a href="https://www.whatsapp.com/legal/privacy-policy-eea" rel="noopener" target="_blank">politique de confidentialité de WhatsApp</a>. Nelly utilise ces échanges uniquement pour répondre à votre demande et organiser votre rendez-vous.</p>
        <h2>Polices d’écriture</h2>
        <p>Les polices du site sont chargées depuis Google Fonts. Votre navigateur transmet à cette occasion votre adresse IP à Google.</p>
        <h2>Vos droits</h2>
        <p>Conformément au RGPD, vous pouvez demander l’accès, la rectification ou la suppression des informations échangées avec Nelly en lui écrivant sur WhatsApp. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).</p>`);

/* ------------------------------------------------------------------ 404 */
page('404.html', {
  title: 'Page introuvable — Nelly Coiffure', desc: 'Cette page n’existe pas ou a été déplacée.', bodyClass: 'page page--legal',
  ld: '  <meta name="robots" content="noindex">\n',
}, `    <section class="page-hero error-hero">
      <div class="container">
        <p class="error-hero__code intro" style="--d: 0s">404</p>
        <h1 class="page-hero__title"><span class="line"><span class="intro" style="--d: .15s">Cette page s’est <span class="accent">détressée.</span></span></span></h1>
        <p class="page-hero__lead intro" style="--d: .35s">Le lien que vous avez suivi n’existe plus ou a été déplacé. Revenez à l’accueil, ou écrivez-moi directement sur WhatsApp.</p>
        <div class="page-hero__actions intro" style="--d: .5s"><a class="btn btn--dark btn--shine" href="index.html">Retour à l’accueil ${ARROW}</a><a class="btn btn--outline" data-wa="Bonjour Nelly, j'aimerais un renseignement pour une coiffure." href="contact.html">M’écrire</a></div>
      </div>
    </section>
`);
