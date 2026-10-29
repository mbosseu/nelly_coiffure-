// Numéro WhatsApp de Nelly au format international, sans "+", ni espaces, ni 0 initial (ex. 06 12 34 56 78 -> 33612345678)
const WHATSAPP_NUMBER = '33600000000';

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
  chipGroup(filters, (i, chip) => {
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
}

// Visionneuse, partagée par la mosaïque et la galerie
const lightbox = document.getElementById('lightbox');
if (lightbox && (tiles.length || gallery)) {
  const lbImg = document.getElementById('lightbox-img');
  const lbLabel = document.getElementById('lightbox-label');
  const lbWa = document.getElementById('lightbox-wa');
  const items = () => (gallery ? [...gallery.querySelectorAll('.gallery__item:not(.is-hidden)')] : tiles);
  let current = 0;
  const show = (i) => {
    const list = items();
    current = (i + list.length) % list.length;
    const t = list[current];
    const img = t.querySelector('img');
    lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
    lbLabel.textContent = t.dataset.label;
    setWa(lbWa, `Bonjour Nelly, j'ai vu ce style sur votre site : « ${t.dataset.label} ». Je voudrais le même, pouvez-vous me donner un tarif ?`);
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.mosaic__item, .gallery__item');
    if (!t) return;
    show(items().indexOf(t));
    lightbox.showModal();
  });
  lightbox.querySelector('[data-close]').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-prev]').addEventListener('click', () => show(current - 1));
  lightbox.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  let touchX = null;
  lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
}

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
