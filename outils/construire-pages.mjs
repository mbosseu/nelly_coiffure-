// Génère les pages intérieures (coiffures, tarifs, réalisations, à propos, contact, pages légales, 404)
// à partir de l'en-tête et du pied de page d'index.html. Usage : node outils/construire-pages.mjs
// Attention : écrase ces pages ; modifier leur contenu ici, pas directement dans le HTML.
import { readFileSync, writeFileSync } from 'node:fs';

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

/* ------------------------------------------------------------------ COIFFURES */
const STYLES = [
  { id: 'knotless', name: 'Knotless Braids', tag: 'Légèreté et élégance', img: 'coiffure-knotless', w: 648, h: 652,
    body: 'Des tresses sans nœud à la racine : la mèche est ajoutée progressivement pour un départ plat, naturel et sans tension. Plus légères à porter, elles respectent votre cuir chevelu dès le premier jour.',
    meta: ['4 à 7 h', '6 à 8 sem.', 'Dès 90 €'], ideal: ['Vous avez le cuir chevelu sensible', 'Vous voulez un rendu naturel dès la racine', 'Vous aimez les coiffures hautes, sans douleur'] },
  { id: 'box-braids', name: 'Box Braids', tag: 'Un intemporel moderne', img: 'coiffure-box', w: 644, h: 652,
    body: 'Les tresses emblématiques, réparties en sections carrées bien nettes. Fines, moyennes ou épaisses, courtes ou très longues : elles se portent lâchées, en chignon ou en queue haute.',
    meta: ['4 à 6 h', '6 à 8 sem.', 'Dès 80 €'], ideal: ['Vous cherchez une coiffure protectrice durable', 'Vous aimez le volume et la tenue', 'Vous aimez changer de coiffage chaque semaine'] },
  { id: 'fulani', name: 'Fulani Braids', tag: 'Tradition et modernité', img: 'coiffure-fulani', w: 644, h: 652,
    body: 'Inspirées des coiffures peules, elles associent des tresses plaquées sur le dessus et des tresses libres, souvent ornées de perles ou d’anneaux dorés. Un style graphique qui ne passe pas inaperçu.',
    meta: ['3 à 5 h', '4 à 6 sem.', 'Dès 70 €'], ideal: ['Vous aimez les bijoux et les détails', 'Vous voulez un style original', 'Vous préparez un événement'] },
  { id: 'cornrows', name: 'Cornrows', tag: 'Un style structuré', img: 'coiffure-cornrows', w: 604, h: 652,
    body: 'Des tresses plaquées au plus près du cuir chevelu, droites ou en motifs. Rapides, pratiques et élégantes, elles conviennent aussi aux enfants et aux hommes.',
    meta: ['2 à 3 h', '2 à 4 sem.', 'Dès 35 €'], ideal: ['Vous voulez une coiffure rapide', 'Vous faites du sport', 'Vous cherchez un style net pour toute la famille'] },
];
const styleRow = (s, i) => `        <article class="style" id="${s.id}">
          <div class="style__media reveal">
            <span class="style__num" aria-hidden="true">0${i + 1}</span>
            <span class="style__frame" aria-hidden="true"></span>
            <div class="style__img"><img src="img/maquette/${s.img}.webp" width="${s.w}" height="${s.h}" loading="lazy" alt="${s.name}"></div>
          </div>
          <div class="style__text">
            <h2 class="title reveal">${s.name}</h2>
            <p class="style__tag reveal">${s.tag}</p>
            <p class="body reveal">${s.body}</p>
            <dl class="style__meta reveal">
              <div><dt>Durée</dt><dd>${s.meta[0]}</dd></div>
              <div><dt>Tenue</dt><dd>${s.meta[1]}</dd></div>
              <div><dt>Tarif</dt><dd>${s.meta[2]}</dd></div>
            </dl>
            <ul class="check-list reveal">${s.ideal.map((x) => `<li>${x}</li>`).join('')}</ul>
            <div class="style__actions reveal">
              <a class="btn btn--dark btn--shine" data-wa="Bonjour Nelly, je suis intéressée par des ${s.name.toLowerCase()}. Pouvez-vous me donner un tarif et vos disponibilités ?" href="contact.html">${WA} Demander ce style ${ARROW}</a>
              <a class="btn btn--outline" href="tarifs.html">Voir les tarifs</a>
            </div>
          </div>
        </article>
`;

page('coiffures.html', {
  title: 'Coiffures : knotless, box braids, fulani, cornrows à Marseille — Nelly Coiffure',
  desc: 'Knotless braids, box braids, fulani braids et cornrows à Marseille : durée, tenue, tarifs. Trouvez votre style et réservez sur WhatsApp, chez Nelly ou à domicile.',
  preload: 'img/maquette/univers.webp',
}, pageHero({
  crumb: 'Coiffures', eyebrow: 'Nos coiffures',
  lines: ['Des tresses', 'pensées pour', 'votre style.'],
  lead: 'Knotless, box braids, fulani ou cornrows : découvrez chaque coiffure en détail, sa durée, sa tenue et son tarif. Vous hésitez ? Faites le test, je vous guide.',
  actions: `<a class="btn btn--dark btn--shine" href="#trouver">Trouver ma tresse ${ARROW}</a><a class="btn btn--outline" href="tarifs.html">Voir les tarifs</a>`,
  media: archMedia({ src: 'img/maquette/univers.webp', pos: '68% 40%', script: ['Chaque tresse', 'a son histoire'], w: 1524, h: 1168 }),
}) + `
    <section class="section section--tight">
      <div class="container">
        <nav class="style-nav" aria-label="Les coiffures">
          ${STYLES.map((s) => `<a class="chip" href="#${s.id}">${s.name}</a>`).join('\n          ')}
          <a class="chip" href="#autres">Autres prestations</a>
        </nav>
${STYLES.map(styleRow).join('')}      </div>
    </section>

    <section class="finder" id="trouver">
      <svg class="cta__curve" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L1440 0 L1440 34 C 1260 96, 1060 108, 860 96 C 760 90, 720 40, 600 26 C 380 4, 160 30, 0 22 Z" fill="var(--cream)"/>
      </svg>
      <div class="container finder__inner">
        <div class="finder__intro">
          <p class="eyebrow eyebrow--copper reveal">Trouver ma tresse</p>
          <h2 class="title title--light reveal">Trois questions, <br>votre style idéal.</h2>
          <p class="body body--light reveal">Répondez en quelques secondes : je vous recommande la coiffure la plus adaptée à votre rythme et à vos envies, avec un message prêt à m’envoyer.</p>
        </div>
        <div class="finder__card reveal" id="finder-card" aria-live="polite">
          <noscript><a class="btn btn--light" href="contact.html">Me contacter pour un conseil</a></noscript>
        </div>
      </div>
    </section>

    <section class="section" id="autres">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Et aussi</p>
          <h2 class="title reveal">Autres prestations</h2>
        </div>
        <div class="extras-grid" data-stagger>
          <div class="extra reveal"><span class="option__icon"><svg aria-hidden="true"><use href="#i-child"/></svg></span><h3>Tresses enfants</h3><p>Des coiffures douces et adaptées aux petites têtes, avec patience et bonne humeur, dès 4 ans.</p><span class="extra__price">−20 % pour les moins de 12 ans</span></div>
          <div class="extra reveal"><span class="option__icon"><svg aria-hidden="true"><use href="#i-scissors"/></svg></span><h3>Défaire vos tresses</h3><p>Retrait délicat des tresses, démêlage et soin hydratant pour préparer votre prochaine coiffure.</p><span class="extra__price">Dès 20 €</span></div>
          <div class="extra reveal"><span class="option__icon"><svg aria-hidden="true"><use href="#i-sparkle"/></svg></span><h3>Coiffage événement</h3><p>Chignon, queue haute ou demi-attaché sur vos tresses pour un mariage, un baptême ou une soirée.</p><span class="extra__price">Dès 15 €</span></div>
        </div>
      </div>
    </section>

` + CTA());

/* ------------------------------------------------------------------ TARIFS */
const PRICES = [
  { name: 'Knotless braids', img: 'coiffure-knotless', time: '4 à 7 h', featured: true, rows: [['Épaules', 90], ['Mi-dos', 110], ['Bas du dos', 140]] },
  { name: 'Box braids', img: 'coiffure-box', time: '4 à 6 h', rows: [['Épaules', 80], ['Mi-dos', 100], ['Bas du dos', 130]] },
  { name: 'Fulani braids', img: 'coiffure-fulani', time: '3 à 5 h', rows: [['Épaules', 70], ['Mi-dos', 90], ['Bas du dos', 110]] },
  { name: 'Cornrows', img: 'coiffure-cornrows', time: '2 à 3 h', rows: [['Sans mèches', 35], ['Avec mèches', 50], ['Motifs libres', 65]] },
];
const priceCard = (p) => `          <article class="price-card${p.featured ? ' price-card--featured' : ''} reveal" data-name="${p.name}">
            ${p.featured ? '<span class="price-card__badge">La plus demandée</span>' : ''}
            <div class="price-card__thumb"><img src="img/maquette/${p.img}.webp" width="74" height="88" loading="lazy" alt=""></div>
            <h3>${p.name}</h3>
            <p class="price-card__time"><svg aria-hidden="true"><use href="#i-clock"/></svg> ${p.time}</p>
            <ul class="price-rows">${p.rows.map(([l, v]) => `<li data-label="${l}" data-price="${v}">${l}<b>${v} €</b></li>`).join('')}</ul>
            <a class="btn ${p.featured ? 'btn--light' : 'btn--dark'} btn--shine" data-wa="Bonjour Nelly, je souhaite réserver des ${p.name.toLowerCase()}. Quelles sont vos disponibilités ?" href="contact.html">${WA} Réserver</a>
          </article>
`;
const FAQ = [
  ['Les mèches sont-elles comprises dans le prix ?', 'Oui, les mèches sont incluses dans tous les tarifs pour les couleurs classiques (noir, brun, châtain). Pour une couleur particulière, précisez-le dans votre message : je vous indique le petit supplément éventuel.'],
  ['Comment préparer mes cheveux avant le rendez-vous ?', 'Venez avec des cheveux lavés, bien démêlés et secs, sans huile ni produit gras. Si vous portez encore des tresses, je peux les défaire avant la séance (à partir de 20 €).'],
  ['Combien de temps tiennent les tresses ?', 'Comptez 6 à 8 semaines pour des knotless ou des box braids, 4 à 6 semaines pour des fulani et 2 à 4 semaines pour des cornrows. Je vous donne mes conseils d’entretien à la fin de chaque séance.'],
  ['Faut-il verser un acompte ?', 'Pour les coiffures de plus de 4 heures, un acompte de 20 € peut être demandé pour bloquer le créneau. Il est bien sûr déduit du prix final.'],
  ['Et si je dois annuler ou décaler ?', 'Prévenez-moi au moins 24 heures à l’avance sur WhatsApp, on trouve un autre créneau sans souci.'],
  ['Quels moyens de paiement acceptez-vous ?', 'Espèces ou virement instantané, le jour du rendez-vous.'],
  ['Coiffez-vous les enfants ?', 'Oui, dès 4 ans, avec des coiffures adaptées et une remise de 20 % pour les moins de 12 ans.'],
];
const faqLd = `  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}
  </script>
`;

page('tarifs.html', {
  title: 'Tarifs tresses africaines à Marseille — Nelly Coiffure',
  desc: 'Tarifs des knotless braids, box braids, fulani braids et cornrows à Marseille, mèches incluses. Estimez votre prix en ligne et réservez sur WhatsApp.',
  preload: 'img/maquette/coiffure-box.webp', ld: faqLd,
}, pageHero({
  crumb: 'Tarifs', eyebrow: 'Tarifs',
  lines: ['Des prix clairs,', 'mèches', 'incluses.'],
  lead: 'Pas de mauvaise surprise : chaque tarif comprend les mèches et les conseils d’entretien. Estimez votre prix en quelques clics, puis confirmez avec moi sur WhatsApp.',
  actions: `<a class="btn btn--dark btn--shine" href="#estimer">Estimer mon tarif ${ARROW}</a><a class="btn btn--outline" href="#grille">Voir la grille</a>`,
  media: archMedia({ src: 'img/maquette/coiffure-box.webp', pos: '50% 30%', script: ['Transparence', 'et douceur'], w: 644, h: 652 }),
}) + `
    <section class="section section--tight" id="grille">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">La grille</p>
          <h2 class="title reveal">Tarifs selon la longueur</h2>
          <p class="body reveal">Prix « à partir de », pour une épaisseur moyenne. Le tarif exact dépend de la finesse des tresses et du volume de vos cheveux.</p>
        </div>
        <div class="price-grid" data-stagger>
${PRICES.map(priceCard).join('')}        </div>
        <div class="addons" data-stagger>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-home"/></svg><h3>Chez Nelly</h3><p>Offert</p></div>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-car"/></svg><h3>Domicile Marseille</h3><p>+10 €</p></div>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-pin"/></svg><h3>Communes voisines</h3><p>+20 €</p></div>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-ring"/></svg><h3>Perles et anneaux</h3><p>+5 €</p></div>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-child"/></svg><h3>Moins de 12 ans</h3><p>−20 %</p></div>
          <div class="addon reveal"><svg aria-hidden="true"><use href="#i-scissors"/></svg><h3>Défaire les tresses</h3><p>Dès 20 €</p></div>
        </div>
      </div>
    </section>

    <section class="section section--tight" id="estimer">
      <div class="container">
        <div class="estimator__box reveal" id="estimator">
          <div class="estimator__form">
            <div>
              <p class="eyebrow">Estimateur</p>
              <h2 class="title">Combien va coûter ma coiffure&nbsp;?</h2>
            </div>
            <div><span class="field-label" id="lbl-style">Le style</span><div class="chips" data-est="style" role="group" aria-labelledby="lbl-style">${PRICES.map((p, i) => `<button type="button" class="chip" aria-pressed="${i === 0}">${p.name}</button>`).join('')}</div></div>
            <div><span class="field-label" id="lbl-opt">Longueur ou option</span><div class="chips" data-est="opt" role="group" aria-labelledby="lbl-opt"></div></div>
            <div><span class="field-label" id="lbl-lieu">Le lieu</span><div class="chips" data-est="lieu" role="group" aria-labelledby="lbl-lieu"><button type="button" class="chip" aria-pressed="true" data-price="0">Chez Nelly</button><button type="button" class="chip" aria-pressed="false" data-price="10">À domicile, Marseille</button><button type="button" class="chip" aria-pressed="false" data-price="20">À domicile, communes voisines</button></div></div>
            <div class="chips"><label class="toggle"><input type="checkbox" id="est-acc"> Perles et anneaux</label><label class="toggle"><input type="checkbox" id="est-kid"> Pour un enfant (−12 ans)</label></div>
          </div>
          <div class="estimator__result" aria-live="polite">
            <p class="estimator__label">Votre estimation</p>
            <p class="estimator__total">110 €</p>
            <p class="estimator__detail"></p>
            <a class="btn btn--light btn--shine" id="estimator-wa" href="contact.html">${WA} Réserver ce tarif</a>
            <p class="note">Estimation indicative, confirmée par Nelly sur WhatsApp selon vos cheveux.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="faq">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Questions fréquentes</p>
          <h2 class="title reveal">Bon à savoir</h2>
        </div>
        <div class="faq reveal">
${FAQ.map(([q, a], i) => `          <details${i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
        </div>
      </div>
    </section>

` + CTA('Une question <br>sur un tarif ?', 'Envoyez-moi une photo du style qui vous plaît : je vous réponds avec un prix précis et mes prochaines disponibilités.'));

/* ------------------------------------------------------------------ RÉALISATIONS */
const GALLERY = [
  ['real-a', 'knotless', 'Knotless braids longues', 512, 688],
  ['coiffure-box', 'box', 'Box braids en chignon', 644, 652],
  ['real-c', 'details', 'Tresses cuivrées', 620, 308],
  ['coiffure-fulani', 'fulani', 'Fulani braids et anneaux', 644, 652],
  ['real-b', 'box', 'Tresses fines, vue de dos', 440, 500],
  ['hero-sm', 'knotless', 'Knotless braids, mi-dos', 624, 768],
  ['coiffure-cornrows', 'cornrows', 'Cornrows de profil', 604, 652],
  ['real-e', 'knotless', 'Knotless braids fines', 620, 552],
  ['real-d', 'fulani', 'Fulani braids de profil', 440, 356],
  ['univers-sm', 'box', 'Tresses fines aux fils cuivrés', 762, 584],
  ['coiffure-knotless', 'knotless', 'Knotless braids lâchées', 648, 652],
  ['cta-tresses-sm', 'details', 'Le détail des tresses', 392, 364],
  ['real-f', 'details', 'Finitions soignées', 512, 168],
];
const CATS = { knotless: 'Knotless', box: 'Box braids', fulani: 'Fulani', cornrows: 'Cornrows', details: 'Détails' };

page('realisations.html', {
  title: 'Réalisations : tresses africaines à Marseille — Nelly Coiffure',
  desc: 'Galerie des réalisations de Nelly Coiffure : knotless braids, box braids, fulani braids et cornrows à Marseille. Trouvez l’inspiration et demandez le même style sur WhatsApp.',
  preload: 'img/maquette/real-a.webp',
}, pageHero({
  crumb: 'Réalisations', eyebrow: 'Réalisations',
  lines: ['Des coiffures', 'qui racontent', 'une histoire.'],
  lead: 'Parcourez mes réalisations, filtrez par style et agrandissez une photo pour la demander en un clic sur WhatsApp.',
  actions: `<a class="btn btn--dark btn--shine" href="#galerie">Voir la galerie ${ARROW}</a><a class="btn btn--outline" href="#" aria-label="Suivre Nelly Coiffure sur Instagram">Suivre sur Instagram</a>`,
  media: archMedia({ src: 'img/maquette/real-a.webp', pos: '50% 30%', script: ['Laissez-vous', 'inspirer'], w: 512, h: 688 }),
}) + `
    <section class="section section--tight" id="galerie">
      <div class="container">
        <div class="filters reveal" role="group" aria-label="Filtrer par style">
          <button type="button" class="chip" aria-pressed="true" data-filter="tout">Tout <small>${GALLERY.length}</small></button>
${Object.entries(CATS).map(([k, v]) => `          <button type="button" class="chip" aria-pressed="false" data-filter="${k}">${v} <small>${GALLERY.filter((g) => g[1] === k).length}</small></button>`).join('\n')}
        </div>
        <div class="gallery" id="gallery">
${GALLERY.map(([src, cat, label, w, h]) => `          <button type="button" class="gallery__item reveal" data-cat="${cat}" data-label="${label}"><img src="img/maquette/${src}.webp" width="${w}" height="${h}" loading="lazy" alt="${label}"><span class="gallery__cap"><b>${label}</b><span>${CATS[cat]}</span></span></button>`).join('\n')}
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
  preload: 'img/maquette/espace.webp',
}, pageHero({
  crumb: 'À propos', eyebrow: 'À propos',
  lines: ['Des mains', 'qui tressent,', 'un cœur qui écoute.'],
  lead: 'Je m’appelle Nelly. Depuis toujours, je tresse avec patience et passion pour que chaque cliente reparte belle, à l’aise et fière de sa couronne.',
  actions: `<a class="btn btn--dark btn--shine" href="#histoire">Mon histoire ${ARROW}</a><a class="btn btn--outline" href="#avis">Les avis clientes</a>`,
  media: archMedia({ src: 'img/maquette/espace.webp', pos: '22% 50%', script: ['Bienvenue', 'chez moi'], w: 1240, h: 868 }),
}) + `
    <section class="section" id="histoire">
      <div class="container story">
        <p class="story__quote reveal">Une belle tresse, c’est d’abord une cliente qui se sent écoutée.<span class="story__sign">Nelly</span></p>
        <div class="story__text">
          <p class="reveal">Tout a commencé dans la cuisine familiale, entre les mains de ma mère et de mes tantes. Très tôt, j’ai appris que tresser, c’est prendre le temps : écouter, démêler, rassurer, et transmettre un savoir-faire qui traverse les générations.</p>
          <p class="reveal">Aujourd’hui installée à Marseille, j’ai fait de cette passion mon métier. Knotless, box braids, fulani ou cornrows : chaque coiffure est pensée pour votre visage, votre rythme de vie et la santé de vos cheveux.</p>
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
  ld: "  <script type=\"application/ld+json\">\n  {\"@context\": \"https://schema.org\", \"@type\": \"HairSalon\", \"name\": \"Nelly Coiffure\", \"description\": \"Tresses africaines à Marseille, chez la coiffeuse ou à domicile.\", \"image\": \"img/marque/partage.jpg\", \"priceRange\": \"35 € – 140 €\", \"address\": {\"@type\": \"PostalAddress\", \"addressLocality\": \"Marseille\", \"addressRegion\": \"Provence-Alpes-Côte d'Azur\", \"addressCountry\": \"FR\"}, \"areaServed\": [\"Marseille\", \"Aubagne\", \"Allauch\", \"Plan-de-Cuques\", \"Cassis\"], \"openingHoursSpecification\": [{\"@type\": \"OpeningHoursSpecification\", \"dayOfWeek\": [\"Monday\", \"Tuesday\", \"Wednesday\", \"Thursday\", \"Friday\"], \"opens\": \"09:00\", \"closes\": \"19:00\"}, {\"@type\": \"OpeningHoursSpecification\", \"dayOfWeek\": \"Saturday\", \"opens\": \"08:00\", \"closes\": \"18:00\"}]}\n  </script>\n",
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
            <p class="eyebrow">Disponibilités</p>
            <dl class="hours">
              <div><dt>Lundi – vendredi</dt><dd>9 h – 19 h</dd></div>
              <div><dt>Samedi</dt><dd>8 h – 18 h</dd></div>
              <div><dt>Dimanche</dt><dd>Sur demande</dd></div>
            </dl>
          </div>
          <div class="info-band__item reveal">
            <p class="eyebrow">Où&nbsp;?</p>
            <p class="info-band__big">Marseille <span>et alentours</span></p>
            <p>Chez moi, dans un espace calme et dédié, ou directement chez vous. Le lieu se décide ensemble sur WhatsApp&nbsp;; l’adresse exacte vous est envoyée à la confirmation.</p>
          </div>
          <div class="info-band__item reveal">
            <p class="eyebrow">Me suivre</p>
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
        <p class="page-hero__lead intro" style="--d: .35s">Le lien que vous avez suivi n’existe plus ou a été déplacé. Revenez à l’accueil, ou écrivez directement à Nelly.</p>
        <div class="page-hero__actions intro" style="--d: .5s"><a class="btn btn--dark btn--shine" href="index.html">Retour à l’accueil ${ARROW}</a><a class="btn btn--outline" data-wa="Bonjour Nelly, j'aimerais un renseignement pour une coiffure." href="contact.html">Écrire à Nelly</a></div>
      </div>
    </section>
`);
