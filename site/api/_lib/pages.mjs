// Modification des pages par l'espace de gestion : textes, images, boutons, ordre et visibilité des sections.
//
// 1. marquer() repère, dans <main>, les sections (data-s), les textes simples (data-t), les images (data-i) et les
//    boutons (data-b). Les identifiants sont stables d'une génération à l'autre. Les zones gérées ailleurs
//    (<!-- cms:… -->, prix, pseudos, titre H1 lié au référencement) ne sont pas touchées.
// 2. appliquerPages() applique contenu.pages[fichier] : { textes, images, boutons, ordre, masquees }.
// 3. structurePage() décrit la page pour l'espace de gestion (sections et leurs éléments modifiables).
// Les attributs data-* sont invisibles pour les visiteurs et sans effet sur le référencement.

const TEXTES = /<(h2|h3|h4|p|li|dt|dd|summary|figcaption|span|small|blockquote)\b([^>]*)>((?:[^<]|<br\s*\/?>|<\/?(?:em|strong|sup|i|b)>)+?)<\/\1>/g;
const IMAGES = /<img\b([^>]*)>/g;
const BOUTONS = /<a\b([^>]*\bclass="[^"]*\bbtn\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g;

const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decoder = (s) => String(s).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (attrs, nom) => (attrs.match(new RegExp(`\\s${nom}="([^"]*)"`)) || [])[1];
const sansAttr = (attrs, ...noms) => noms.reduce((a, n) => a.replace(new RegExp(`\\s${n}="[^"]*"`, 'g'), ''), attrs);

// Texte affiché ↔ texte saisi : retours à la ligne (<br>) et mots mis en valeur (*mot* ↔ <em>mot</em>)
export const versSaisie = (html) => decoder(html.replace(/<br\s*\/?>/g, '\n').replace(/<\/?em>/g, '*').replace(/<[^>]+>/g, '')).trim();
// (une espace reste devant chaque <br> : sur mobile, certains retours à la ligne du site sont masqués)
export const depuisSaisie = (texte) => echapper(String(texte).trim()).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/[ \t]*\n[ \t]*/g, ' <br>');

// Bornes de <main> et des zones gérées ailleurs (à ne pas toucher)
const bornes = (h) => {
  const debut = h.indexOf('<main id="contenu">');
  const fin = h.indexOf('</main>', debut);
  return debut < 0 || fin < 0 ? null : { debut, fin };
};
const zonesProtegees = (h) => [...h.matchAll(/<!-- cms:([a-z]+) -->[\s\S]*?<!-- \/cms:\1 -->/g)].map((m) => [m.index, m.index + m[0].length]);
const dansZone = (zones, i) => zones.some(([a, b]) => i >= a && i < b);

// Remplace dans <main> les correspondances d'une expression, hors zones protégées
const remplacerDansMain = (h, re, fn) => {
  const b = bornes(h);
  if (!b) return h;
  const avant = h.slice(0, b.debut);
  let main = h.slice(b.debut, b.fin);
  const apres = h.slice(b.fin);
  const zones = zonesProtegees(main);
  main = main.replace(re, (...args) => {
    const m = args[0];
    const i = args[args.length - 2];
    return dansZone(zones, i) ? m : fn(...args);
  });
  return avant + main + apres;
};

const prochainId = (h, lettre) => {
  const nums = [...h.matchAll(new RegExp(`data-${lettre}="${lettre}(\\d+)"`, 'g'))].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) + 1 : 1;
};

export function marquer(h) {
  if (!bornes(h)) return h;
  // Sections de premier niveau
  let n = prochainId(h, 's');
  h = remplacerDansMain(h, /^( {4}<section\b)(?![^>]*data-s=)([^>]*>)/gm, (m, a, b) => `${a} data-s="s${n++}"${b}`);
  // Textes simples
  n = prochainId(h, 't');
  h = remplacerDansMain(h, TEXTES, (m, tag, attrs, contenu) => {
    if (/data-(t|prix|reseau)=/.test(attrs) || !versSaisie(contenu)) return m;
    return `<${tag}${attrs} data-t="t${n++}">${contenu}</${tag}>`;
  });
  // Images (la galerie et les cartes de coiffures sont gérées par leurs propres onglets)
  n = prochainId(h, 'i');
  h = remplacerDansMain(h, IMAGES, (m, attrs) => {
    if (/data-i=/.test(attrs) || !attr(attrs, 'src') || /img\/realisations\//.test(attrs)) return m;
    const origine = [`data-i-src="${attr(attrs, 'src')}"`, attr(attrs, 'srcset') && `data-i-srcset="${attr(attrs, 'srcset')}"`, attr(attrs, 'style') && `data-i-style="${attr(attrs, 'style')}"`].filter(Boolean).join(' ');
    return `<img${attrs.replace(/\s*\/$/, '')} data-i="i${n++}" ${origine}>`;
  });
  // Boutons
  n = prochainId(h, 'b');
  h = remplacerDansMain(h, BOUTONS, (m, attrs, contenu) => (/data-b=/.test(attrs) ? m : `<a${attrs} data-b="b${n++}">${contenu}</a>`));
  return h;
}

// Destination d'un bouton → attributs (même logique que les annonces)
const lienBouton = (b, formatsTelephone) => {
  const v = String(b.valeur || '').trim();
  if (b.type === 'whatsapp') return ` data-wa="${echapper(v)}" href="contact.html"`;
  if (b.type === 'telephone') return ` href="tel:${formatsTelephone(v).international}"`;
  if (b.type === 'externe') return ` href="${echapper(v)}" target="_blank" rel="noopener"`;
  return ` href="${echapper(v || 'contact.html')}"`;
};

const decouperBouton = (contenu) => contenu.match(/^(\s*(?:<svg[\s\S]*?<\/svg>\s*)?)([\s\S]*?)(\s*(?:<svg[\s\S]*?<\/svg>)?\s*)$/);

export function appliquerPages(h, fichier, contenu, formatsTelephone) {
  const p = contenu.pages?.[fichier];
  if (!p || !bornes(h)) return h;
  const textes = p.textes || {}; const images = p.images || {}; const boutons = p.boutons || {};
  if (Object.keys(textes).length) {
    h = remplacerDansMain(h, TEXTES, (m, tag, attrs, html) => {
      const id = attr(attrs, 'data-t');
      return id && textes[id] !== undefined && String(textes[id]).trim() ? `<${tag}${attrs}>${depuisSaisie(textes[id])}</${tag}>` : m;
    });
  }
  // Images : remplacée (cadre d'origine conservé, image recadrée sans déformation) ou image d'origine
  h = remplacerDansMain(h, IMAGES, (m, attrs) => {
    const id = attr(attrs, 'data-i');
    if (!id) return m;
    const im = images[id];
    let a = sansAttr(attrs, 'src', 'srcset', 'style');
    if (im?.src) {
      const l = Number(attr(attrs, 'width')) || 4; const ht = Number(attr(attrs, 'height')) || 5;
      const x = Number(im.x ?? 50); const y = Number(im.y ?? 50); const z = Number(im.zoom ?? 1);
      const style = `object-fit: cover; object-position: ${x}% ${y}%; aspect-ratio: ${l} / ${ht}${z !== 1 ? `; transform: scale(${z}); transform-origin: ${x}% ${y}%` : ''}`;
      if (im.alt !== undefined) a = sansAttr(a, 'alt') + ` alt="${echapper(im.alt)}"`;
      return `<img src="${im.src}.jpg" srcset="${im.src}-sm.jpg 800w, ${im.src}.jpg 1600w"${a} style="${style}">`;
    }
    const src = attr(attrs, 'data-i-src'); const srcset = attr(attrs, 'data-i-srcset'); const st = attr(attrs, 'data-i-style');
    return `<img src="${src}"${srcset ? ` srcset="${srcset}"` : ''}${a}${st ? ` style="${st}"` : ''}>`;
  });
  if (Object.keys(boutons).length) {
    h = remplacerDansMain(h, BOUTONS, (m, attrs, html) => {
      const b = boutons[attr(attrs, 'data-b')];
      if (!b) return m;
      const [, avant, texteHtml, apres] = decouperBouton(html) || [null, '', html, ''];
      const texte = String(b.texte || '').trim() ? echapper(b.texte.trim()) : texteHtml;
      let a = attrs;
      let debut = avant;
      if (b.type) {
        a = sansAttr(a, 'href', 'data-wa', 'target', 'rel') + lienBouton(b, formatsTelephone);
        const iconeWa = /<svg[^>]*>\s*<use href="#i-whatsapp"\/>\s*<\/svg>\s*/;
        if (b.type === 'whatsapp' && !iconeWa.test(avant)) debut = `<svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg> ${avant}`;
        if (b.type !== 'whatsapp') debut = avant.replace(iconeWa, '');
      }
      return `<a${a}>${debut}${texte}${apres}</a>`;
    });
  }
  return ordonner(h, p);
}

// Ordre et visibilité des sections : la première (en-tête de page) et les annonces qui la suivent restent en tête
function ordonner(h, p) {
  const b = bornes(h);
  const main = h.slice(b.debut, b.fin);
  const re = /^ {4}<section\b[\s\S]*?^ {4}<\/section>\r?\n?/gm;
  const blocs = [...main.matchAll(re)].map((m) => ({ texte: m[0], index: m.index, id: attr(m[0].slice(0, m[0].indexOf('>')), 'data-s') }));
  if (blocs.length < 2) return h;
  const masquees = new Set(p.masquees || []);
  const visibilite = (t, id) => {
    const ouv = t.slice(0, t.indexOf('>') + 1);
    let n = ouv.replace(/\s(hidden|data-masquee="1")(?=[\s>])(="[^"]*")?/g, '');
    if (masquees.has(id)) n = n.replace(/>$/, ' hidden data-masquee="1">');
    return n + t.slice(ouv.length);
  };
  const [premier, ...autres] = blocs.filter((x) => x.id);
  if (!premier) return h;
  const ordre = (p.ordre || []).filter((id) => autres.some((x) => x.id === id));
  const ranges = [...ordre.map((id) => autres.find((x) => x.id === id)), ...autres.filter((x) => !ordre.includes(x.id))];
  // On reconstruit <main> : tout ce qui précède la 2e section reste en place (en-tête + annonces), puis les sections réordonnées,
  // puis ce qui suit la dernière section d'origine
  const deuxieme = autres[0];
  const derniere = autres[autres.length - 1];
  if (!deuxieme) return h.slice(0, b.debut) + main.replace(premier.texte, visibilite(premier.texte, premier.id)) + h.slice(b.fin);
  const tete = main.slice(0, deuxieme.index).replace(premier.texte, visibilite(premier.texte, premier.id));
  const queue = main.slice(derniere.index + derniere.texte.length);
  const milieu = main.slice(deuxieme.index, derniere.index + derniere.texte.length);
  // Ce qui se trouve entre deux sections (commentaires…) reste attaché à la section qui le suit
  const entre = autres.map((x, i) => (i === 0 ? '' : milieu.slice(autres[i - 1].index + autres[i - 1].texte.length - deuxieme.index, x.index - deuxieme.index)));
  const corps = ranges.map((x) => entre[autres.indexOf(x)] + visibilite(x.texte, x.id)).join('');
  return h.slice(0, b.debut) + tete + corps + queue + h.slice(b.fin);
}

// Description de la page pour l'espace de gestion
export function structurePage(h) {
  const b = bornes(h);
  if (!b) return [];
  const main = h.slice(b.debut, b.fin);
  const zones = zonesProtegees(main);
  const sections = [...main.matchAll(/^ {4}<section\b[\s\S]*?^ {4}<\/section>/gm)].filter((m) => !dansZone(zones, m.index));
  return sections.map((m, i) => {
    const t = m[0];
    const ouv = t.slice(0, t.indexOf('>'));
    const zonesT = zonesProtegees(t);
    const textes = [...t.matchAll(TEXTES)].filter((x) => !dansZone(zonesT, x.index) && attr(x[2], 'data-t'))
      .map((x) => ({ id: attr(x[2], 'data-t'), type: /^h/.test(x[1]) ? 'titre' : x[1] === 'summary' ? 'question' : /eyebrow/.test(x[2]) ? 'petit-titre' : 'texte', texte: versSaisie(x[3]) }));
    const images = [...t.matchAll(IMAGES)].filter((x) => !dansZone(zonesT, x.index) && attr(x[1], 'data-i'))
      .map((x) => ({ id: attr(x[1], 'data-i'), src: attr(x[1], 'src'), origine: attr(x[1], 'data-i-src'), alt: decoder(attr(x[1], 'alt') || ''), largeur: Number(attr(x[1], 'width')) || 4, hauteur: Number(attr(x[1], 'height')) || 5 }));
    const boutons = [...t.matchAll(BOUTONS)].filter((x) => !dansZone(zonesT, x.index) && attr(x[1], 'data-b'))
      .map((x) => ({ id: attr(x[1], 'data-b'), texte: versSaisie((decouperBouton(x[2]) || [])[2] || ''), href: decoder(attr(x[1], 'href') || ''), wa: decoder(attr(x[1], 'data-wa') || '') }));
    const titre = textes.find((x) => x.type === 'titre')?.texte || textes.find((x) => x.type !== 'petit-titre')?.texte || `Section ${i + 1}`;
    const nom = i === 0 ? 'En-tête de la page' : titre.replace(/\*/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
    return { id: attr(ouv, 'data-s'), premiere: i === 0, masquee: /\shidden[\s>=]/.test(`${ouv}>`), titre: nom, textes, images, boutons };
  });
}
