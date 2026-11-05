import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Essai de l'espace de gestion (/admin) sur le poste, sans toucher au vrai site ni à GitHub.
// Le dépôt est copié dans un dossier temporaire et l'API GitHub est simulée : chaque « publication »
// réécrit cette copie, que le serveur affiche ensuite. Mot de passe d'essai : essai
// Usage : node outils/essai-gestion.mjs [port, par défaut 5174]

const PORT = Number(process.argv[2] || 5174);
const RACINE = path.resolve(import.meta.dirname, '..');
const DEPOT = path.join(os.tmpdir(), 'nelly-gestion-essai');

await rm(DEPOT, { recursive: true, force: true });
await mkdir(DEPOT, { recursive: true });
await cp(path.join(RACINE, 'site'), path.join(DEPOT, 'site'), { recursive: true });
await cp(path.join(RACINE, 'contenu'), path.join(DEPOT, 'contenu'), { recursive: true });

Object.assign(process.env, { ADMIN_PASSWORD: 'essai', ADMIN_SECRET: 'secret-essai', GITHUB_TOKEN: 'faux', GITHUB_REPO: 'essai/nelly', GITHUB_BRANCH: 'main', KV_REST_API_URL: 'http://redis.essai', KV_REST_API_TOKEN: 'faux' });

// --- Fausse base Redis (statistiques), en mémoire : seulement les commandes utilisées par api/_lib/stats.mjs ---
const base = new Map();
const redisCommande = ([nom, cle, ...a]) => {
  const v = base.get(cle);
  switch (nom.toUpperCase()) {
    case 'HINCRBY': { const h = v || new Map(); h.set(a[0], (Number(h.get(a[0])) || 0) + Number(a[1])); base.set(cle, h); return h.get(a[0]); }
    case 'HGETALL': return v ? [...v.entries()].flatMap(([c, x]) => [c, String(x)]) : [];
    case 'PFADD': { const s = v || new Set(); a.forEach((x) => s.add(x)); base.set(cle, s); return 1; }
    case 'PFCOUNT': return v ? v.size : 0;
    case 'EXPIRE': return 1;
    case 'SET': { if (a.includes('NX') && base.has(cle)) return null; base.set(cle, a[0]); return 'OK'; }
    case 'GET': return v ?? null;
    case 'RPUSH': { const l = v || []; l.push(...a); base.set(cle, l); return l.length; }
    case 'LPUSH': { const l = v || []; l.unshift(...a.reverse()); base.set(cle, l); return l.length; }
    case 'LTRIM': { if (v) base.set(cle, v.slice(Number(a[0]), Number(a[1]) + 1)); return 'OK'; }
    case 'LRANGE': { const l = v || []; const fin = Number(a[1]) < 0 ? l.length : Number(a[1]) + 1; return l.slice(Number(a[0]), fin); }
    case 'ZADD': { const z = v || new Map(); z.set(a[1], Number(a[0])); base.set(cle, z); return 1; }
    case 'ZREMRANGEBYSCORE': { if (v) for (const [m, s] of v) if (s >= Number(a[0]) && s <= Number(a[1])) v.delete(m); return 1; }
    case 'ZCOUNT': { const max = a[1] === '+inf' ? Infinity : Number(a[1]); return v ? [...v.values()].filter((s) => s >= Number(a[0]) && s <= max).length : 0; }
    case 'DEL': return base.delete(cle) ? 1 : 0;
    case 'INCR': { const n = (Number(v) || 0) + 1; base.set(cle, String(n)); return n; }
    case 'ZRANGEBYSCORE': { const max = a[1] === '+inf' ? Infinity : Number(a[1]); return v ? [...v.entries()].filter(([, s]) => s >= Number(a[0]) && s <= max).sort((x, y) => x[1] - y[1]).map(([m]) => m) : []; }
    case 'HSET': { const h = v || new Map(); h.set(a[0], a[1]); base.set(cle, h); return 1; }
    case 'HMGET': return a.map((c) => (v && v.has(c) ? String(v.get(c)) : null));
    default: return { erreur: `commande non simulée : ${nom}` };
  }
};

// --- Faux GitHub --------------------------------------------------------------------
const sha1 = (b) => createHash('sha1').update(b).digest('hex');
const blobSha = (buf) => sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]));
const blobs = new Map();
const arbres = new Map();
const commits = [{ sha: sha1('depart'), tree: sha1('arbre-depart'), message: 'Version de départ', date: new Date().toISOString(), entrees: [] }];
const reponse = (donnees, statut = 200) => new Response(JSON.stringify(donnees), { status: statut, headers: { 'Content-Type': 'application/json' } });

const fetchReel = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const u = new URL(url);
  if (u.hostname === 'redis.essai') return reponse(JSON.parse(options.body).map((c) => ({ result: redisCommande(c) })));
  if (u.hostname === 'api.indexnow.org') { console.log('IndexNow (simulé) :', JSON.parse(options.body).urlList.length, 'pages'); return new Response(null, { status: 202 }); }
  if (u.hostname !== 'api.github.com') return fetchReel(url, options);
  const m = options.method || 'GET';
  const p = u.pathname.replace('/repos/essai/nelly', '');
  const corps = options.body ? JSON.parse(options.body) : null;
  if (m === 'GET' && p.startsWith('/contents/')) {
    const chemin = decodeURIComponent(p.slice('/contents/'.length));
    const ref = u.searchParams.get('ref');
    const ancien = commits.find((c) => c.sha === ref && c.contenu && chemin === 'contenu/site.json');
    if (ancien) { const b = Buffer.from(ancien.contenu); return reponse({ content: b.toString('base64'), encoding: 'base64', sha: blobSha(b) }); }
    const f = path.join(DEPOT, chemin);
    try {
      if ((await stat(f)).isDirectory()) return reponse((await readdir(f)).map((name) => ({ name })));
      const b = await readFile(f);
      return reponse({ content: b.toString('base64'), encoding: 'base64', sha: blobSha(b) });
    } catch { return reponse({ message: 'Not Found' }, 404); }
  }
  if (m === 'GET' && p === '/git/ref/heads/main') return reponse({ object: { sha: commits.at(-1).sha } });
  if (m === 'GET' && p.startsWith('/git/commits/')) { const c = commits.find((x) => x.sha === p.split('/').pop()); return reponse({ sha: c.sha, tree: { sha: c.tree } }); }
  if (m === 'POST' && p === '/git/blobs') { const b = Buffer.from(corps.content, corps.encoding === 'base64' ? 'base64' : 'utf8'); const s = blobSha(b); blobs.set(s, b); return reponse({ sha: s }); }
  if (m === 'GET' && p.startsWith('/git/blobs/')) { const b = blobs.get(p.split('/').pop()); return b ? reponse({ content: b.toString('base64'), encoding: 'base64' }) : reponse({ message: 'Not Found' }, 404); }
  if (m === 'POST' && p === '/git/trees') { const s = sha1(JSON.stringify(corps) + Math.random()); arbres.set(s, corps.tree); return reponse({ sha: s }); }
  if (m === 'POST' && p === '/git/commits') { const s = sha1(corps.message + Math.random()); commits.push({ sha: s, tree: corps.tree, message: corps.message, date: new Date().toISOString(), enAttente: true }); return reponse({ sha: s }); }
  if (m === 'PATCH' && p === '/git/refs/heads/main') {
    const c = commits.find((x) => x.sha === corps.sha);
    for (const e of arbres.get(c.tree)) {
      const f = path.join(DEPOT, e.path);
      if (e.sha === null) { await rm(f, { force: true }); console.log('  supprimé', e.path); continue; }
      await mkdir(path.dirname(f), { recursive: true });
      await writeFile(f, blobs.get(e.sha));
      if (e.path === 'contenu/site.json') c.contenu = blobs.get(e.sha).toString('utf8');
    }
    delete c.enAttente;
    console.log(`Publication simulée : ${c.message} (${arbres.get(c.tree).length} fichiers)`);
    return reponse({ object: { sha: c.sha } });
  }
  if (m === 'GET' && p === '/commits') return reponse(commits.filter((c) => !c.enAttente).slice().reverse().map((c) => ({ sha: c.sha, commit: { message: c.message, author: { date: c.date } } })));
  return reponse({ message: `Non simulé : ${m} ${p}` }, 501);
};

// --- Serveur : site publié (copie) + API ----------------------------------------------
const { default: handler } = await import('../site/api/admin.mjs');
const { default: handlerStats } = await import('../site/api/stats.mjs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };

const { default: handlerMcp } = await import('../site/api/mcp.mjs');
const { default: handlerOAuth } = await import('../site/api/oauth.mjs');
const { default: handlerEnvoi } = await import('../site/api/envoi.mjs');
// Réécritures de vercel.json (connexion des assistants IA)
const REECRITURES = JSON.parse(await readFile(path.join(RACINE, 'site/vercel.json'), 'utf8')).rewrites || [];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const reecriture = REECRITURES.find((r) => new RegExp(`^${r.source.replace(/\./g, '\\.').replace(/\/:chemin\*$/, '(/.*)?')}$`).test(url.pathname));
  if (reecriture) {
    const d = new URL(reecriture.destination, 'http://x');
    url.pathname = d.pathname;
    for (const [k, v] of d.searchParams) url.searchParams.set(k, v);
  }
  if (url.pathname === '/api/mcp' || url.pathname === '/api/oauth' || url.pathname === '/api/envoi') {
    let corps = '';
    for await (const morceau of req) corps += morceau;
    req.query = Object.fromEntries(url.searchParams);
    req.body = corps;
    res.status = (s) => { res.statusCode = s; return res; };
    return { '/api/mcp': handlerMcp, '/api/oauth': handlerOAuth, '/api/envoi': handlerEnvoi }[url.pathname](req, res);
  }
  if (url.pathname === '/api/admin' || url.pathname === '/api/stats') {
    let corps = '';
    for await (const morceau of req) corps += morceau;
    req.query = Object.fromEntries(url.searchParams);
    req.body = url.pathname === '/api/stats' ? corps : (corps ? JSON.parse(corps) : undefined);
    res.status = (s) => { res.statusCode = s; return res; };
    res.json = (d) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d)); };
    return url.pathname === '/api/stats' ? handlerStats(req, res) : handler(req, res);
  }
  const chemin = decodeURIComponent(url.pathname);
  const racine = path.join(DEPOT, 'site');
  // L'espace de gestion est toujours servi depuis le dossier de travail (pour tester ses modifications sans relancer)
  const base = chemin.startsWith('/admin') ? path.join(RACINE, 'site') : racine;
  const f = path.join(base, chemin.endsWith('/') ? `${chemin}index.html` : chemin);
  try {
    const b = await readFile(f);
    const plage = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (plage && f.endsWith('.mp4')) {
      const debut = Number(plage[1]); const fin = plage[2] ? Math.min(Number(plage[2]), b.length - 1) : b.length - 1;
      return res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${debut}-${fin}/${b.length}`, 'Content-Length': fin - debut + 1 }).end(b.subarray(debut, fin + 1));
    }
    // Date de modification : permet de tester l'actualisation automatique de l'application
    const modif = (await stat(f)).mtime.toUTCString();
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Last-Modified': modif }).end(req.method === 'HEAD' ? undefined : b);
  } catch {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(await readFile(path.join(racine, '404.html')).catch(() => 'Introuvable'));
  }
}).listen(PORT, () => console.log(`Espace de gestion d'essai : http://localhost:${PORT}/admin/ (mot de passe : essai)\nCopie du site : ${DEPOT}`));
