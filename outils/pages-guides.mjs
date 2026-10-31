import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Pages guides (référencement) : une page par recherche visée (knotless braids, locks, tresses enfant, coiffure à domicile, conseils).
// Elles reprennent l'en-tête et le pied de page de mentions-legales.html, puis seo.mjs ajoute leurs balises.
// À relancer seulement pour réécrire ces deux pages : node outils/pages-guides.mjs && node outils/seo.mjs

const SITE = path.resolve(import.meta.dirname, '../site');
const modele = readFileSync(path.join(SITE, 'mentions-legales.html'), 'utf8');
const NL = modele.includes('\r\n') ? '\r\n' : '\n';
const WA = 'Bonjour Nelly, je souhaite prendre rendez-vous pour une coiffure.';

const faq = (questions) => `
    <section class="section section--tight" id="faq">
      <div class="container">
        <div class="section-intro">
          <p class="eyebrow reveal">Bon à savoir</p>
          <h2 class="title reveal">Questions fréquentes</h2>
        </div>
        <div class="faq reveal">
${questions.map(([q, r]) => `          <details><summary>${q}</summary><p>${r}</p></details>`).join('\n')}
        </div>
      </div>
    </section>`;

const cta = (accroche) => `
    <section class="cta" id="rendez-vous">
      <svg class="cta__curve" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L1440 0 L1440 34 C 1260 96, 1060 108, 860 96 C 760 90, 720 40, 600 26 C 380 4, 160 30, 0 22 Z" fill="var(--cream)"/>
      </svg>
      <div class="cta__texture" data-parallax="-0.06" aria-hidden="true"></div>
      <div class="container cta__inner">
        <div class="cta__text">
          <p class="eyebrow eyebrow--copper reveal">Prête à révéler votre beauté&nbsp;?</p>
          <h2 class="title title--light reveal">${accroche}</h2>
          <p class="body body--light reveal">Envoyez-moi une photo du style qui vous plaît sur WhatsApp : je vous réponds avec le prix, la durée et mes disponibilités.</p>
          <a class="btn btn--light btn--shine reveal" data-wa="${WA}" href="contact.html">
            <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg> Prendre rendez-vous sur WhatsApp <svg class="arrow" aria-hidden="true"><use href="#i-arrow"/></svg>
          </a>
        </div>
        <ul class="cta__list" data-stagger>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-calendar"/></svg></span>Conseils personnalisés</li>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-shield"/></svg></span>Réponse rapide</li>
          <li class="reveal"><span class="cta__icon"><svg aria-hidden="true"><use href="#i-heart"/></svg></span>Un accompagnement <br>bienveillant</li>
        </ul>
      </div>
    </section>`;

// Bandeau de 3 photos de la galerie (img/realisations/catalogue), chacune ouvre la galerie filtrée sur son style
const photos = (liste) => `
        <div class="guide-photos">
${liste.map(([fichier, alt]) => {
    const style = fichier.replace(/-\d+$/, '');
    return `          <a href="realisations.html?style=${style}#galerie"><img src="img/realisations/catalogue/${fichier}-sm.jpg" width="500" height="625" loading="lazy" alt="${alt}"></a>`;
  }).join('\n')}
        </div>`;

const PAGES = [
  {
    fichier: 'knotless-braids-marseille.html',
    titre: 'Knotless braids et box braids à Marseille | Nelly Coiffure',
    description: 'Knotless braids à Marseille dès 60 €, short braids 50 € : des box braids sans nœud, légères et naturelles. Chez Nelly (13004) ou à domicile.',
    ariane: 'Knotless braids',
    titreVisuel: 'Des tresses légères, <em>sans nœud à la racine.</em>',
    corps: `
        <p>Les knotless braids sont la coiffure que l’on me demande le plus à Marseille. Ce sont des box braids nouvelle génération&nbsp;: la tresse démarre avec vos propres cheveux, puis la mèche est ajoutée petit à petit. Résultat&nbsp;: aucun nœud à la racine, moins de tension, et des tresses qui bougent naturellement dès le premier jour.</p>
${photos([['knotless-braids-1', 'Knotless braids longues blondes réalisées par Nelly à Marseille'], ['knotless-braids-2', 'Knotless braids bohème à pointes bouclées, Nelly Coiffure Marseille'], ['knotless-braids-6', 'Knotless braids aux pointes bouclées réalisées par Nelly Coiffure']])}
        <h2>Knotless braids ou box braids classiques&nbsp;?</h2>
        <p>Les box braids classiques commencent par un petit nœud de mèche serré contre le cuir chevelu&nbsp;: c’est solide, mais plus lourd et parfois douloureux les premiers jours. Les knotless braids partent à plat, sans nœud&nbsp;: elles sont plus confortables, plus discrètes à la racine et plus douces pour les bords fragiles. C’est la technique que je privilégie.</p>
        <h2>Tarifs</h2>
        <ul>
          <li><strong>Knotless braids</strong>&nbsp;: à partir de 60&nbsp;€</li>
          <li><strong>Short braids</strong> (tresses courtes, au carré ou aux épaules)&nbsp;: à partir de 50&nbsp;€</li>
        </ul>
        <p>Le prix final dépend de la longueur, de la taille des tresses et des finitions (pointes bouclées, perles, couleurs). Je vous le confirme toujours sur WhatsApp avant le rendez-vous, avec les mèches à prévoir. Toutes les autres coiffures sont sur la page <a href="coiffures.html">Coiffures et tarifs</a>.</p>
        <h2>Combien de temps durent les knotless braids&nbsp;?</h2>
        <p>Bien entretenues, elles tiennent <strong>4 à 6 semaines</strong>, jusqu’à 8 au maximum. La pose prend plusieurs heures selon la longueur et la taille choisies&nbsp;: je vous donne une estimation précise avant la séance. Pour les garder belles, suivez mes <a href="conseils-tresses-africaines.html">conseils d’entretien des tresses africaines</a>.</p>
        <h2>Chez moi ou chez vous</h2>
        <p>Je vous reçois dans le 4<sup>e</sup> arrondissement de Marseille (13004), ou je me déplace chez vous dans tout Marseille et les communes voisines&nbsp;: voir la <a href="coiffure-afro-domicile-marseille.html">coiffure à domicile</a>. Plus de photos dans les <a href="realisations.html?style=knotless-braids#galerie">réalisations de knotless braids</a>.</p>`,
    faq: [
      ['Les knotless braids font-elles mal&nbsp;?', 'Beaucoup moins que les box braids classiques&nbsp;: sans nœud à la racine, la tension est répartie. Je ne serre jamais, et vous pouvez me dire à tout moment si quelque chose vous gêne.'],
      ['Faut-il apporter ses mèches&nbsp;?', 'Cela dépend de la longueur et de la couleur voulues. Envoyez-moi une photo du style sur WhatsApp&nbsp;: je vous dis quelles mèches prévoir, ou si je peux les fournir.'],
      ['Peut-on ajouter des boucles ou des perles&nbsp;?', 'Oui&nbsp;: pointes bouclées, perles, fils dorés ou mèches colorées. Dites-le-moi en réservant, cela peut faire varier le prix et la durée.'],
    ],
    accroche: 'Envie de knotless <br>braids&nbsp;?',
  },
  {
    fichier: 'locks-marseille.html',
    titre: 'Locks à Marseille, longues ou courtes | Nelly Coiffure',
    description: 'Pose de locks à Marseille : locks longues au rendu bohème dès 80 €, locks courtes au carré dès 50 €. Chez Nelly (13004) ou à domicile.',
    ariane: 'Locks',
    titreVisuel: 'Des locks au rendu <em>bohème et généreux.</em>',
    corps: `
        <p>Envie d’un style affirmé, qui se porte des semaines sans y penser&nbsp;? Je réalise des locks longues au rendu bohème et des locks courtes au carré, à Marseille, chez moi ou à votre domicile.</p>
${photos([['locks-2', 'Locks longues réalisées par Nelly à Marseille'], ['locks-4', 'Locks au rendu bohème, Nelly Coiffure Marseille'], ['locks-courtes-2', 'Locks courtes au carré réalisées par Nelly']])}
        <h2>Locks longues ou locks courtes</h2>
        <ul>
          <li><strong>Locks longues</strong>&nbsp;: un rendu bohème et volumineux, qui descend dans le dos. À partir de 80&nbsp;€.</li>
          <li><strong>Locks courtes</strong>&nbsp;: au carré ou aux épaules, plus légères et rapides à poser. À partir de 50&nbsp;€.</li>
        </ul>
        <p>Le prix final dépend de la longueur, de l’épaisseur et des mèches choisies&nbsp;: je vous le confirme sur WhatsApp avant le rendez-vous. Toute la carte est sur la page <a href="coiffures.html">Coiffures et tarifs</a>.</p>
        <h2>Bien préparer et entretenir ses locks</h2>
        <p>Venez avec des cheveux lavés, démêlés et secs. Ensuite, protégez vos locks la nuit avec un foulard ou un bonnet en satin, hydratez le cuir chevelu deux à trois fois par semaine et séchez-les bien après chaque lavage&nbsp;: les locks gardent l’humidité plus longtemps que des tresses. Tous les détails sont dans mes <a href="conseils-tresses-africaines.html">conseils d’entretien</a>.</p>
        <h2>Chez moi ou chez vous</h2>
        <p>Je vous reçois dans le 4<sup>e</sup> arrondissement de Marseille (13004), ou je viens chez vous&nbsp;: voir la <a href="coiffure-afro-domicile-marseille.html">coiffure à domicile</a>. Plus de photos dans les <a href="realisations.html?style=locks#galerie">réalisations de locks</a>.</p>`,
    faq: [
      ['Combien de temps tiennent les locks&nbsp;?', 'En général 4 à 8 semaines selon la pousse de vos cheveux et votre entretien. Au-delà, mieux vaut les retirer pour préserver vos racines.'],
      ['Les locks sont-elles lourdes&nbsp;?', 'Les locks longues ont du volume, c’est leur charme. Si vous voulez plus de légèreté, je vous conseille des locks courtes ou une taille plus fine.'],
      ['Faut-il apporter ses mèches&nbsp;?', 'Envoyez-moi une photo du style voulu sur WhatsApp&nbsp;: je vous dis quelles mèches prévoir et en quelle quantité.'],
    ],
    accroche: 'Réservez vos <br>locks',
  },
  {
    fichier: 'tresses-enfant-marseille.html',
    titre: 'Tresses enfant à Marseille, en douceur | Nelly Coiffure',
    description: 'Tresses pour enfant à Marseille dès 30 € : tresses couchées et nattes collées posées en douceur, chez Nelly (13004) ou à votre domicile.',
    ariane: 'Tresses enfant',
    titreVisuel: 'Des tresses pour les petits, <em>tout en douceur.</em>',
    corps: `
        <p>Une jolie coiffure qui tient pour l’école, sans larmes ni douleur&nbsp;: c’est ce que je propose aux enfants à Marseille. Je prends le temps, je fais des pauses et je ne serre jamais trop, pour que la séance reste un bon moment.</p>
${photos([['tresses-couchees-enfant-2', 'Tresses couchées enfant réalisées par Nelly à Marseille'], ['tresses-couchees-enfant-3', 'Tresses pour enfant, Nelly Coiffure Marseille'], ['nattes-collees-2', 'Nattes collées réalisées par Nelly Coiffure']])}
        <h2>Les coiffures pour enfant</h2>
        <ul>
          <li><strong>Tresses couchées enfant</strong>&nbsp;: des motifs tressés à plat, pratiques et jolis. À partir de 30&nbsp;€.</li>
          <li><strong>Nattes collées</strong>&nbsp;: simples et nettes, idéales pour la rentrée ou le sport. À partir de 30&nbsp;€.</li>
        </ul>
        <p>Le prix final dépend de la longueur et du motif choisi&nbsp;: je le confirme sur WhatsApp avant le rendez-vous. Toute la carte est sur la page <a href="coiffures.html">Coiffures et tarifs</a>.</p>
        <h2>Mes conseils aux parents</h2>
        <ul>
          <li>Lavez et démêlez les cheveux la veille&nbsp;: la séance sera plus courte et plus agréable.</li>
          <li>Prévoyez un goûter, une tablette ou un dessin animé pour patienter.</li>
          <li>Le soir, un bonnet ou un foulard en satin garde les tresses nettes plus longtemps.</li>
          <li>Pour les cuirs chevelus sensibles, préférez des tresses pas trop fines et pas trop longues.</li>
        </ul>
        <h2>À domicile, c’est encore plus simple</h2>
        <p>Les enfants sont souvent plus détendus chez eux. Je me déplace dans tout Marseille et les communes voisines&nbsp;: voir la <a href="coiffure-afro-domicile-marseille.html">coiffure à domicile</a>. Je vous reçois aussi dans le 4<sup>e</sup> arrondissement (13004). Plus de photos dans les <a href="realisations.html?style=tresses-couchees-enfant#galerie">réalisations pour enfant</a>.</p>`,
    faq: [
      ['À partir de quel âge peut-on tresser un enfant&nbsp;?', 'Dès que l’enfant peut rester assis un moment et que ses cheveux sont assez longs. Pour les tout-petits, je propose des coiffures simples et rapides.'],
      ['Combien de temps tiennent les tresses d’un enfant&nbsp;?', 'En général 2 à 3 semaines pour des tresses couchées ou des nattes collées, selon les activités et l’entretien.'],
      ['Un parent peut-il rester pendant la séance&nbsp;?', 'Bien sûr, c’est même conseillé pour les plus jeunes.'],
    ],
    accroche: 'Réservez les tresses <br>de votre enfant',
  },
  {
    fichier: 'coiffure-afro-domicile-marseille.html',
    titre: 'Coiffeuse afro à domicile à Marseille | Nelly Coiffure',
    description: 'Tresses africaines à domicile à Marseille et alentours : knotless braids, locks, twists, nattes collées dès 30 €. Nelly se déplace chez vous.',
    ariane: 'Coiffure à domicile',
    titreVisuel: 'Vos tresses, <em>sans bouger de chez vous.</em>',
    corps: `
        <p>Pas besoin de traverser la ville ni d’attendre dans un salon&nbsp;: je me déplace chez vous, dans tout Marseille et les communes voisines, pour vos tresses africaines, vos locks ou vos twists. Vous restez dans votre canapé, avec votre musique et vos enfants à côté si besoin, et vous profitez d’une séance aussi soignée qu’au salon.</p>
        <h2>Comment se passe une coiffure à domicile&nbsp;?</h2>
        <ol>
          <li><strong>Vous m’écrivez sur WhatsApp</strong> avec une photo du style qui vous plaît, la longueur voulue et votre quartier.</li>
          <li><strong>Je vous réponds</strong> avec le prix, la durée estimée, les mèches à prévoir et un créneau.</li>
          <li><strong>J’arrive chez vous</strong> avec mon matériel (peignes, élastiques, produits, gants) et je m’installe à côté d’une prise et d’une bonne lumière.</li>
          <li><strong>Vous repartez coiffée</strong>, avec mes conseils d’entretien pour garder vos tresses belles le plus longtemps possible.</li>
        </ol>
        <h2>Où je me déplace</h2>
        <p>Tous les arrondissements de Marseille, du 1<sup>er</sup> au 16<sup>e</sup>&nbsp;: centre-ville, Noailles, la Belle de Mai, les Chartreux, la Blancarde, Saint-Just, Château-Gombert, les quartiers nord, Sainte-Marguerite, la Pointe Rouge… et les communes voisines&nbsp;: Aubagne, Allauch, Plan-de-Cuques, Les Pennes-Mirabeau, Septèmes-les-Vallons et Cassis.</p>
        <p>Vous préférez venir&nbsp;? Je reçois aussi chez moi, dans un espace calme et dédié, dans le 4<sup>e</sup> arrondissement (13004). Les détails pratiques vous sont envoyés à la confirmation.</p>
        <h2>Les coiffures possibles à domicile</h2>
        <p>Toutes mes prestations se font à domicile, aux mêmes tarifs indicatifs qu’au salon&nbsp;:</p>
        <ul>
          <li><a href="coiffures.html#knotless">Knotless braids</a>&nbsp;: 60&nbsp;€, short braids&nbsp;: 50&nbsp;€</li>
          <li><a href="coiffures.html#tresses-couchees">Tresses couchées</a>&nbsp;: 50&nbsp;€, <a href="coiffures.html#nattes-collees">nattes collées</a>&nbsp;: 30&nbsp;€</li>
          <li>Twists&nbsp;: 60&nbsp;€, locks&nbsp;: 80&nbsp;€, locks courtes&nbsp;: 50&nbsp;€, tissage&nbsp;: 50&nbsp;€</li>
          <li>Homme&nbsp;: tresses collées ou twists, 30&nbsp;€</li>
          <li>Enfant&nbsp;: tresses couchées, 30&nbsp;€, avec une attention particulière à la douceur</li>
        </ul>
        <p>Retrouvez le détail sur la page <a href="coiffures.html">Coiffures et tarifs</a> et des exemples en photo dans les <a href="realisations.html">réalisations</a>.</p>
        <h2>Ce qu’il faut prévoir</h2>
        <ul>
          <li>Des cheveux lavés, bien démêlés et secs, sans huile ni produit gras.</li>
          <li>Une chaise confortable, près d’une fenêtre ou d’une lampe, et une prise électrique.</li>
          <li>Les mèches, si nous avons convenu que vous les achetez vous-même.</li>
          <li>De quoi vous occuper&nbsp;: une série, un livre, de la musique… les belles tresses demandent un peu de patience.</li>
        </ul>
        <p>Pour aller plus loin, lisez mes <a href="conseils-tresses-africaines.html">conseils pour préparer et entretenir vos tresses africaines</a>.</p>`,
    faq: [
      ['Le déplacement à domicile est-il payant&nbsp;?', 'Cela dépend de votre quartier et de la distance. Je vous le précise toujours sur WhatsApp, avant de confirmer le rendez-vous&nbsp;: aucune surprise le jour J.'],
      ['Combien de temps dure une coiffure à domicile&nbsp;?', 'La même durée qu’au salon&nbsp;: tout dépend du style, de la longueur et de l’épaisseur des tresses. Je vous donne une estimation précise avant la séance.'],
      ['Vous coiffez aussi les enfants à domicile&nbsp;?', 'Oui. Être chez soi rassure souvent les plus petits&nbsp;: je prends le temps, je fais des pauses et je n’attache jamais trop serré.'],
      ['Quels jours vous déplacez-vous&nbsp;?', 'Du lundi au samedi, sur rendez-vous. Écrivez-moi sur WhatsApp avec le jour qui vous arrange, je vous propose un créneau.'],
    ],
    accroche: 'Réservez votre coiffure <br>à domicile',
  },
  {
    fichier: 'conseils-tresses-africaines.html',
    titre: 'Entretenir ses tresses africaines : conseils | Nelly Coiffure',
    description: 'Préparer ses cheveux, entretenir ses tresses, combien de temps les garder, knotless ou box braids : les conseils de Nelly, coiffeuse afro à Marseille.',
    ariane: 'Conseils tresses',
    article: true,
    titreVisuel: 'Des tresses belles <em>plus longtemps.</em>',
    corps: `
        <p>Des tresses africaines bien posées et bien entretenues protègent vos cheveux et restent nettes pendant des semaines. Voici les conseils que je donne à mes clientes à Marseille, avant, pendant et après la pose.</p>
        <h2>Avant la pose&nbsp;: préparer ses cheveux</h2>
        <ul>
          <li><strong>Lavez et hydratez</strong> vos cheveux un ou deux jours avant, avec un shampoing doux et un après-shampoing.</li>
          <li><strong>Démêlez soigneusement</strong>, des pointes vers les racines&nbsp;: des cheveux bien démêlés, c’est une pose plus rapide et plus douce.</li>
          <li><strong>Venez cheveux secs</strong>, sans huile ni produit gras, qui feraient glisser les mèches.</li>
          <li>Si vous portez encore des tresses, prévenez-moi&nbsp;: je peux les défaire avant la séance.</li>
        </ul>
        <h2>Knotless braids ou box braids&nbsp;: que choisir&nbsp;?</h2>
        <p>Les <strong>box braids</strong> classiques démarrent par un petit nœud à la racine. Les <a href="coiffures.html#knotless">knotless braids</a> commencent avec vos propres cheveux, puis la mèche est ajoutée progressivement&nbsp;: pas de nœud, moins de tension sur le cuir chevelu, un rendu plus naturel et plus léger dès le premier jour. C’est le style que je conseille le plus, surtout si vous avez le cuir chevelu sensible ou des bords fragiles.</p>
        <h2>Les premiers jours</h2>
        <p>Une légère sensation de tiraillement peut se faire sentir le premier jour, elle disparaît vite. Évitez les chignons hauts et les queues de cheval serrées pendant la première semaine. Une douleur vive, des boutons ou des rougeurs ne sont pas normaux&nbsp;: dites-le-moi.</p>
        <h2>L’entretien au quotidien</h2>
        <ul>
          <li><strong>La nuit</strong>, protégez vos tresses avec un foulard ou un bonnet en satin&nbsp;: moins de frisottis, moins de frottements.</li>
          <li><strong>Hydratez le cuir chevelu</strong> deux à trois fois par semaine avec une brume légère ou quelques gouttes d’huile sur les raies.</li>
          <li><strong>Lavez</strong> toutes les une à deux semaines, avec un shampoing dilué appliqué sur le cuir chevelu, puis rincez bien et <strong>séchez complètement</strong> pour éviter les odeurs d’humidité.</li>
          <li><strong>Lissez les frisottis</strong> avec un peu de mousse coiffante, en évitant les gels qui laissent des résidus blancs.</li>
        </ul>
        <h2>Combien de temps garder ses tresses&nbsp;?</h2>
        <p>En moyenne, comptez <strong>4 à 6 semaines</strong> pour des knotless braids ou des box braids, <strong>2 à 3 semaines</strong> pour des nattes collées ou des tresses couchées, et <strong>3 à 5 semaines</strong> pour des twists. Au-delà de 8 semaines, la repousse fragilise les racines et les cheveux s’emmêlent à la base&nbsp;: mieux vaut défaire et laisser respirer vos cheveux quelques jours avant la prochaine pose.</p>
        <h2>Protéger ses bords</h2>
        <p>Des tresses trop serrées ou trop lourdes, portées trop souvent, peuvent abîmer la lisière (on parle d’alopécie de traction). Je ne serre jamais à la racine, j’adapte la taille et la longueur à vos cheveux, et je vous conseille d’alterner avec des coiffures plus légères.</p>
        <h2>Le retrait</h2>
        <p>Prenez votre temps&nbsp;: coupez la mèche sous la longueur de vos cheveux, défaites chaque tresse délicatement, puis démêlez avec beaucoup d’après-shampoing avant un vrai lavage et un masque nourrissant. C’est normal de voir partir des cheveux&nbsp;: ce sont ceux qui sont tombés naturellement pendant les semaines de pose.</p>
        <p>Envie de nouvelles tresses&nbsp;? Découvrez les <a href="coiffures.html">coiffures et tarifs</a>, ou réservez une <a href="coiffure-afro-domicile-marseille.html">coiffure à domicile à Marseille</a>.</p>`,
    faq: [
      ['Les tresses africaines abîment-elles les cheveux&nbsp;?', 'Non, si elles sont posées sans trop serrer, entretenues et retirées à temps. Bien faites, elles protègent même vos longueurs.'],
      ['Combien de temps peut-on garder des knotless braids&nbsp;?', 'Entre 4 et 6 semaines en moyenne, jusqu’à 8 semaines au maximum, selon la pousse de vos cheveux et votre entretien.'],
      ['Peut-on aller à la piscine ou à la mer avec des tresses&nbsp;?', 'Oui. Rincez à l’eau claire en sortant, puis séchez bien les tresses et le cuir chevelu pour éviter l’humidité.'],
      ['Faut-il laisser reposer ses cheveux entre deux poses&nbsp;?', 'C’est conseillé&nbsp;: quelques jours à une semaine, avec un soin nourrissant, permettent au cuir chevelu de respirer.'],
    ],
    accroche: 'Prête pour vos <br>prochaines tresses&nbsp;?',
  },
];

for (const P of PAGES) {
  let h = modele;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${P.titre}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${P.description}">`)
    .replace(' aria-current="page">Mentions légales', '>Mentions légales')
    .replace(/<main id="contenu">[\s\S]*<\/main>/, `<main id="contenu">
    <section class="page-hero legal-hero guide-hero">
      <div class="container">
        <ol class="crumbs intro" style="--d: 0s" aria-label="Fil d'Ariane"><li><a href="index.html">Accueil</a></li><li aria-current="page">${P.ariane}</li></ol>
        <h1 class="eyebrow intro" style="--d: .1s">${P.titre.split(' | ')[0]}</h1>
        <p class="page-hero__title"><span class="line"><span class="intro" style="--d: .15s">${P.titreVisuel}</span></span></p>
      </div>
    </section>
    <section class="section section--tight">
      <div class="container legal guide reveal">${P.corps}
      </div>
    </section>
${faq(P.faq)}
${cta(P.accroche)}
  </main>`);
  writeFileSync(path.join(SITE, P.fichier), h.replace(/\r?\n/g, NL));
  console.log('ok', P.fichier);
}
