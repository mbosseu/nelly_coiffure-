import { enregistrer, statsActives } from './_lib/stats.mjs';

// Reçoit les événements de visite envoyés par le site (js/main.js, via navigator.sendBeacon).
// Réponse vide et rapide ; sans base configurée, les événements sont simplement ignorés.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') return res.status(405).end();
  if (!statsActives()) return res.status(204).end();
  try {
    const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    // Plusieurs événements peuvent arriver ensemble (fin de page + contact)
    const evenements = (Array.isArray(corps) ? corps : [corps]).slice(0, 5);
    for (const e of evenements) await enregistrer(e, req);
  } catch (e) {
    console.error('stats', e.message);
  }
  return res.status(204).end();
}
