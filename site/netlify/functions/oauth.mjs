import handler from '../../api/oauth.mjs';
import { adapter } from '../adapter.mjs';

// Reprend les « rewrites » OAuth de vercel.json : chaque adresse fixe le paramètre etape.
const etapes = [
  { chemin: /^\/\.well-known\/(oauth-authorization-server|openid-configuration)(\/|$)/, params: { etape: 'serveur' } },
  { chemin: /^\/\.well-known\/oauth-protected-resource(\/|$)/, params: { etape: 'ressource' } },
  { chemin: /^\/oauth\/inscription$/, params: { etape: 'inscription' } },
  { chemin: /^\/oauth\/autoriser$/, params: { etape: 'autoriser' } },
  { chemin: /^\/oauth\/jeton$/, params: { etape: 'jeton' } },
];

export default adapter(handler, { etapes });
export const config = {
  path: [
    '/api/oauth',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/*',
    '/.well-known/openid-configuration',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/*',
    '/oauth/inscription',
    '/oauth/autoriser',
    '/oauth/jeton',
  ],
};
