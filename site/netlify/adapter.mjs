// Fait tourner les fonctions écrites pour Vercel (api/*.mjs, signature (req, res))
// sur Netlify Functions (signature (Request, context) => Response), sans toucher à leur code.
// Reproduit ce que Vercel fournissait : req.query, req.body déjà décodé, req.headers,
// res.status().json()/end()/send(), res.setHeader, et l'en-tête de ville x-vercel-ip-city.

async function lireCorps(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const texte = await request.text();
  if (!texte) return undefined;
  const type = request.headers.get('content-type') || '';
  if (/application\/json/i.test(type)) {
    try { return JSON.parse(texte); } catch { return texte; }
  }
  if (/application\/x-www-form-urlencoded/i.test(type)) {
    return Object.fromEntries(new URLSearchParams(texte));
  }
  return texte;
}

function creerReponse() {
  const entetes = new Headers();
  const etat = { statut: 200, corps: null, fini: false };
  const finir = (corps) => {
    if (etat.fini) return res;
    etat.fini = true;
    etat.corps = corps ?? null;
    return res;
  };
  const res = {
    get statusCode() { return etat.statut; },
    set statusCode(v) { etat.statut = v; },
    get headersSent() { return etat.fini; },
    setHeader(nom, valeur) {
      entetes.delete(nom);
      for (const v of [].concat(valeur)) entetes.append(nom, String(v));
      return res;
    },
    getHeader(nom) { return entetes.get(nom); },
    removeHeader(nom) { entetes.delete(nom); return res; },
    status(code) { etat.statut = code; return res; },
    json(donnees) {
      if (!entetes.has('content-type')) entetes.set('content-type', 'application/json; charset=utf-8');
      return finir(JSON.stringify(donnees));
    },
    send(corps) {
      if (corps !== null && typeof corps === 'object' && !(corps instanceof Uint8Array)) return res.json(corps);
      return finir(corps);
    },
    end(corps) { return finir(corps); },
    redirect(a, b) {
      const [code, url] = typeof a === 'number' ? [a, b] : [307, a];
      etat.statut = code;
      entetes.set('location', url);
      return finir(null);
    },
  };
  return { res, etat, entetes };
}

// etapes : pour une fonction joignable par plusieurs chemins, donne les paramètres
// que les « rewrites » de vercel.json ajoutaient (ex. /oauth/jeton -> ?etape=jeton).
export function adapter(handler, { etapes = [] } = {}) {
  return async (request, context) => {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams);
    for (const { chemin, params } of etapes) {
      if (chemin.test(url.pathname)) { for (const [k, v] of Object.entries(params)) if (!(k in query)) query[k] = v; break; }
    }

    const headers = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    if (context?.ip && !headers['x-forwarded-for']) headers['x-forwarded-for'] = context.ip;
    if (context?.geo?.city && !headers['x-vercel-ip-city']) headers['x-vercel-ip-city'] = encodeURIComponent(context.geo.city);
    if (!headers['x-forwarded-host']) headers['x-forwarded-host'] = url.host;

    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      query,
      cookies: Object.fromEntries(String(headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => {
        const i = c.indexOf('=');
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
      })),
      body: await lireCorps(request),
    };

    const { res, etat, entetes } = creerReponse();
    await handler(req, res);
    if (!etat.fini) res.end();
    const sansCorps = [204, 304].includes(etat.statut) || request.method === 'HEAD';
    return new Response(sansCorps ? null : etat.corps, { status: etat.statut, headers: entetes });
  };
}
