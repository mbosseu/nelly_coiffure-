import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Jetons du connecteur IA (Claude, Le Chat…), selon OAuth 2.1 : inscription automatique de l'assistant,
// autorisation par le mot de passe de l'espace de gestion, code à usage unique protégé par PKCE,
// jeton d'accès (1 heure) et jeton de renouvellement (90 jours).
// Rien n'est stocké : chaque jeton est signé avec ADMIN_SECRET et porte son type, sa date de création
// et sa date d'expiration. « Déconnecter tous les appareils » révoque aussi les assistants connectés.

export const DUREE_ACCES = 3600;
export const DUREE_RENOUVELLEMENT = 90 * 24 * 3600;
export const DUREE_CODE = 300;

const b64 = (x) => Buffer.from(x).toString('base64url');
const signature = (type, charge) => createHmac('sha256', process.env.ADMIN_SECRET).update(`mcp:${type}:${charge}`).digest('base64url');
const egaux = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};

/** Jeton signé de type donné ; `duree` en secondes (0 : sans expiration) */
export function signerJeton(type, donnees, duree = 0) {
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = b64(JSON.stringify({ ...donnees, emis: maintenant, ...(duree ? { exp: maintenant + duree } : {}) }));
  return `${charge}.${signature(type, charge)}`;
}

/** Contenu du jeton s'il est authentique, du bon type et non expiré, sinon null */
export function lireJeton(type, jeton) {
  if (!process.env.ADMIN_SECRET || typeof jeton !== 'string' || jeton.length > 4000) return null;
  const [charge, sig, reste] = jeton.split('.');
  if (!charge || !sig || reste !== undefined || !egaux(sig, signature(type, charge))) return null;
  let d;
  try { d = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')); } catch { return null; }
  if (!d || typeof d !== 'object' || (d.exp && d.exp < Date.now() / 1000)) return null;
  return d;
}

export const nouveauNonce = () => randomBytes(12).toString('base64url');

// PKCE (S256) : le code ne sert qu'à l'assistant qui détient le secret ayant produit le défi
export const pkceValide = (verifieur, defi) => typeof verifieur === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(verifieur)
  && egaux(createHash('sha256').update(verifieur).digest('base64url'), defi);

// Adresses de retour acceptées à l'inscription : https, ou http sur le poste (essais)
export const adresseRetourValide = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname));
  } catch { return false; }
};

// Adresse publique du site d'après la requête (www.nellycoiffure.fr en ligne, localhost en essai)
export function origine(req) {
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || 'www.nellycoiffure.fr').split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hote);
  return `${local ? 'http' : 'https'}://${hote}`;
}
