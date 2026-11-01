import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

// Connexion à l'espace de gestion : un seul mot de passe (variable Vercel ADMIN_PASSWORD),
// puis un jeton signé (ADMIN_SECRET) gardé dans un cookie HttpOnly pendant 30 jours.
// Le jeton porte sa date de création : « Déconnecter tous les appareils » enregistre une date
// avant laquelle aucun jeton n'est plus accepté (voir admin.mjs).

const NOM = 'nc_session';
const DUREE = 30 * 24 * 3600;

const egaux = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};
const signer = (donnees) => createHmac('sha256', process.env.ADMIN_SECRET).update(donnees).digest('base64url');

export const motDePasseValide = (essai) => Boolean(process.env.ADMIN_PASSWORD) && egaux(essai, process.env.ADMIN_PASSWORD);

export function ouvrirSession(res, emis = Math.floor(Date.now() / 1000)) {
  const expire = emis + DUREE;
  const jeton = `${emis}.${expire}.${signer(`${emis}.${expire}`)}`;
  res.setHeader('Set-Cookie', `${NOM}=${jeton}; Path=/api; Max-Age=${DUREE}; HttpOnly; Secure; SameSite=Strict`);
}

export function fermerSession(res) {
  res.setHeader('Set-Cookie', `${NOM}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

/**
 * Date de création du jeton (secondes) s'il est authentique et non expiré, sinon null.
 * Les jetons d'avant cette version (sans date de création) comptent comme créés à 0.
 */
export function sessionEmise(req) {
  if (!process.env.ADMIN_SECRET) return null;
  const cookie = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${NOM}=`));
  if (!cookie) return null;
  const parties = cookie.slice(NOM.length + 1).split('.');
  const [emis, expire, signature] = parties.length === 3 ? parties : ['0', ...parties];
  if (!expire || !signature || Number(expire) < Date.now() / 1000) return null;
  const signe = parties.length === 3 ? `${emis}.${expire}` : expire;
  return egaux(signature, signer(signe)) ? Number(emis) : null;
}
