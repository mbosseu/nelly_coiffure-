import { publier, ErreurGithub } from './_lib/github.mjs';
import { redis, statsActives } from './_lib/stats.mjs';
import { lireJeton } from './_lib/oauth.mjs';

// Envoi d'une photo par lien à usage unique, préparé par l'assistant IA (outil preparer_envoi_photo).
// GET /envoi?j=… : page où Nelly choisit la photo sur son téléphone ; elle est redimensionnée dans le navigateur
// (mêmes formats que l'espace de gestion) puis envoyée en POST. Le jeton, signé avec ADMIN_SECRET, fixe
// l'emplacement de la photo et expire après 20 minutes ; il ne sert qu'une fois.
// La photo est ajoutée au dépôt (dossier d'images) sans être affichée : l'assistant l'utilise ensuite.

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
      return page(res, 200, formulaire(j, String(req.query.j)));
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
  if (!j || !/^img\/(realisations\/catalogue|annonces|pages)\/[a-z0-9-]+$/.test(j.c || '')) return repondre(400, { erreur: 'Ce lien n’est plus valable. Demandez un nouveau lien à l’assistant.' });
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

function formulaire(j, jeton) {
  const f = FORMATS[j.f] || FORMATS.libre;
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

function page(res, statut, contenu) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'");
  res.status(statut).end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Envoyer une photo · Nelly Coiffure</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#F6EDE4;color:#2B1A12;font:15px/1.6 Poppins,system-ui,sans-serif}
main{width:100%;max-width:440px;background:#fff;border:1px solid #E7D8CA;border-radius:24px;padding:28px 22px;box-shadow:0 24px 50px -36px rgba(60,30,15,.55);text-align:center}
.logo{display:block;height:46px;margin:0 auto 16px}.sur{margin:0 0 6px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#B0714A}
h1{font:400 1.55rem/1.25 Fraunces,Georgia,serif;margin:0 0 10px}.texte{margin:0 0 16px;color:#5A463A}
.choisir{display:grid;place-items:center;min-height:220px;margin:0 0 14px;border:1.5px dashed #D9C6B5;border-radius:18px;background:#FBF6F1;cursor:pointer;overflow:hidden}
.choisir input{position:absolute;opacity:0;width:1px;height:1px}.choisir span{padding:20px;color:#8A7666;font-weight:500}
.choisir img{display:block;max-width:100%;max-height:360px}.choisir.fait{border-style:solid;border-color:#3BA55C}
.principal{width:100%;padding:14px;border:0;border-radius:99px;background:#2B1A12;color:#F6EDE4;font:inherit;font-weight:600;cursor:pointer}.principal:disabled{opacity:.45;cursor:default}
.erreur{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#FBE9E7;color:#9B2C1F;font-size:.85rem}
.ok{margin:8px 0 0;font-weight:600;color:#2F7D46}.ok small{font-weight:400;color:#5A463A}
</style></head><body><main><img class="logo" src="/img/marque/logo.webp" alt="Nelly Coiffure">${contenu}</main></body></html>`);
}
