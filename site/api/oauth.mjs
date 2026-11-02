import { motDePasseValide } from './_lib/session.mjs';
import { revoqueesAvant } from './_lib/publication.mjs';
import { redis, statsActives } from './_lib/stats.mjs';
import {
  signerJeton, lireJeton, nouveauNonce, pkceValide, adresseRetourValide, origine,
  DUREE_ACCES, DUREE_RENOUVELLEMENT, DUREE_CODE,
} from './_lib/oauth.mjs';

// Connexion d'un assistant IA (Claude, Le Chat…) au connecteur du site (api/mcp.mjs), selon OAuth 2.1.
// Adresses (réécrites par vercel.json) :
//   /.well-known/oauth-authorization-server  → description du serveur d'autorisation
//   /.well-known/oauth-protected-resource    → description du connecteur protégé
//   /oauth/inscription  → inscription automatique de l'assistant (client public, sans secret)
//   /oauth/autoriser    → page où Nelly autorise l'assistant avec le mot de passe de l'espace de gestion
//   /oauth/jeton        → échange du code contre les jetons, renouvellement

const essais = new Map();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const envoyerJson = (res, statut, donnees) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statut).end(JSON.stringify(donnees));
};
const erreurOAuth = (res, statut, code, description) => envoyerJson(res, statut, { error: code, error_description: description });

// Corps de requête : JSON ou formulaire, déjà décodé ou brut
function corps(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const texte = Buffer.isBuffer(b) ? b.toString('utf8') : String(b || '');
  if (/json/.test(req.headers['content-type'] || '')) { try { return JSON.parse(texte || '{}'); } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(texte));
}

export default async function handler(req, res) {
  const etape = req.query.etape;
  const base = origine(req);
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version');
      return res.status(204).end();
    }
    if (etape === 'serveur') {
      return envoyerJson(res, 200, {
        issuer: base,
        authorization_endpoint: `${base}/oauth/autoriser`,
        token_endpoint: `${base}/oauth/jeton`,
        registration_endpoint: `${base}/oauth/inscription`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['site'],
        service_documentation: `${base}/`,
      });
    }
    if (etape === 'ressource') {
      return envoyerJson(res, 200, {
        resource: `${base}/api/mcp`,
        authorization_servers: [base],
        scopes_supported: ['site'],
        bearer_methods_supported: ['header'],
        resource_name: 'Nelly Coiffure',
      });
    }
    if (etape === 'inscription' && req.method === 'POST') return inscrire(req, res);
    if (etape === 'autoriser' && req.method === 'GET') return pageAutorisation(req, res, req.query);
    if (etape === 'autoriser' && req.method === 'POST') return autoriser(req, res);
    if (etape === 'jeton' && req.method === 'POST') return delivrerJetons(req, res);
    return erreurOAuth(res, 404, 'not_found', 'Adresse inconnue.');
  } catch (e) {
    console.error('oauth', e);
    return erreurOAuth(res, 500, 'server_error', 'Erreur inattendue.');
  }
}

// --- Inscription automatique (RFC 7591) : l'identifiant de l'assistant contient, signées, ses adresses de retour ---
function inscrire(req, res) {
  const d = corps(req);
  const retours = Array.isArray(d.redirect_uris) ? d.redirect_uris.map(String) : [];
  if (!retours.length || retours.length > 10 || !retours.every(adresseRetourValide)) {
    return erreurOAuth(res, 400, 'invalid_redirect_uri', 'Adresses de retour invalides (https obligatoire).');
  }
  const nom = String(d.client_name || 'Assistant IA').replace(/[<>]/g, '').slice(0, 60);
  const client = signerJeton('client', { r: retours, n: nom });
  return envoyerJson(res, 201, {
    client_id: client,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: nom,
    redirect_uris: retours,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
}

// Paramètres d'une demande d'autorisation, vérifiés ; renvoie { erreur } si l'assistant ou l'adresse de retour sont invalides
function demande(p) {
  const client = lireJeton('client', p.client_id);
  if (!client) return { erreur: 'Assistant inconnu. Supprimez le connecteur et ajoutez-le de nouveau.' };
  if (!client.r.includes(p.redirect_uri)) return { erreur: 'Adresse de retour non enregistrée pour cet assistant.' };
  const retour = (params) => {
    const u = new URL(p.redirect_uri);
    for (const [k, v] of Object.entries({ ...params, ...(p.state ? { state: p.state } : {}) })) u.searchParams.set(k, v);
    return u.toString();
  };
  if (p.response_type !== 'code') return { client, retour, refus: 'unsupported_response_type' };
  if (!p.code_challenge || p.code_challenge_method !== 'S256') return { client, retour, refus: 'invalid_request' };
  return { client, retour };
}

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHAMPS = ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource'];

function pageAutorisation(req, res, p, message = '') {
  const d = demande(p);
  if (d.erreur) return envoyerPage(res, 400, `<h1>Connexion impossible</h1><p class="texte">${echapper(d.erreur)}</p>`);
  if (d.refus) { res.setHeader('Location', d.retour({ error: d.refus })); return res.status(302).end(); }
  const hote = new URL(p.redirect_uri).host;
  const caches = CHAMPS.filter((c) => p[c]).map((c) => `<input type="hidden" name="${c}" value="${echapper(p[c])}">`).join('');
  return envoyerPage(res, message ? 401 : 200, `
    <p class="sur">Nelly Coiffure · Connexion d’un assistant</p>
    <h1><strong>${echapper(d.client.n)}</strong> demande à gérer votre site</h1>
    <p class="texte">Une fois autorisé, l’assistant pourra, quand vous le lui demandez :</p>
    <ul>
      <li>lire vos horaires, vos coiffures et tarifs, vos annonces ;</li>
      <li>consulter les statistiques de visite ;</li>
      <li>modifier les horaires, les tarifs et les annonces — <b>toujours après votre accord</b>, et chaque publication reste annulable dans l’espace de gestion (Historique).</li>
    </ul>
    <p class="note">Il ne peut ni changer le mot de passe, ni supprimer de photos. Retour vers : <b>${echapper(hote)}</b></p>
    <form method="post" action="/oauth/autoriser">
      ${caches}
      <label for="mdp">Mot de passe de l’espace de gestion</label>
      <div class="champ"><input id="mdp" name="mot_de_passe" type="password" autocomplete="current-password" required autofocus>
        <button type="button" class="voir" onclick="const m=document.getElementById('mdp');m.type=m.type==='password'?'text':'password';this.textContent=m.type==='password'?'Afficher':'Masquer'">Afficher</button></div>
      ${message ? `<p class="erreur">${echapper(message)}</p>` : ''}
      <div class="actions">
        <button type="submit" name="decision" value="refuser" class="secondaire" formnovalidate>Refuser</button>
        <button type="submit" name="decision" value="autoriser" class="principal">Autoriser</button>
      </div>
    </form>
    <p class="note">Pour retirer l’accès plus tard : espace de gestion → Mon compte → « Déconnecter tous les autres appareils ».</p>`);
}

function envoyerPage(res, statut, contenu) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src 'self'; form-action 'self' https: http://localhost:*; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(statut).end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autoriser un assistant · Nelly Coiffure</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#F6EDE4;color:#2B1A12;font:15px/1.6 Poppins,system-ui,sans-serif}
main{width:100%;max-width:460px;background:#fff;border:1px solid #E7D8CA;border-radius:24px;padding:28px 24px;box-shadow:0 24px 50px -36px rgba(60,30,15,.55)}
.logo{display:block;height:46px;margin:0 auto 18px}.sur{margin:0 0 6px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#B0714A;text-align:center}
h1{font:400 1.55rem/1.25 Fraunces,Georgia,serif;margin:0 0 14px;text-align:center}h1 strong{font-weight:500}
.texte{margin:0 0 6px}ul{margin:0 0 14px;padding-left:20px}li{margin:4px 0}.note{font-size:.8rem;color:#7A6656;margin:0 0 16px}
label{display:block;font-weight:500;margin:6px 0 6px}.champ{display:flex;gap:8px}input[type=password],input[type=text]{flex:1;min-width:0;padding:12px 14px;border:1px solid #D9C6B5;border-radius:12px;font:inherit}
.voir{border:0;background:#F1E4D7;border-radius:12px;padding:0 14px;font:inherit;font-size:.82rem;cursor:pointer}
.actions{display:flex;gap:10px;margin:18px 0}.actions button{flex:1;padding:13px;border-radius:99px;font:inherit;font-weight:600;cursor:pointer}
.principal{border:0;background:#2B1A12;color:#F6EDE4}.secondaire{border:1px solid #D9C6B5;background:#fff;color:#2B1A12}
.erreur{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#FBE9E7;color:#9B2C1F;font-size:.85rem}
</style></head><body><main><img class="logo" src="/img/marque/logo.webp" alt="Nelly Coiffure">${contenu}</main></body></html>`);
}

// Essais de mot de passe limités par adresse : 8 par quart d'heure (base Redis si disponible, sinon par instance)
async function tropDEssais(ip) {
  if (statsActives()) {
    try {
      const [n] = await redis([['INCR', `oauth:essais:${ip}`], ['EXPIRE', `oauth:essais:${ip}`, 900]]);
      return Number(n) > 8;
    } catch { /* base indisponible : limite par instance */ }
  }
  const e = essais.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - e.t > 15 * 60 * 1000) { e.n = 0; e.t = Date.now(); }
  e.n += 1;
  essais.set(ip, e);
  return e.n > 8;
}

async function autoriser(req, res) {
  const p = corps(req);
  const d = demande(p);
  if (d.erreur) return envoyerPage(res, 400, `<h1>Connexion impossible</h1><p class="texte">${echapper(d.erreur)}</p>`);
  const rediriger = (url) => { res.setHeader('Location', url); return res.status(302).end(); };
  if (d.refus) return rediriger(d.retour({ error: d.refus }));
  if (p.decision !== 'autoriser') return rediriger(d.retour({ error: 'access_denied', error_description: 'Accès refusé par la propriétaire du site.' }));

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  if (await tropDEssais(ip)) return pageAutorisation(req, res, p, 'Trop d’essais. Réessayez dans 15 minutes.');
  if (!motDePasseValide(p.mot_de_passe || '')) {
    await pause(1200);
    return pageAutorisation(req, res, p, 'Mot de passe incorrect.');
  }
  const code = signerJeton('code', { c: p.client_id.slice(-24), r: p.redirect_uri, ch: p.code_challenge, k: nouveauNonce() }, DUREE_CODE);
  return rediriger(d.retour({ code }));
}

// Un code ne sert qu'une fois (base Redis si disponible ; sinon il expire de toute façon en 5 minutes)
async function premiereUtilisation(nonce) {
  if (!statsActives()) return true;
  try {
    const [r] = await redis([['SET', `oauth:code:${nonce}`, '1', 'NX', 'EX', DUREE_CODE * 2]]);
    return r === 'OK';
  } catch { return true; }
}

async function delivrerJetons(req, res) {
  const p = corps(req);
  const jetons = () => ({
    access_token: signerJeton('acces', { k: nouveauNonce() }, DUREE_ACCES),
    token_type: 'Bearer',
    expires_in: DUREE_ACCES,
    refresh_token: signerJeton('renouvellement', { k: nouveauNonce() }, DUREE_RENOUVELLEMENT),
    scope: 'site',
  });
  if (p.grant_type === 'authorization_code') {
    const code = lireJeton('code', p.code);
    if (!code || code.r !== p.redirect_uri || (p.client_id && code.c !== String(p.client_id).slice(-24))) {
      return erreurOAuth(res, 400, 'invalid_grant', 'Code invalide ou expiré.');
    }
    if (!pkceValide(p.code_verifier, code.ch)) return erreurOAuth(res, 400, 'invalid_grant', 'Vérification PKCE échouée.');
    if (!(await premiereUtilisation(code.k))) return erreurOAuth(res, 400, 'invalid_grant', 'Code déjà utilisé.');
    return envoyerJson(res, 200, jetons());
  }
  if (p.grant_type === 'refresh_token') {
    const r = lireJeton('renouvellement', p.refresh_token);
    if (!r || r.emis < await revoqueesAvant()) return erreurOAuth(res, 400, 'invalid_grant', 'Accès expiré ou retiré : reconnectez l’assistant.');
    return envoyerJson(res, 200, jetons());
  }
  return erreurOAuth(res, 400, 'unsupported_grant_type', 'Type de demande non pris en charge.');
}
