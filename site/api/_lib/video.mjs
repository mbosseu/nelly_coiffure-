import { creerBlob, lireBlob } from './github.mjs';

// Envoi de gros fichiers : une requête Vercel est limitée à 4,5 Mo. Le navigateur dépose donc la vidéo par morceaux
// (contenus Git, invisibles tant qu'ils ne sont pas publiés), puis le serveur les réunit en un seul fichier.

export const SHA = /^[0-9a-f]{40}$/;
export const CHEMIN_VIDEO = /^video\/[a-z0-9-]+\.mp4$/;
export const MAX_VIDEO = 45 * 1024 * 1024;
const MAX_MORCEAU_BASE64 = 3.8 * 1000 * 1000;

const refus = (message) => Object.assign(new Error(message), { invalide: true });

export async function stockerMorceau(base64) {
  if (typeof base64 !== 'string' || !base64 || base64.length > MAX_MORCEAU_BASE64) throw refus('Morceau invalide.');
  return creerBlob(base64);
}

// Réunit les morceaux et vérifie qu'il s'agit bien d'une vidéo MP4 ; renvoie son empreinte, prête à être publiée
export async function assemblerVideo(morceaux) {
  if (!Array.isArray(morceaux) || !morceaux.length || morceaux.length > 20 || !morceaux.every((s) => SHA.test(s))) throw refus('Envoi incomplet. Réessayez.');
  const parties = await Promise.all(morceaux.map(lireBlob));
  const octets = Buffer.concat(parties);
  if (octets.length > MAX_VIDEO) throw refus('Cette vidéo est trop lourde.');
  if (octets.subarray(4, 8).toString('latin1') !== 'ftyp') throw refus('Ce fichier n’est pas une vidéo lisible.');
  return { sha: await creerBlob(octets.toString('base64')), octets: octets.length };
}
