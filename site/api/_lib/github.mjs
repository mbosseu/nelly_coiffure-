// Accès au dépôt GitHub du site (lecture des fichiers, publication en un seul commit).
// Variables d'environnement Vercel : GITHUB_TOKEN (jeton « fine-grained », droit Contents en écriture sur ce seul dépôt),
// GITHUB_REPO (ex. mbosseu/nelly_coiffure-), GITHUB_BRANCH (main par défaut).

const API = 'https://api.github.com';
const depot = () => process.env.GITHUB_REPO;
const branche = () => process.env.GITHUB_BRANCH || 'main';

export class ErreurGithub extends Error {
  constructor(message, statut) { super(message); this.statut = statut; }
}

async function gh(chemin, options = {}) {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nelly-coiffure-admin',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!r.ok) throw new ErreurGithub(`GitHub ${r.status} sur ${chemin} : ${(await r.text()).slice(0, 200)}`, r.status);
  return r.status === 204 ? null : r.json();
}

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

// Contenu texte d'un fichier à une version donnée (dernière version de la branche par défaut)
export async function lireTexte(chemin, ref = branche()) {
  const f = await gh(`/repos/${depot()}/contents/${enc(chemin)}?ref=${encodeURIComponent(ref)}`);
  if (f.content !== undefined && f.encoding === 'base64' && f.content !== '') return { texte: Buffer.from(f.content, 'base64').toString('utf8'), sha: f.sha };
  // Fichiers de plus de 1 Mo : passer par le blob
  const b = await gh(`/repos/${depot()}/git/blobs/${f.sha}`);
  return { texte: Buffer.from(b.content, 'base64').toString('utf8'), sha: f.sha };
}

// Noms des fichiers d'un dossier (dernière version de la branche)
export async function listerDossier(chemin) {
  const liste = await gh(`/repos/${depot()}/contents/${enc(chemin)}?ref=${encodeURIComponent(branche())}`);
  return new Set(liste.map((f) => f.name));
}

/**
 * Publie plusieurs fichiers en un seul commit sur la branche.
 * @param {Array<{chemin:string, texte?:string, base64?:string}>} fichiers
 */
export async function publier(fichiers, message) {
  for (let essai = 0; essai < 2; essai++) {
    const ref = await gh(`/repos/${depot()}/git/ref/heads/${branche()}`);
    const parent = await gh(`/repos/${depot()}/git/commits/${ref.object.sha}`);
    const arbre = [];
    for (const f of fichiers) {
      const blob = await gh(`/repos/${depot()}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(f.base64 !== undefined ? { content: f.base64, encoding: 'base64' } : { content: f.texte, encoding: 'utf-8' }),
      });
      arbre.push({ path: f.chemin, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await gh(`/repos/${depot()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: arbre }) });
    const commit = await gh(`/repos/${depot()}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parent.sha] }) });
    try {
      await gh(`/repos/${depot()}/git/refs/heads/${branche()}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
      return commit.sha;
    } catch (e) {
      // La branche a bougé entre-temps (autre publication) : on recommence une fois sur la nouvelle version
      if (e.statut !== 422 || essai === 1) throw e;
    }
  }
}

// Dernières publications du contenu (pour l'historique de l'espace de gestion)
export async function historique(chemin, nombre = 20) {
  const liste = await gh(`/repos/${depot()}/commits?sha=${encodeURIComponent(branche())}&path=${encodeURIComponent(chemin)}&per_page=${nombre}`);
  return liste.map((c) => ({ sha: c.sha, date: c.commit.author.date, message: c.commit.message.split('\n')[0] }));
}
