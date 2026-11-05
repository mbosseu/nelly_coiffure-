import { publier, lireBlob, ErreurGithub } from './_lib/github.mjs';
import { redis, statsActives } from './_lib/stats.mjs';
import { lireJeton } from './_lib/oauth.mjs';
import { stockerMorceau, assemblerVideo, SHA } from './_lib/video.mjs';

// Envoi d'une photo par lien à usage unique, préparé par l'assistant IA (outil preparer_envoi_photo).
// GET /envoi?j=… : page où Nelly choisit la photo sur son téléphone ; elle est redimensionnée dans le navigateur
// (mêmes formats que l'espace de gestion) puis envoyée en POST. Le jeton, signé avec ADMIN_SECRET, fixe
// l'emplacement de la photo et expire après 20 minutes ; il ne sert qu'une fois.
// La photo est ajoutée au dépôt (dossier d'images) sans être affichée : l'assistant l'utilise ensuite.
// Variantes du jeton : m = plusieurs photos d'un coup (emplacement-1, -2…) ; f = 'video' : vidéo préparée dans le navigateur
// (admin/video.js), envoyée par morceaux, avec son image de couverture ; ses informations vont dans contenu/videos.

const MAX_PHOTO = 900 * 1024;
const FORMATS = {
  portrait: { grand: [1000, 1250], petit: [500, 625], recadrer: true, aide: 'Elle sera recadrée au format portrait, comme les autres réalisations.' },
  libre: { grand: [1600, 1600], petit: [800, 800], recadrer: false, aide: 'Elle sera gardée entière, sans recadrage.' },
};

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleUsage = (j) => `envoi:${j.k}`;

async function dejaUtilise(j) {
  if (!statsActives()) return false;
  try { return Boolean((await redis([['GET', cleUsage(j)]]))[0]); } catch { return false; }
}
// Réserve le jeton (une seule utilisation) ; renvoie false s'il a déjà servi
async function reserver(j) {
  if (!statsActives()) return true;
  try { return (await redis([['SET', cleUsage(j), '1', 'NX', 'EX', 3600]]))[0] === 'OK'; } catch { return true; }
}
const liberer = (j) => (statsActives() ? redis([['DEL', cleUsage(j)]]).catch(() => {}) : null);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (req.method === 'GET') {
      const j = lireJeton('envoi', String(req.query.j || ''));
      if (!j) return page(res, 400, '<h1>Lien expiré</h1><p class="texte">Ce lien d’envoi n’est plus valable (il dure 20 minutes). Demandez à l’assistant un nouveau lien.</p>');
      if (await dejaUtilise(j)) return page(res, 410, '<h1>Photo déjà envoyée</h1><p class="texte">Ce lien a déjà servi. Retournez dans la conversation avec l’assistant pour continuer.</p>');
      return page(res, 200, j.f === 'video' ? formulaireVideo(j, String(req.query.j)) : formulaire(j, String(req.query.j)));
    }
    if (req.method === 'POST') return recevoir(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e) {
    console.error('envoi', e);
    return page(res, 500, '<h1>Erreur</h1><p class="texte">Erreur inattendue. Réessayez dans un instant.</p>');
  }
}

async function recevoir(req, res) {
  const repondre = (statut, donnees) => { res.setHeader('Content-Type', 'application/json'); return res.status(statut).end(JSON.stringify(donnees)); };
  let corps = req.body;
  if (typeof corps === 'string' || Buffer.isBuffer(corps)) { try { corps = JSON.parse(corps.toString()); } catch { corps = null; } }
  if (req.headers['x-nelly-envoi'] !== '1' || !corps) return repondre(400, { erreur: 'Envoi invalide.' });
  const j = lireJeton('envoi', String(corps.j || ''));
  if (!j) return repondre(400, { erreur: 'Ce lien n’est plus valable. Demandez un nouveau lien à l’assistant.' });
  if (corps.action) {
    try {
      if (await dejaUtilise(j)) return repondre(410, { erreur: 'Ce lien a déjà servi.' });
      if (corps.action === 'morceau') return repondre(200, { sha: await stockerMorceau(corps.base64) });
      if (corps.action === 'fin-video' && j.f === 'video') return await finirVideo(j, corps, repondre);
      if (corps.action === 'fin-photos' && j.m) return await finirPhotos(j, corps, repondre);
      return repondre(400, { erreur: 'Envoi invalide.' });
    } catch (e) {
      console.error('envoi', e);
      return repondre(e.invalide ? 400 : 502, { erreur: e.invalide ? e.message : 'L’envoi n’a pas pu être enregistré. Réessayez dans un instant.' });
    }
  }
  if (!/^img\/(realisations\/catalogue|annonces|pages)\/[a-z0-9-]+$/.test(j.c || '')) return repondre(400, { erreur: 'Ce lien n’est plus valable. Demandez un nouveau lien à l’assistant.' });
  const fichiers = [];
  for (const [cle, suffixe] of [['grand', ''], ['petit', '-sm']]) {
    const b64 = String(corps[cle] || '');
    const octets = Buffer.from(b64, 'base64');
    if (!octets.length || octets.length > MAX_PHOTO || octets[0] !== 0xff || octets[1] !== 0xd8 || octets[2] !== 0xff) return repondre(400, { erreur: 'Photo invalide ou trop lourde.' });
    fichiers.push({ chemin: `site/${j.c}${suffixe}.jpg`, base64: b64 });
  }
  if (!(await reserver(j))) return repondre(410, { erreur: 'Ce lien a déjà servi.' });
  try {
    await publier(fichiers, `Espace Nelly : photo envoyée pour l’assistant IA (${j.c.split('/').pop()})`);
  } catch (e) {
    await liberer(j);
    console.error('envoi', e);
    return repondre(502, { erreur: e instanceof ErreurGithub ? 'La photo n’a pas pu être enregistrée. Réessayez dans un instant.' : 'Erreur inattendue. Réessayez.' });
  }
  return repondre(200, { ok: true, chemin: j.c });
}

const estJpeg = (o) => o.length && o.length <= MAX_PHOTO && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;

// Fin de l'envoi de plusieurs photos : tout part en une seule publication
async function finirPhotos(j, corps, repondre) {
  const photos = Array.isArray(corps.photos) ? corps.photos : [];
  if (!/^img\/(realisations\/catalogue|annonces|pages)\/[a-z0-9-]+$/.test(j.c || '') || !photos.length || photos.length > Number(j.m)) return repondre(400, { erreur: 'Envoi invalide.' });
  const fichiers = [];
  for (const [i, p] of photos.entries()) {
    if (!SHA.test(p?.grand || '') || !SHA.test(p?.petit || '')) return repondre(400, { erreur: 'Envoi invalide.' });
    if (!estJpeg(await lireBlob(p.grand)) || !estJpeg(await lireBlob(p.petit))) return repondre(400, { erreur: 'Photo invalide ou trop lourde.' });
    fichiers.push({ chemin: `site/${j.c}-${i + 1}.jpg`, sha: p.grand }, { chemin: `site/${j.c}-${i + 1}-sm.jpg`, sha: p.petit });
  }
  if (!(await reserver(j))) return repondre(410, { erreur: 'Ce lien a déjà servi.' });
  try { await publier(fichiers, `Espace Nelly : ${photos.length} photos envoyées pour l’assistant IA (${j.c.split('/').pop()})`); } catch (e) { await liberer(j); throw e; }
  return repondre(200, { ok: true, nombre: photos.length });
}

// Fin de l'envoi d'une vidéo : le fichier, sa couverture et ses informations, en une publication
async function finirVideo(j, corps, repondre) {
  if (!/^video\/[a-z0-9-]+$/.test(j.c || '') || !/^img\/(realisations\/catalogue|annonces)\/[a-z0-9-]+$/.test(j.p || '')) return repondre(400, { erreur: 'Ce lien n’est plus valable.' });
  const largeur = Number(corps.largeur); const hauteur = Number(corps.hauteur); const duree = Number(corps.duree);
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || largeur <= 0 || hauteur <= 0 || !(duree > 0)) return repondre(400, { erreur: 'Envoi invalide.' });
  const grand = Buffer.from(String(corps.grand || ''), 'base64'); const petit = Buffer.from(String(corps.petit || ''), 'base64');
  if (!estJpeg(grand) || !estJpeg(petit)) return repondre(400, { erreur: 'Image de couverture invalide.' });
  const { sha } = await assemblerVideo(corps.morceaux);
  if (!(await reserver(j))) return repondre(410, { erreur: 'Ce lien a déjà servi.' });
  const nom = j.c.split('/').pop();
  try {
    await publier([
      { chemin: `site/${j.c}.mp4`, sha },
      { chemin: `site/${j.p}.jpg`, base64: String(corps.grand) },
      { chemin: `site/${j.p}-sm.jpg`, base64: String(corps.petit) },
      { chemin: `contenu/videos/${nom}.json`, texte: `${JSON.stringify({ image: j.p, largeur, hauteur, duree })}\n` },
    ], `Espace Nelly : vidéo envoyée pour l’assistant IA (${nom})`);
  } catch (e) { await liberer(j); throw e; }
  return repondre(200, { ok: true, chemin: j.c });
}

function formulaireVideo(j, jeton) {
  return `
    <p class="sur">Nelly Coiffure · Envoi d’une vidéo</p>
    <h1>Choisissez la vidéo</h1>
    <p class="texte">${echapper(j.u || 'Pour votre site')}. Elle sera préparée automatiquement sur votre téléphone : belle qualité, une minute au plus.</p>
    <label class="choisir" id="zone"><input type="file" id="fichier" accept="video/*"><span id="invite">Toucher ici pour choisir une vidéo</span></label>
    <div id="travail" hidden><p class="texte" id="etat"></p><progress id="barre" max="100" value="0"></progress><p class="texte"><small>Gardez cette page ouverte.</small></p></div>
    <div id="reglage" hidden>
      <div class="cadre" id="cadre" style="aspect-ratio:${j.r ? '4/5' : 'auto'}"><video id="video" muted playsinline></video></div>
      <p class="texte" id="consigne"><small>Faites glisser l’image pour bien cadrer la couverture.</small></p>
      <label class="etiquette" for="moment">Moment choisi pour la couverture</label>
      <input type="range" id="moment" min="0" max="100" value="10">
      <p class="note" id="note" hidden></p>
      <button type="button" class="principal" id="envoyer">Envoyer la vidéo</button>
    </div>
    <p class="erreur" id="erreur" hidden></p>
    <p class="ok" id="ok" hidden>Vidéo envoyée ✓<br><small>Retournez dans la conversation avec l’assistant et dites-lui que c’est fait.</small></p>
    <script type="module">
      const F = ${JSON.stringify({ jeton, recadrer: Boolean(j.r) })};
      const $ = (id) => document.getElementById(id);
      const V = await import('/admin/video.js');
      const erreur = (m) => { $('erreur').textContent = m; $('erreur').hidden = !m; };
      const etape = (t, v) => { $('etat').textContent = t; $('barre').value = v; };
      const poster = async (corps) => {
        const r = await fetch('/envoi', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nelly-Envoi': '1' }, body: JSON.stringify({ j: F.jeton, ...corps }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erreur || 'Erreur ' + r.status);
        return d;
      };
      let conv = null; let cadrage = { x: 50, y: 35 }; let dep = null;
      const placer = () => { $('video').style.objectPosition = cadrage.x + '% ' + cadrage.y + '%'; };
      $('moment').addEventListener('input', () => V.allerA($('video'), (Number($('moment').value) / 100) * ($('video').duration || 0)));
      if (F.recadrer) {
        const c = $('cadre');
        c.addEventListener('pointerdown', (e) => { dep = { px: e.clientX, py: e.clientY, ...cadrage }; c.setPointerCapture(e.pointerId); });
        c.addEventListener('pointermove', (e) => { if (!dep) return; const r = c.getBoundingClientRect(); cadrage = { x: Math.min(100, Math.max(0, dep.x - ((e.clientX - dep.px) / r.width) * 100)), y: Math.min(100, Math.max(0, dep.y - ((e.clientY - dep.py) / r.height) * 100)) }; placer(); });
        c.addEventListener('pointerup', () => { dep = null; });
      } else $('consigne').hidden = true;
      $('fichier').addEventListener('change', async () => {
        const f = $('fichier').files[0];
        if (!f) return;
        erreur(''); $('zone').hidden = true; $('travail').hidden = false; $('reglage').hidden = true;
        try {
          conv = await V.convertirVideo(f, (p) => etape('Préparation de la vidéo… ' + Math.round(p * 100) + ' %', p * 100));
          await V.chargerDansElement($('video'), conv.blob);
          if (!F.recadrer) $('cadre').style.aspectRatio = conv.largeur + '/' + conv.hauteur;
          await V.allerA($('video'), 0.1 * ($('video').duration || 0));
          placer();
          if (conv.coupee) { $('note').textContent = 'Cette vidéo dure plus d’une minute : seules les ' + V.DUREE_MAX + ' premières secondes sont gardées.'; $('note').hidden = false; }
          $('travail').hidden = true; $('reglage').hidden = false;
        } catch (e) { $('travail').hidden = true; $('zone').hidden = false; erreur(e.message); }
      });
      $('envoyer').addEventListener('click', async () => {
        erreur(''); $('reglage').hidden = true; $('travail').hidden = false;
        try {
          const im = V.imageCouverture($('video'), { recadrer: F.recadrer, ...cadrage });
          const morceaux = await V.envoyerParMorceaux(conv.blob, async (base64) => (await poster({ action: 'morceau', base64 })).sha, (p) => etape('Envoi de la vidéo… ' + Math.round(p * 95) + ' %', p * 95));
          etape('Enregistrement de la vidéo…', 97);
          await poster({ action: 'fin-video', morceaux, grand: im.grand, petit: im.petit, largeur: conv.largeur, hauteur: conv.hauteur, duree: conv.duree });
          $('travail').hidden = true; $('ok').hidden = false;
        } catch (e) { $('travail').hidden = true; $('reglage').hidden = false; erreur(e.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez.' : e.message); }
      });
    </script>`;
}

function formulaire(j, jeton) {
  const f = FORMATS[j.f] || FORMATS.libre;
  if (j.m) return formulairePlusieurs(j, jeton, f);
  return `
    <p class="sur">Nelly Coiffure · Envoi d’une photo</p>
    <h1>Choisissez la photo</h1>
    <p class="texte">${echapper(j.u || 'Pour votre site')}. ${f.aide}</p>
    <label class="choisir" id="zone"><input type="file" id="fichier" accept="image/*"><span id="invite">Toucher ici pour choisir une photo</span><img id="apercu" alt="" hidden></label>
    <p class="erreur" id="erreur" hidden></p>
    <button type="button" class="principal" id="envoyer" disabled>Envoyer la photo</button>
    <p class="ok" id="ok" hidden>Photo envoyée ✓<br><small>Retournez dans la conversation avec l’assistant et dites-lui que c’est fait.</small></p>
    <script>
      const F = ${JSON.stringify({ ...f, jeton })};
      const $ = (id) => document.getElementById(id);
      let photo = null;
      const dessiner = (img, l, h) => {
        const c = document.createElement('canvas');
        let sx = 0, sy = 0, sl = img.naturalWidth, sh = img.naturalHeight;
        if (F.recadrer) { const r = l / h; if (sl / sh > r) sl = sh * r; else sh = sl / r; sx = (img.naturalWidth - sl) / 2; sy = (img.naturalHeight - sh) / 2; }
        else { const e = Math.min(1, l / Math.max(sl, sh)); l = Math.round(sl * e); h = Math.round(sh * e); }
        c.width = l; c.height = h;
        const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, sy, sl, sh, 0, 0, l, h);
        return c.toDataURL('image/jpeg', 0.82);
      };
      const erreur = (m) => { $('erreur').textContent = m; $('erreur').hidden = !m; };
      $('fichier').addEventListener('change', async () => {
        erreur(''); photo = null; $('envoyer').disabled = true;
        const fichier = $('fichier').files[0];
        if (!fichier) return;
        if (fichier.size > 40 * 1024 * 1024) return erreur('Cette image est trop lourde (plus de 40 Mo).');
        const url = URL.createObjectURL(fichier);
        const img = new Image(); img.src = url;
        try { await img.decode(); } catch { URL.revokeObjectURL(url); return erreur('Ce format n’est pas lisible ici. Sur iPhone, choisissez la photo depuis « Photos ».'); }
        const grand = dessiner(img, ...F.grand); const petit = dessiner(img, ...F.petit);
        URL.revokeObjectURL(url);
        photo = { grand: grand.split(',')[1], petit: petit.split(',')[1] };
        $('apercu').src = petit; $('apercu').hidden = false; $('invite').hidden = true; $('envoyer').disabled = false;
      });
      $('envoyer').addEventListener('click', async () => {
        if (!photo) return;
        $('envoyer').disabled = true; $('envoyer').textContent = 'Envoi…'; erreur('');
        try {
          const r = await fetch('/envoi', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nelly-Envoi': '1' }, body: JSON.stringify({ j: F.jeton, ...photo }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.erreur || 'Erreur ' + r.status);
          $('envoyer').hidden = true; $('zone').classList.add('fait'); $('fichier').disabled = true; $('ok').hidden = false;
        } catch (e) {
          erreur(e.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez.' : e.message);
          $('envoyer').disabled = false; $('envoyer').textContent = 'Envoyer la photo';
        }
      });
    </script>`;
}

// Plusieurs photos d'un coup (album) : préparées dans le navigateur, déposées une à une, publiées ensemble
function formulairePlusieurs(j, jeton, f) {
  return `
    <p class="sur">Nelly Coiffure · Envoi de photos</p>
    <h1>Choisissez les photos</h1>
    <p class="texte">${echapper(j.u || 'Pour votre site')}. ${Number(j.m)} photos au maximum, dans l’ordre voulu. ${f.aide.replace('Elle sera', 'Elles seront').replace('recadrée', 'recadrées').replace('gardée entière', 'gardées entières')}</p>
    <label class="choisir" id="zone"><input type="file" id="fichier" accept="image/*" multiple><span id="invite">Toucher ici pour choisir les photos</span><span class="vignettes" id="vignettes" hidden></span></label>
    <p class="erreur" id="erreur" hidden></p>
    <button type="button" class="principal" id="envoyer" disabled>Envoyer les photos</button>
    <p class="ok" id="ok" hidden>Photos envoyées ✓<br><small>Retournez dans la conversation avec l’assistant et dites-lui que c’est fait.</small></p>
    <script>
      const F = ${JSON.stringify({ ...f, jeton, max: Number(j.m) })};
      const $ = (id) => document.getElementById(id);
      let photos = [];
      const dessiner = (img, l, h) => {
        const c = document.createElement('canvas');
        let sx = 0, sy = 0, sl = img.naturalWidth, sh = img.naturalHeight;
        if (F.recadrer) { const r = l / h; if (sl / sh > r) sl = sh * r; else sh = sl / r; sx = (img.naturalWidth - sl) / 2; sy = (img.naturalHeight - sh) / 2; }
        else { const e = Math.min(1, l / Math.max(sl, sh)); l = Math.round(sl * e); h = Math.round(sh * e); }
        c.width = l; c.height = h;
        const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, sy, sl, sh, 0, 0, l, h);
        return c.toDataURL('image/jpeg', 0.82);
      };
      const erreur = (m) => { $('erreur').textContent = m; $('erreur').hidden = !m; };
      const poster = async (corps) => {
        const r = await fetch('/envoi', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nelly-Envoi': '1' }, body: JSON.stringify({ j: F.jeton, ...corps }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erreur || 'Erreur ' + r.status);
        return d;
      };
      $('fichier').addEventListener('change', async () => {
        erreur(''); photos = []; $('envoyer').disabled = true; $('vignettes').replaceChildren();
        const fichiers = [...$('fichier').files];
        if (!fichiers.length) return;
        if (fichiers.length > F.max) return erreur('Choisissez ' + F.max + ' photos au maximum.');
        $('invite').textContent = 'Préparation des photos…';
        for (const fichier of fichiers) {
          const url = URL.createObjectURL(fichier);
          const img = new Image(); img.src = url;
          try { await img.decode(); } catch { URL.revokeObjectURL(url); $('invite').textContent = 'Toucher ici pour choisir les photos'; return erreur('Une photo n’est pas lisible ici. Sur iPhone, choisissez-les depuis « Photos ».'); }
          const grand = dessiner(img, ...F.grand); const petit = dessiner(img, ...F.petit);
          URL.revokeObjectURL(url);
          photos.push({ grand: grand.split(',')[1], petit: petit.split(',')[1] });
          const v = new Image(); v.src = petit; v.alt = ''; $('vignettes').append(v);
        }
        $('invite').hidden = true; $('vignettes').hidden = false; $('envoyer').disabled = false;
        $('envoyer').textContent = 'Envoyer les ' + photos.length + ' photos';
      });
      $('envoyer').addEventListener('click', async () => {
        $('envoyer').disabled = true; erreur('');
        try {
          const shas = [];
          for (const [i, p] of photos.entries()) {
            $('envoyer').textContent = 'Envoi ' + (i + 1) + '/' + photos.length + '…';
            shas.push({ grand: (await poster({ action: 'morceau', base64: p.grand })).sha, petit: (await poster({ action: 'morceau', base64: p.petit })).sha });
          }
          await poster({ action: 'fin-photos', photos: shas });
          $('envoyer').hidden = true; $('zone').classList.add('fait'); $('fichier').disabled = true; $('ok').hidden = false;
        } catch (e) {
          erreur(e.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez.' : e.message);
          $('envoyer').disabled = false; $('envoyer').textContent = 'Envoyer les photos';
        }
      });
    </script>`;
}

function page(res, statut, contenu) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'");
  res.status(statut).end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Envoi · Nelly Coiffure</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#F6EDE4;color:#2B1A12;font:15px/1.6 Poppins,system-ui,sans-serif}
main{width:100%;max-width:440px;background:#fff;border:1px solid #E7D8CA;border-radius:24px;padding:28px 22px;box-shadow:0 24px 50px -36px rgba(60,30,15,.55);text-align:center}
.logo{display:block;height:46px;margin:0 auto 16px}.sur{margin:0 0 6px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#B0714A}
h1{font:400 1.55rem/1.25 Fraunces,Georgia,serif;margin:0 0 10px}.texte{margin:0 0 16px;color:#5A463A}
.choisir{display:grid;place-items:center;min-height:220px;margin:0 0 14px;border:1.5px dashed #D9C6B5;border-radius:18px;background:#FBF6F1;cursor:pointer;overflow:hidden}
.choisir input{position:absolute;opacity:0;width:1px;height:1px}.choisir span{padding:20px;color:#8A7666;font-weight:500}
.choisir img{display:block;max-width:100%;max-height:360px}.choisir.fait{border-style:solid;border-color:#3BA55C}
.principal{width:100%;padding:14px;border:0;border-radius:99px;background:#2B1A12;color:#F6EDE4;font:inherit;font-weight:600;cursor:pointer}.principal:disabled{opacity:.45;cursor:default}
.erreur{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#FBE9E7;color:#9B2C1F;font-size:.85rem}
.ok{margin:8px 0 0;font-weight:600;color:#2F7D46}.ok small{font-weight:400;color:#5A463A}
.vignettes{display:grid!important;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px!important;width:100%}.vignettes[hidden]{display:none!important}.vignettes img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px}
progress{display:block;width:100%;height:10px;margin:6px 0 10px;accent-color:#B0714A}
.cadre{position:relative;width:min(100%,280px);margin:0 auto 10px;overflow:hidden;border-radius:14px;background:#1a0d06;touch-action:none}.cadre video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.etiquette{display:block;font-weight:500;font-size:.85rem;margin:0 0 4px}input[type=range]{width:100%;margin:0 0 14px}.note{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#FBF6F1;font-size:.85rem}
</style></head><body><main><img class="logo" src="/img/marque/logo.webp" alt="Nelly Coiffure">${contenu}</main></body></html>`);
}
