import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

// Audit mobile : captures pleine page en émulation iPhone (390 x 844, Retina, tactile) et mesures automatiques.
// Prérequis : serveur local lancé (node outils/serveur.mjs). Usage : node outils/audit-mobile.mjs [page…]
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:5173/';
const OUT = new URL('./captures/mobile/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['index', 'coiffures', 'realisations', 'a-propos', 'contact', 'mentions-legales', '404'];
const W = Number(process.env.AUDIT_W || 390), H = 844;
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--hide-scrollbars'] });
const rapport = {};
for (const p of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.goto(`${BASE}${p}.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  // Défilement progressif pour déclencher les apparitions et le chargement différé des images
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hauteur; y += 300) { await page.evaluate((v) => window.scrollTo(0, v), y); await new Promise((r) => setTimeout(r, 120)); }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise((r) => setTimeout(r, 1800));

  rapport[p] = await page.evaluate((W) => {
    const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length; };
    const nom = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].slice(0, 2).join('.')}`;
    const horsScroll = (e) => !e.closest('.cards,.mosaic,.reviews-track,.style-nav,.marquee,.nav,.filters');
    const tous = [...document.querySelectorAll('body *')].filter(vis);
    const debordent = tous.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > W + 1 || r.left < -1) && horsScroll(e) && getComputedStyle(e).position !== 'fixed'; }).map(nom);
    const petitsTextes = tous.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => `${nom(e)} ${getComputedStyle(e).fontSize} « ${e.textContent.trim().slice(0, 30)} »`);
    const ciblesEtroites = tous.filter((e) => e.matches('a, button, summary, input') && !e.closest('.nav') ).filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.height < 40 || r.width < 40) && e.textContent.trim().length < 40; }).map((e) => { const r = e.getBoundingClientRect(); return `${nom(e)} ${Math.round(r.width)}x${Math.round(r.height)} « ${e.textContent.trim().slice(0, 25)} »`; });
    const texteCoupe = tous.filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible' && horsScroll(e) && !['IMG', 'svg'].includes(e.tagName)).map((e) => `${nom(e)} ${e.scrollWidth}>${e.clientWidth}`);
    const imagesVides = [...document.images].filter((i) => vis(i) && i.getAttribute('src') && (!i.complete || !i.naturalWidth)).map((i) => i.getAttribute('src'));
    const invisibles = [...document.querySelectorAll('.reveal:not(.is-in)')].filter(vis).map(nom);
    return { largeur: document.documentElement.scrollWidth, debordent: [...new Set(debordent)].slice(0, 15), petitsTextes: petitsTextes.slice(0, 20), ciblesEtroites: [...new Set(ciblesEtroites)].slice(0, 25), texteCoupe: texteCoupe.slice(0, 10), imagesVides, invisibles: invisibles.slice(0, 10) };
  }, W);

  // Capture pleine page, puis découpe en écrans de téléphone côte à côte
  const fichier = `${OUT}${p}.png`;
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: fichier, fullPage: true });
  const { height } = await sharp(fichier).metadata();
  const ecran = H * 2, nb = Math.ceil(height / ecran), parPlanche = 4;
  for (let k = 0; k < Math.ceil(nb / parPlanche); k++) {
    const tuiles = [];
    for (let j = 0; j < parPlanche; j++) {
      const i = k * parPlanche + j; if (i >= nb) break;
      const top = i * ecran, h = Math.min(ecran, height - top);
      tuiles.push({ input: await sharp(fichier).extract({ left: 0, top, width: W * 2, height: h }).resize({ width: W }).toBuffer(), left: j * 400, top: 0 });
    }
    await sharp({ create: { width: parPlanche * 400, height: H, channels: 3, background: '#888' } }).composite(tuiles).png().toFile(`${OUT}${p}-${k + 1}.png`);
  }
  rapport[p].ecrans = nb;
  await page.close();
}
writeFileSync(`${OUT}rapport.json`, JSON.stringify(rapport, null, 2));
await browser.close().catch(() => {});
console.log(JSON.stringify(rapport, null, 1));
