import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

// Connexion à l'espace de gestion : un seul mot de passe (variable Vercel ADMIN_PASSWORD),
// puis un jeton signé (ADMIN_SECRET) gardé dans un cookie HttpOnly pendant 30 jours.

const NOM = 'nc_session';
const DUREE = 30 * 24 * 3600;

const egaux = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};
const signer = (donnees) => createHmac('sha256', process.env.ADMIN_SECRET).update(donnees).digest('base64url');

export const motDePasseValide = (essai) => Boolean(process.env.ADMIN_PASSWORD) && egaux(essai, process.env.ADMIN_PASSWORD);

export function ouvrirSession(res) {
  const expire = Math.floor(Date.now() / 1000) + DUREE;
  const jeton = `${expire}.${signer(String(expire))}`;
  res.setHeader('Set-Cookie', `${NOM}=${jeton}; Path=/api; Max-Age=${DUREE}; HttpOnly; Secure; SameSite=Strict`);
}

export function fermerSession(res) {
  res.setHeader('Set-Cookie', `${NOM}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

export function sessionValide(req) {
  if (!process.env.ADMIN_SECRET) return false;
  const cookie = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${NOM}=`));
  if (!cookie) return false;
  const [expire, signature] = cookie.slice(NOM.length + 1).split('.');
  if (!expire || !signature || Number(expire) < Date.now() / 1000) return false;
  return egaux(signature, signer(expire));
}
