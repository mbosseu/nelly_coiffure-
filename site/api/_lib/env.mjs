// Lecture d'une variable d'environnement, en retirant les artefacts de copier-coller :
// espaces autour, et une paire de guillemets englobants (ex. une valeur copiée depuis la
// vue « .env.local » de Vercel arrive sous la forme CLE="valeur", guillemets inclus).
// Renvoie undefined si la variable n'existe pas, pour que les tests d'existence restent valables.
export function env(nom) {
  const brut = process.env[nom];
  if (brut == null) return brut;
  return brut.trim().replace(/^(["'])([\s\S]*)\1$/, '$2').trim();
}
