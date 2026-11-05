// Numéro WhatsApp de Nelly au format international, sans "+", ni espaces, ni 0 initial (ex. 06 12 34 56 78 -> 33612345678)
const WHATSAPP_NUMBER = '33604023290';

const root = document.documentElement;
root.classList.remove('no-js');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const waHref = (msg) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
function setWa(el, msg) {
  el.href = waHref(msg);
  el.target = '_blank';
  el.rel = 'noopener';
}
document.querySelectorAll('[data-wa]').forEach((el) => setWa(el, el.dataset.wa));
document.querySelectorAll('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

// Annonces programmées (espace de gestion) : visibles seulement entre leur date de début et leur date de fin
const today = new Date().toLocaleDateString('sv');
document.querySelectorAll('[data-debut], [data-fin]').forEach((el) => {
  el.hidden = Boolean((el.dataset.debut && today < el.dataset.debut) || (el.dataset.fin && today > el.dataset.fin));
});

// Entrée du hero une fois les polices prêtes (évite le saut de typo pendant l'animation)
const start = () => requestAnimationFrame(() => document.body.classList.add('is-loaded'));
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(start);

// Transition douce entre les pages du site (le voile du logo revient avant de changer de page)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.getAttribute('href').startsWith('#') || reduceMotion || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname) || (url.pathname === location.pathname && url.hash)) return;
  e.preventDefault();
  document.body.classList.add('is-leaving');
  setTimeout(() => { location.href = url.href; }, 380);
});
window.addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });

// En-tête : fond au défilement, masqué en descendant, réaffiché en remontant
const header = document.getElementById('header');
const waFloat = document.querySelector('.wa-float');
const hero = document.querySelector('.hero, .page-hero');
const cta = document.querySelector('.cta');
let lastY = window.scrollY;
let ctaVisible = false;

// Bandeaux d'annonce au-dessus de l'en-tête fixe : la page descend d'autant, pour ne rien cacher du haut de page
function reserverBandeaux() {
  const h = [...header.querySelectorAll('.annonce')].filter((a) => !a.hidden).reduce((s, a) => s + a.offsetHeight, 0);
  document.body.style.paddingTop = h ? `${h}px` : '';
  document.documentElement.style.setProperty('--bandeaux', `${h}px`);
}
reserverBandeaux();
window.addEventListener('resize', reserverBandeaux);

function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('is-scrolled', y > 40);
  const goingDown = y > lastY;
  header.classList.toggle('is-hidden', goingDown && y > 700 && !document.getElementById('nav').classList.contains('is-open'));
  lastY = y;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  header.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  if (waFloat) waFloat.classList.toggle('is-visible', y > (hero ? hero.offsetHeight * 0.7 : 400) && !ctaVisible);
}
if (cta) new IntersectionObserver(([e]) => { ctaVisible = e.isIntersecting; onScroll(); }, { threshold: 0.25 }).observe(cta);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Menu mobile
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  document.body.style.overflow = open ? 'hidden' : '';
  document.body.classList.toggle('menu-open', open);
  if (open) header.classList.remove('is-hidden');
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
window.matchMedia('(min-width: 1025px)').addEventListener('change', () => setMenu(false));

// Apparitions au défilement, en cascade dans les groupes [data-stagger]
document.querySelectorAll('[data-stagger]').forEach((group) => {
  group.querySelectorAll(':scope > .reveal, :scope > * > .reveal').forEach((el, i) => el.style.setProperty('--delay', `${Math.min(i, 8) * 0.1}s`));
});
document.querySelectorAll('.mosaic .reveal').forEach((el, i) => el.style.setProperty('--delay', `${i * 0.08}s`));

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    io.unobserve(entry.target);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal, .reveal-script, .univers__edge, .experience__edge, .steps, .cta__arc').forEach((el) => io.observe(el));

// Parallaxe douce
const parallax = [...document.querySelectorAll('[data-parallax]')];
if (!reduceMotion && parallax.length) {
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    parallax.forEach((el) => {
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const max = box.height * 0.05;
      const raw = (box.top + box.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      const offset = Math.max(-max, Math.min(max, raw));
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// Groupe de puces à choix unique ; renvoie l'index choisi via onChange
function chipGroup(container, onChange) {
  const chips = [...container.querySelectorAll('.chip')];
  chips.forEach((chip, i) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    onChange(i, chip);
  }));
  return chips;
}

// Carrousel des coiffures (mobile) : points de navigation
const cards = document.getElementById('cards');
const dots = document.getElementById('cards-dots');
if (cards && dots) {
  const items = [...cards.children];
  items.forEach((card, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Coiffure ${i + 1}`);
    b.tabIndex = -1; // points décoratifs (conteneur aria-hidden) : les cartes restent accessibles au clavier
    b.type = 'button';
    b.addEventListener('click', () => cards.scrollTo({ left: card.offsetLeft - cards.offsetLeft - 20, behavior: 'smooth' }));
    dots.appendChild(b);
  });
  const setActive = () => {
    const center = cards.scrollLeft + cards.clientWidth / 2;
    let best = 0;
    items.forEach((c, i) => { if (Math.abs(c.offsetLeft - cards.offsetLeft + c.offsetWidth / 2 - center) < Math.abs(items[best].offsetLeft - cards.offsetLeft + items[best].offsetWidth / 2 - center)) best = i; });
    [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === best));
  };
  cards.addEventListener('scroll', () => requestAnimationFrame(setActive), { passive: true });
  setActive();
}

// Mosaïque des réalisations (accueil) : rotation des photos
const mosaic = document.getElementById('mosaic');
const tiles = mosaic ? [...mosaic.querySelectorAll('.mosaic__item')] : [];
function rotate(dir) {
  mosaic.classList.add('is-swapping');
  setTimeout(() => {
    const data = tiles.map((t) => ({ src: t.querySelector('img').src, alt: t.querySelector('img').alt, label: t.dataset.label }));
    tiles.forEach((t, i) => {
      const n = data[(i + dir + data.length) % data.length];
      const img = t.querySelector('img');
      img.src = n.src; img.alt = n.alt; t.dataset.label = n.label;
    });
    mosaic.classList.remove('is-swapping');
  }, 450);
}
document.getElementById('mosaic-prev')?.addEventListener('click', () => rotate(-1));
document.getElementById('mosaic-next')?.addEventListener('click', () => rotate(1));

// Galerie (page Réalisations) : filtres
const gallery = document.getElementById('gallery');
if (gallery) {
  const filters = document.querySelector('.filters');
  const chips = chipGroup(filters, (i, chip) => {
    const f = chip.dataset.filter;
    let n = 0;
    gallery.querySelectorAll('.gallery__item').forEach((it) => {
      const show = f === 'tout' || it.dataset.cat === f;
      it.classList.toggle('is-hidden', !show);
      it.classList.remove('is-shown', 'reveal');
      if (show) {
        void it.offsetWidth;
        it.style.animationDelay = `${Math.min(n++, 8) * 0.05}s`;
        it.classList.add('is-shown');
      }
    });
  });
  const requestedStyle = new URLSearchParams(window.location.search).get('style');
  if (requestedStyle) chips.find((chip) => chip.dataset.filter === requestedStyle)?.click();
}

// Visionneuse, partagée par la mosaïque, la galerie et les albums des coiffures.
// Une réalisation peut contenir plusieurs photos et vidéos : on les fait glisser, comme un post Instagram.
const albums = [...document.querySelectorAll('[data-album]')];
function creerVisionneuse() {
  const d = document.createElement('dialog');
  d.className = 'lightbox'; d.id = 'lightbox'; d.setAttribute('aria-label', 'Réalisation agrandie');
  d.innerHTML = `<button class="lightbox__close" data-close aria-label="Fermer"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.5"/></svg></button>
    <button class="lightbox__nav lightbox__nav--prev" data-prev aria-label="Précédente"><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>
    <figure class="lightbox__fig"><img id="lightbox-img" src="" alt=""><figcaption><span id="lightbox-label"></span>
      <a class="btn btn--light" id="lightbox-wa" href="contact.html"><svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg> Je veux ce style</a></figcaption></figure>
    <button class="lightbox__nav lightbox__nav--next" data-next aria-label="Suivante"><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>`;
  document.body.append(d);
  return d;
}
const lightbox = document.getElementById('lightbox') || (albums.length ? creerVisionneuse() : null);
if (lightbox && (tiles.length || gallery || albums.length)) {
  const lbLabel = document.getElementById('lightbox-label');
  const lbWa = document.getElementById('lightbox-wa');
  const piste = document.createElement('div');
  piste.className = 'lb-piste';
  document.getElementById('lightbox-img').replaceWith(piste);
  const points = document.createElement('div');
  points.className = 'lb-points';
  points.setAttribute('aria-hidden', 'true');
  piste.after(points);

  let liste = [];
  let current = 0;
  let medias = [];
  let rang = 0;

  const videos = () => [...piste.querySelectorAll('video')];
  const arreterVideos = () => videos().forEach((v) => v.pause());
  // Seul l'élément affiché joue ; le son est coupé si le navigateur refuse la lecture sonore automatique
  const jouerRang = () => {
    const diapos = [...piste.children];
    diapos.forEach((d, i) => {
      const v = d.querySelector('video');
      if (!v) return;
      if (i !== rang) { v.pause(); return; }
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    });
    [...points.children].forEach((p, i) => p.classList.toggle('est-actif', i === rang));
  };
  const allerRang = (i, doux = true) => {
    rang = i;
    piste.scrollTo({ left: piste.clientWidth * i, behavior: doux ? 'smooth' : 'auto' });
    jouerRang();
  };
  let attente = null;
  piste.addEventListener('scroll', () => {
    clearTimeout(attente);
    attente = setTimeout(() => {
      const i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
      if (i !== rang && i >= 0 && i < medias.length) { rang = i; jouerRang(); }
    }, 90);
  }, { passive: true });

  const mediasDe = (t) => {
    const img = t.querySelector('img');
    const dom = t.dataset.medias ? JSON.parse(t.dataset.medias) : null;
    if (dom) return dom.map((m, i) => ({ ...m, alt: `${t.dataset.label}, ${m.v ? 'vidéo' : 'photo'} ${i + 1} sur ${dom.length}`, s: m.v ? '' : `${m.i}.jpg` }));
    return [{ s: img.currentSrc || img.src, alt: img.alt, ratio: img.naturalWidth / img.naturalHeight || 0.8 }];
  };
  const diapo = (m) => {
    const d = document.createElement('div');
    d.className = 'lb-diapo';
    if (m.v) {
      const v = document.createElement('video');
      v.src = `${m.v}.mp4`;
      v.poster = `${m.i}.jpg`;
      v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.loop = true;
      v.setAttribute('controlslist', 'nodownload');
      v.setAttribute('aria-label', m.alt);
      d.append(v);
    } else {
      const img = document.createElement('img');
      img.src = m.s; img.alt = m.alt; img.decoding = 'async';
      d.append(img);
    }
    return d;
  };
  const afficher = (i, depuisFin = false) => {
    current = (i + liste.length) % liste.length;
    const t = liste[current];
    arreterVideos();
    medias = mediasDe(t);
    piste.replaceChildren(...medias.map(diapo));
    points.replaceChildren(...(medias.length > 1 ? medias.map(() => document.createElement('span')) : []));
    // La piste s'adapte à l'élément le plus large et au plus haut de l'album : rien n'est coupé, tout reste grand
    const ratios = medias.map((m) => (m.v ? m.l / m.h : m.ratio || 0.8));
    piste.style.setProperty('--ratio-max', String(Math.max(...ratios)));
    piste.style.setProperty('--ratio-min', String(Math.min(...ratios)));
    lbLabel.textContent = t.dataset.label;
    setWa(lbWa, `Bonjour Nelly, j'ai vu ce style sur votre site : « ${t.dataset.label} ». Je voudrais le même, pouvez-vous me donner un tarif ?`);
    allerRang(depuisFin ? medias.length - 1 : 0, false);
  };
  // Les flèches parcourent l'album, puis passent à la réalisation suivante
  const avancer = (sens) => {
    const suivant = rang + sens;
    if (suivant >= 0 && suivant < medias.length) return allerRang(suivant);
    if (liste.length > 1) return afficher(current + sens, sens < 0);
    return allerRang(sens > 0 ? 0 : medias.length - 1);
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.mosaic__item, .gallery__item, [data-album]');
    if (!t) return;
    liste = t.matches('[data-album]') ? [t] : (gallery ? [...gallery.querySelectorAll('.gallery__item:not(.is-hidden)')] : tiles);
    lightbox.showModal();
    afficher(liste.indexOf(t));
  });
  lightbox.addEventListener('close', () => { arreterVideos(); piste.replaceChildren(); });
  lightbox.querySelector('[data-close]').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-prev]').addEventListener('click', () => avancer(-1));
  lightbox.querySelector('[data-next]').addEventListener('click', () => avancer(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') avancer(-1);
    if (e.key === 'ArrowRight') avancer(1);
  });
  // Glisser passe à la réalisation suivante quand il n'y a qu'un élément (sinon la piste défile d'elle-même)
  let touchX = null;
  lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (medias.length === 1 && liste.length > 1 && Math.abs(dx) > 50) afficher(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
}

// Section animée au rythme de la musique : le texte suit les temps forts mesurés dans la vidéo.
// Elle démarre quand le visiteur s'arrête dessus, s'arrête dès qu'il la quitte et repart du début à son retour ;
// rien n'est téléchargé si on ne fait que passer. Elle joue avec le son ; si le navigateur le refuse
// (visiteur qui n'a encore rien touché sur le site), elle part muette et le son arrive au premier toucher ou clic.
// Connexion lente : version légère de la vidéo, et le texte défile sans attendre qu'elle soit prête.
function lancerMotion(box) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const video = box.querySelector('video');
  const cadre = box.querySelector('.motion__cadre');
  const pouls = box.querySelector('.motion__pouls');
  const { frappes, revele, duree } = JSON.parse(box.dataset.motion);
  const reperes = [...box.querySelectorAll('[data-debut]')].map((el) => ({ el, debut: Number(el.dataset.debut), fin: el.dataset.fin ? Number(el.dataset.fin) : Infinity }));
  const reseau = navigator.connection;
  const econome = reseau?.saveData === true;
  const lente = econome || ['slow-2g', '2g', '3g'].includes(reseau?.effectiveType) || (reseau?.downlink > 0 && reseau.downlink < 3);
  const leger = video.dataset.leger;
  let surLeger = false;
  if (lente && leger) { video.src = `${leger}.mp4`; surLeger = true; }

  box.classList.add('motion--actif');
  // Le plus long mot du titre tient toujours en entier, quelle que soit la largeur de l'écran
  const titre = box.querySelector('.motion__titre');
  const ajusterTitre = () => {
    titre.style.fontSize = '';
    const plusLong = Math.max(...[...titre.children].map((m) => m.offsetWidth));
    if (plusLong > titre.clientWidth) titre.style.fontSize = `${(parseFloat(getComputedStyle(titre).fontSize) * titre.clientWidth * 0.98) / plusLong}px`;
  };
  ajusterTitre();
  document.fonts?.ready.then(ajusterTitre);
  window.addEventListener('resize', ajusterTitre, { passive: true });
  video.controls = false;
  video.muted = true;

  const commandes = document.createElement('div');
  commandes.className = 'motion__commandes';
  commandes.innerHTML = `<button type="button" class="motion__bouton motion__son"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path class="motion__son-ondes" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg><span>Activer le son</span></button>
    <button type="button" class="motion__bouton motion__rejouer" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.2-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"/></svg><span>Lire la vidéo</span></button>
    <div class="motion__barre" aria-hidden="true"><i></i></div>`;
  cadre.append(commandes);
  const son = commandes.querySelector('.motion__son');
  const rejouer = commandes.querySelector('.motion__rejouer');
  const barre = commandes.querySelector('.motion__barre i');

  let visible = false; // assez présente à l'écran
  let enScene = false; // lecture demandée
  let enCours = false; // la vidéo joue vraiment
  let sonCoupe = false; // le visiteur a coupé le son lui-même
  let misEnPause = false;
  let suivante = 0;
  let boucleActive = false;
  let departTexte = null; // horloge du texte quand la vidéo n'est pas encore prête
  let minuteurs = [];

  const majSon = () => {
    son.querySelector('span').textContent = video.muted ? 'Activer le son' : 'Couper le son';
    son.querySelector('.motion__son-ondes').style.opacity = video.muted ? 0.3 : 1;
  };
  const frapper = () => {
    cadre.animate([{ transform: 'scale(1.016)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    pouls.animate([{ opacity: 1 }, { opacity: 0.5 }], { duration: 420, easing: 'ease-out' });
  };
  const temps = () => (departTexte !== null ? (performance.now() - departTexte) / 1000 : video.currentTime);
  const peindre = (t) => {
    for (const r of reperes) r.el.classList.toggle('est-la', t >= r.debut && t < r.fin);
    box.classList.toggle('motion--revele', t >= revele);
    barre.style.transform = `scaleX(${Math.min(1, t / duree)})`;
    while (suivante < frappes.length && frappes[suivante] <= t) {
      if (departTexte === null && t - frappes[suivante] < 0.12) frapper();
      suivante += 1;
    }
  };
  const finTexteSeul = () => { departTexte = null; video.pause(); peindre(duree); rejouer.hidden = false; };
  const boucle = () => {
    if (departTexte !== null && temps() >= duree) finTexteSeul();
    else if (enCours || departTexte !== null) peindre(temps());
    if (enCours || departTexte !== null) requestAnimationFrame(boucle); else boucleActive = false;
  };
  const lancerBoucle = () => { if (!boucleActive) { boucleActive = true; requestAnimationFrame(boucle); } };

  const jouer = () => {
    video.muted = sonCoupe;
    majSon();
    return video.play().catch((e) => {
      if (e.name === 'AbortError' || !enScene) return;
      if (video.muted) { rejouer.hidden = false; return; }
      // Son refusé par le navigateur : la vidéo part muette, le son viendra au premier geste
      video.muted = true;
      majSon();
      video.play().catch((e2) => { if (e2.name !== 'AbortError') rejouer.hidden = false; });
    });
  };
  const basculerLeger = () => {
    if (surLeger || !leger) return;
    surLeger = true;
    const t = video.currentTime;
    video.src = `${leger}.mp4`;
    if (t > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = t; }, { once: true });
    if (enScene && !misEnPause) jouer();
  };
  const annulerMinuteurs = () => { minuteurs.forEach(clearTimeout); minuteurs = []; };
  const demarrer = () => {
    if (enScene || video.ended) return;
    enScene = true;
    misEnPause = false;
    rejouer.hidden = true;
    // Mode économie de données : le texte seul, la vidéo reste à la demande
    if (econome) { departTexte = performance.now(); lancerBoucle(); return; }
    video.preload = 'auto';
    jouer();
    // Vidéo pas encore prête : le texte part sans elle, et la version légère prend le relais si besoin
    minuteurs.push(setTimeout(() => { if (enScene && !enCours && departTexte === null) { departTexte = performance.now(); lancerBoucle(); } }, 700));
    minuteurs.push(setTimeout(() => { if (enScene && !enCours) basculerLeger(); }, 2000));
  };
  const arreter = () => {
    annulerMinuteurs();
    enScene = false;
    misEnPause = false;
    departTexte = null;
    video.pause();
    if (video.readyState > 0) video.currentTime = 0;
    suivante = 0;
    peindre(0);
    rejouer.hidden = true;
    rejouer.querySelector('span').textContent = 'Lire la vidéo';
  };
  const relire = () => {
    annulerMinuteurs();
    departTexte = null;
    misEnPause = false;
    enScene = true;
    rejouer.hidden = true;
    video.preload = 'auto';
    if (video.readyState > 0) video.currentTime = 0;
    suivante = 0;
    jouer();
  };

  video.addEventListener('playing', () => {
    rejouer.hidden = true;
    if (departTexte !== null) {
      // La vidéo rattrape le texte déjà affiché : image, musique et texte restent ensemble
      const t = temps();
      departTexte = null;
      if (t > 0.4 && t < duree - 0.4) video.currentTime = t;
    }
    enCours = true;
    lancerBoucle();
  });
  video.addEventListener('pause', () => { enCours = false; });
  video.addEventListener('waiting', () => { minuteurs.push(setTimeout(() => { if (enScene && video.readyState < 3) basculerLeger(); }, 2000)); });
  video.addEventListener('seeked', () => { suivante = frappes.findIndex((f) => f > video.currentTime); if (suivante < 0) suivante = frappes.length; if (departTexte === null) peindre(video.currentTime); });
  video.addEventListener('ended', () => { enCours = false; peindre(duree); rejouer.querySelector('span').textContent = 'Revoir'; rejouer.hidden = false; });

  son.addEventListener('click', () => {
    sonCoupe = !video.muted;
    video.muted = sonCoupe;
    majSon();
    if (!sonCoupe && video.paused && !video.ended) relire();
  });
  rejouer.addEventListener('click', relire);
  video.addEventListener('click', () => {
    if (video.muted && !sonCoupe) { video.muted = false; majSon(); if (video.paused && !video.ended) relire(); return; }
    if (video.paused) { misEnPause = false; if (video.ended) relire(); else jouer(); } else { misEnPause = true; video.pause(); }
  });
  // Premier toucher ou clic ailleurs sur la page : le son arrive sans interrompre l'animation
  const gesteVisiteur = (e) => {
    if (!enScene || !video.muted || sonCoupe || cadre.contains(e.target)) return;
    video.muted = false;
    majSon();
  };
  document.addEventListener('click', gesteVisiteur, true);
  document.addEventListener('keydown', gesteVisiteur, true);

  // On démarre quand le défilement s'arrête sur la section ; on arrête dès qu'elle quitte l'écran
  let attente = null;
  const programmer = () => {
    clearTimeout(attente);
    attente = setTimeout(() => { if (visible && !document.hidden) demarrer(); }, 280);
  };
  new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (e.intersectionRatio >= 0.6) { visible = true; programmer(); }
      else if (e.intersectionRatio < 0.35) { visible = false; clearTimeout(attente); if (enScene || video.ended) arreter(); }
    }
  }, { threshold: [0, 0.35, 0.6] }).observe(cadre);
  window.addEventListener('scroll', () => { if (visible && !enScene) programmer(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (enScene) arreter(); } else if (visible) programmer();
  });
}
document.querySelectorAll('[data-motion]').forEach(lancerMotion);

// Coiffures : puce active selon la section visible
const styleNav = document.querySelector('.style-nav');
if (styleNav) {
  const links = [...styleNav.querySelectorAll('a')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => {
        const on = l.hash === `#${e.target.id}`;
        l.classList.toggle('is-active', on);
        if (on && styleNav.scrollWidth > styleNav.clientWidth) styleNav.scrollTo({ left: l.offsetLeft - 20, behavior: 'smooth' });
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.style').forEach((s) => spy.observe(s));
}

// Contact : conversation WhatsApp animée, rejouée en boucle tant qu'elle est visible
const chat = document.getElementById('chat');
if (chat) {
  const body = document.getElementById('chat-body');
  const field = document.getElementById('chat-field');
  const status = document.getElementById('chat-status');
  const send = chat.querySelector('.chat__send');
  const TICKS = '<svg class="msg__ticks" viewBox="0 0 16 10"><path d="M1 5.5 3.8 8.2 9.5 1.5M6.5 8.2 7 8.6 12.8 1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SCRIPT = [
    { me: 'Bonjour Nelly ! J’aimerais ce style 😍', img: 'img/nelly/card-knotless.webp' },
    { her: 'Bonjour ! Très beau choix, ce sont des knotless braids.' },
    { her: 'Elles sont à 60 €, je vous confirme selon la longueur souhaitée.' },
    { me: 'Parfait ! Vous êtes disponible samedi ?' },
    { her: 'Samedi 9 h, chez moi ou chez vous, comme vous préférez.' },
    { me: 'Chez moi, c’est noté. Merci beaucoup !' },
    { her: 'Avec plaisir, à samedi !' },
  ];
  let time = 10 * 60 + 2;
  const clock = () => { time += 1; return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let visible = false;
  const whenVisible = async () => { while (!visible || document.hidden) await wait(300); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(chat);

  const add = (html, cls) => {
    const el = document.createElement('div');
    el.className = `msg ${cls}`;
    el.innerHTML = html;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  };
  const markRead = () => body.querySelectorAll('.msg__ticks:not(.is-read)').forEach((t) => t.classList.add('is-read'));

  const typeInField = async (text) => {
    field.textContent = '';
    field.classList.add('is-typing');
    for (const ch of text) { field.textContent += ch; await wait(28 + Math.random() * 40); }
    await wait(250);
    send.classList.add('is-pressed');
    await wait(160);
    send.classList.remove('is-pressed');
    field.classList.remove('is-typing');
    field.textContent = 'Message';
  };

  const play = async () => {
    for (;;) {
      body.querySelectorAll('.msg').forEach((m) => m.remove());
      chat.classList.remove('is-fading');
      time = 10 * 60 + 2;
      for (const step of SCRIPT) {
        await whenVisible();
        if (step.me) {
          await wait(500);
          await typeInField(step.me);
          const img = step.img ? `<img class="msg__img" src="${step.img}" alt="">` : '';
          add(`${img}${step.me}<span class="msg__meta">${clock()} ${TICKS}</span>`, 'msg--me');
          await wait(900);
        } else {
          markRead();
          status.textContent = 'écrit…';
          status.classList.add('is-typing');
          const typing = add('<i></i><i></i><i></i>', 'msg--typing msg--her');
          await wait(Math.min(2400, 700 + step.her.length * 22));
          typing.remove();
          status.textContent = 'en ligne';
          status.classList.remove('is-typing');
          add(`${step.her}<span class="msg__meta">${clock()}</span>`, 'msg--her');
          await wait(700);
        }
      }
      markRead();
      await wait(4500);
      chat.classList.add('is-fading');
      await wait(700);
    }
  };

  if (reduceMotion) {
    SCRIPT.forEach((s) => add(s.me ? `${s.img ? `<img class="msg__img" src="${s.img}" alt="">` : ''}${s.me}<span class="msg__meta">${clock()} ${TICKS.replace('msg__ticks', 'msg__ticks is-read')}</span>` : `${s.her}<span class="msg__meta">${clock()}</span>`, s.me ? 'msg--me' : 'msg--her'));
  } else {
    play();
  }
}

// Statistiques de visite anonymes, sans cookie (tableau de bord de l'espace de gestion).
// Un numéro de visite tiré au hasard vit le temps de l'onglet (sessionStorage) ; rien ne permet de reconnaître
// la personne d'un jour à l'autre. Désactivable : page Confidentialité, et automatiquement sur les appareils de Nelly.
// Bouton de la page Confidentialité : refuser (ou accepter de nouveau) la mesure sur cet appareil
document.querySelectorAll('[data-stats-refus]').forEach((b) => {
  const maj = () => {
    let refuse = false;
    try { refuse = localStorage.getItem('nc_stats_off') === '1'; } catch { /* sans effet */ }
    b.textContent = refuse ? 'Mesure refusée sur cet appareil · la réactiver' : 'Ne pas compter mes visites';
  };
  b.addEventListener('click', () => {
    try {
      if (localStorage.getItem('nc_stats_off') === '1') localStorage.removeItem('nc_stats_off');
      else localStorage.setItem('nc_stats_off', '1');
    } catch { /* sans effet */ }
    maj();
  });
  maj();
});

(() => {
  let off = false; let essai = false;
  try { off = localStorage.getItem('nc_stats_off') === '1'; essai = localStorage.getItem('nc_stats_essai') === '1'; } catch { /* stockage indisponible */ }
  // Pas de mesure pour les robots, sur les appareils exclus, ni en local (sauf essai)
  if (off || navigator.webdriver || !navigator.sendBeacon || (/^(localhost|127\.)/.test(location.hostname) && !essai)) return;
  const envoyer = (e) => { try { navigator.sendBeacon('/api/stats', JSON.stringify(e)); } catch { /* sans effet */ } };
  let s; let i = 1;
  try {
    s = sessionStorage.getItem('nc_v');
    if (!s) { s = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('nc_v', s); }
    i = Number(sessionStorage.getItem('nc_i') || 0) + 1;
    sessionStorage.setItem('nc_i', String(i));
  } catch { s = Math.random().toString(36).slice(2, 14); }
  const p = location.pathname;
  const params = new URLSearchParams(location.search);
  envoyer({ t: 'v', p, s, i, r: i === 1 ? document.referrer : '', u: params.get('utm_source') || '', w: window.innerWidth });

  // Temps passé et défilement de la page, envoyés quand on la quitte
  const debut = Date.now();
  let visible = 0; let depuis = document.visibilityState === 'visible' ? Date.now() : 0;
  let defile = 0;
  const majDefile = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    defile = Math.max(defile, h > 0 ? Math.round((window.scrollY / h) * 100) : 100);
  };
  window.addEventListener('scroll', majDefile, { passive: true });
  let fini = false;
  const finir = () => {
    if (depuis) { visible += Date.now() - depuis; depuis = 0; }
    if (fini) return;
    fini = true;
    envoyer({ t: 'f', p, s, d: Math.round((visible || Date.now() - debut) / 1000), sc: defile });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finir();
    else { depuis = Date.now(); envoyer({ t: 'h', p, s }); }
  });
  window.addEventListener('pagehide', finir);

  // Signal de présence toutes les 30 s tant que la page est affichée (« en ce moment » du tableau de bord), 30 min au plus
  const presence = setInterval(() => {
    if (Date.now() - debut > 30 * 60000) clearInterval(presence);
    else if (document.visibilityState === 'visible') envoyer({ t: 'h', p, s });
  }, 30000);

  // WhatsApp et appel : comptés seulement si l'application s'ouvre vraiment (la page passe au second plan dans
  // les 5 secondes). L'envoi du message, lui, se passe dans WhatsApp : aucun site ne peut le voir.
  const siApplicationOuverte = (compter) => {
    const surVisibilite = () => { if (document.visibilityState === 'hidden') ouverte(); };
    const nettoyer = () => {
      clearTimeout(delai);
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('pagehide', ouverte);
      window.removeEventListener('blur', ouverte);
    };
    const ouverte = () => { nettoyer(); compter(); };
    const delai = setTimeout(nettoyer, 5000);
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('pagehide', ouverte);
    window.addEventListener('blur', ouverte);
  };

  // Liens de contact : WhatsApp, appel, réseaux sociaux, itinéraire
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const h = a.href;
    const k = /wa\.me|whatsapp/.test(h) ? 'whatsapp' : /^tel:/.test(h) ? 'appel' : /instagram\.com/.test(h) ? 'instagram'
      : /tiktok\.com/.test(h) ? 'tiktok' : /facebook\.com/.test(h) ? 'facebook' : /snapchat\.com/.test(h) ? 'snapchat'
      : /youtube\.com/.test(h) ? 'youtube' : /google\.[a-z.]+\/maps|maps\.app/.test(h) ? 'itineraire' : '';
    if (k === 'whatsapp' || k === 'appel') siApplicationOuverte(() => envoyer({ t: 'c', p, s, k }));
    else if (k) envoyer({ t: 'c', p, s, k });
  }, true);
})();
