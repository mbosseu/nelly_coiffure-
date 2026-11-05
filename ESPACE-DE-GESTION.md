# Espace de gestion de Nelly (www.nellycoiffure.fr/admin)

Une application installable sur le téléphone de Nelly pour modifier elle-même son site, sans code :

| Onglet | Ce qu'elle peut faire |
|---|---|
| **Annonces** | Créer des annonces au choix : grande section (image + texte + bouton), carte, encadré ou bandeau ; choisir les pages, les dates de début et de fin, l'image et son cadrage, le bouton et sa destination (WhatsApp, page du site, appel, autre site) |
| **Pages** | Pour chaque page : modifier tous les textes (titres, paragraphes, questions…), remplacer les images (cadre d'origine conservé, cadrage par glisser, agrandir, réduire, recentrer, retour à l'image d'origine), modifier le texte et la destination des boutons, changer l'ordre des sections, masquer / réafficher une section |
| **Coiffures** | Changer prix, nom, catégorie, description et photo ; masquer, ajouter, supprimer, réordonner une coiffure |
| **Photos** | Ajouter des réalisations depuis la galerie du téléphone (recadrage et allègement automatiques), changer leur coiffure, les retirer |
| **Infos** | Horaires jour par jour, les deux numéros de téléphone, les liens Instagram, TikTok, Facebook et Snapchat (remplacés partout sur le site) |
| **Historique** | Voir les dernières publications et revenir à une version précédente |

Le design, la mise en page et les textes de présentation restent verrouillés (version 1).

## Comment ça marche (et pourquoi le référencement n'est pas touché)

1. Nelly modifie, puis appuie sur **Publier**.
2. L'API (`site/api/admin.mjs`) régénère les pages HTML avec le même générateur que `node outils/seo.mjs` (`site/api/_lib/regenerer.mjs`) et envoie le tout en **un seul commit** sur GitHub.
3. Vercel remet le site en ligne : environ **une minute**.

Les pages restent du **HTML statique complet** : Google lit les prix, photos et horaires sans exécuter de JavaScript. Les balises, données structurées (prix, horaires, téléphone), sitemap et IndexNow sont mis à jour à chaque publication. `/admin` et `/api` sont exclus de Google (`noindex`).

- Le contenu modifiable est dans `contenu/site.json`.
- Les zones gérées sont repérées dans les pages par des commentaires `<!-- cms:… -->` et des `<span data-prix="…">`.
- Les photos retirées disparaissent du site mais leurs fichiers restent dans le dépôt, pour que l'historique puisse toujours y revenir.
- Les nouvelles photos ont un nom unique (horodaté), pour que les navigateurs ne gardent jamais une ancienne image en cache.

## Mise en service (une seule fois)

### 1. Jeton GitHub (c'est lui qui permet à l'application de publier)
1. https://github.com/settings/personal-access-tokens/new (compte propriétaire du dépôt).
2. Nom : `Espace Nelly` ; expiration : 1 an (penser à le renouveler).
3. **Repository access** : *Only select repositories* → `mbosseu/nelly_coiffure-`.
4. **Permissions** → *Repository permissions* → **Contents : Read and write** (rien d'autre).
5. Générer et copier le jeton (il ne s'affiche qu'une fois).

### 2. Variables Vercel
Projet `nelly-coiffure` → **Settings → Environment Variables** (environnement *Production*) :

| Nom | Valeur |
|---|---|
| `GITHUB_TOKEN` | le jeton de l'étape 1 |
| `GITHUB_REPO` | `mbosseu/nelly_coiffure-` |
| `GITHUB_BRANCH` | `main` |
| `ADMIN_PASSWORD` | le mot de passe de Nelly (12 caractères minimum, à lui donner de vive voix) |
| `ADMIN_SECRET` | une longue suite de caractères au hasard (au moins 32), jamais communiquée |

Puis **Deployments → … → Redeploy** pour que les variables soient prises en compte.

### 3. Installer l'application sur le téléphone de Nelly
- **Android (Chrome)** : ouvrir `https://www.nellycoiffure.fr/admin/` → menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
- **iPhone (Safari obligatoirement)** : ouvrir `https://www.nellycoiffure.fr/admin/` → bouton **Partager** → **Sur l'écran d'accueil** → Ajouter.

L'icône « Gestion Nelly » ouvre l'application en plein écran. La connexion reste active 30 jours sur le téléphone.

## Mode d'emploi pour Nelly (à lui transmettre)

- **Changer un prix** : onglet *Coiffures* → toucher la coiffure → changer le prix → *Valider* → *Publier*.
- **Ajouter des photos** : onglet *Photos* → choisir la coiffure → *Ajouter des photos* → choisir dans la galerie → *Publier*. Photos verticales, à la lumière du jour, uniquement ses réalisations et avec l'accord des clientes.
- **Annoncer une promo ou des congés** : onglet *Annonces* → *Créer une annonce* → choisir la présentation, écrire, choisir les pages (et les dates) → *Valider* → *Aperçu* → *Publier*. Pour la retirer : la toucher → décocher « Annonce active » → *Publier*.
- **Changer les horaires** : onglet *Horaires* → *Publier*.
- **Une erreur ?** Onglet *Historique* → *Revenir* sur une version précédente → *Publier*.
- Tant que rien n'est publié, les changements restent sur le téléphone (la barre orange l'indique) ; *Annuler* les efface.
- Le site se met à jour environ une minute après *Publier* : rafraîchir la page du site pour voir le résultat.

## Essayer sans risque sur le poste

```
node outils/essai-gestion.mjs
```
puis ouvrir http://localhost:5174/admin/ (mot de passe d'essai : `essai`). Le site est copié dans un dossier temporaire et GitHub est simulé : rien n'est publié pour de vrai.

## Phase 1 (1er novembre 2026)

- **Annonces** : 4 présentations aux couleurs du site, plus de bandeau imposé. Elles se placent juste après l'en-tête des pages choisies (zone `<!-- cms:promos -->`) ; le bandeau, seulement s'il est choisi, en haut de page. Dates : une annonce terminée n'est plus publiée ; une annonce programmée est dans la page mais masquée jusqu'à sa date (`js/main.js`). Images dans `site/img/annonces/`, gardées entières (cadrage par point focal et zoom, sans les déformer).
- **Réseaux sociaux** : l'adresse complète est remplacée partout ; les pseudos affichés (`data-reseau="instagram"`…) suivent chacun leur réseau.
- **Mon compte** : voir le site, installer l'application (Android), se déconnecter (le cookie de session est supprimé ; toute action privée est ensuite refusée).
- **Annuler / Rétablir** (↶ ↷) dans la barre de publication, en plus de « Tout annuler ».
- **Aperçu** : la page est générée par le même générateur que la publication, avec les images pas encore envoyées, en taille mobile, tablette ou ordinateur. Les problèmes bloquants (lien incomplet, numéro invalide…) sont signalés avant de publier.

## Pages (1er novembre 2026)

- `site/api/_lib/pages.mjs` repère dans `<main>` les sections (`data-s`), textes (`data-t`), images (`data-i`, avec l'image d'origine gardée dans `data-i-src`) et boutons (`data-b`). Les modifications sont dans `contenu/site.json` → `pages[fichier]` : `textes`, `images`, `boutons`, `ordre`, `masquees`.
- Le titre H1 (lié au référencement), les prix, les pseudos et les zones gérées par les autres onglets ne sont pas modifiables ici.
- Une image remplacée garde le cadre et les proportions d'origine (`object-fit: cover` + `aspect-ratio`), sans déformation ; les images envoyées sont dans `site/img/pages/`.
- En-tête de page fixe ; les autres sections se déplacent et se masquent.
- Annonces avec image : disposition « Image à gauche », « Image à droite » ou « Image au-dessus ».

## Phase 3 (1er novembre 2026) : nouvelles sections et couleurs

- **Ajouter une section** (onglet Pages → « Ajouter une section à cette page ») : grande section image + texte (à gauche, à droite, au-dessus), carte, encadré, grille de 2 ou 3 cartes, bande d'appel ; fond clair, sans fond ou sombre ; placée après la section de son choix ; déplaçable, masquable, supprimable. Techniquement, c'est une annonce avec `emplacement: { page, apres }`, insérée par `pages.mjs` (`data-ajout`) et retirée/replacée à chaque génération.
- **Couleurs du site** (onglet Infos) : 4 palettes chaudes accordées au design (Cuivre d'origine, Or rose, Terracotta, Bronze). Elles redéfinissent `--copper`, `--copper-light` et `--accent` dans la zone `<!-- cms:theme -->` de chaque page.
- Revenir à Cuivre et supprimer les sections ajoutées redonne exactement les pages d'origine.

## Menu et pied de page (1er novembre 2026)

- Onglet Infos → « Modifier le menu et le pied de page » : liens du menu (2 à 7, nom, page, ordre), textes du bouton « Prendre rendez-vous » et son message WhatsApp, phrase d'invitation et présentation du pied de page, colonnes de liens (jusqu'à 3 × 10, vers une page du site ou un autre site), lignes d'informations. « Revenir à l'origine » remet le site d'origine.
- Stocké dans `contenu.navigation` (absent = valeurs par défaut de `api/_lib/navigation.mjs`, qui reproduisent le site d'origine) ; appliqué à toutes les pages par `appliquerNavigation`.
- Logo (onglet Infos → « Logo et image de fond ») : l'image choisie est recadrée au plus près, son fond uni est retiré (option), et une version claire est créée pour le pied de page (parties foncées → crème, comme `outils/logo-clair.mjs`). Fichiers `img/marque/logo-<n>.png` et `-clair.png`, référencés dans `contenu.marque.logo` ; remplacent le logo de l'en-tête, du pied de page, de l'écran d'ouverture (zone `cms:theme`) et des données Google. Les icônes de l'application et du navigateur (favicon) ne changent pas.
- Disposition des sections d'origine à deux colonnes (onglet Pages → fiche de la section → « Disposition ») : en-têtes des pages À propos, Coiffures et Réalisations, et sur l'accueil « L'univers », « Réalisations », « Chez moi ou chez vous » ; « Mon histoire » sur À propos. « Image et texte inversés » ajoute `data-inverse="1"` à la section (`contenu.pages[f].inversees`) ; les règles sont dans `style.css` (fin du fichier), sur ordinateur seulement. Rendu vérifié par captures à 1440 px.
- Image de fond de la bande « Prendre rendez-vous » : `contenu.fonds.cta` (`img/pages/…`, .jpg et -sm.jpg), appliquée par la zone `cms:theme`.
- Réseaux : YouTube ajouté ; seul Instagram est obligatoire, un réseau laissé vide disparaît du pied de page et de la liste « Me suivre » de Contact (`<!-- cms:reseaux -->`).

## Test de simplicité avec Nelly (scénario 7, à faire avec elle)

Sans lui expliquer l'application, lui demander, sur son téléphone :
1. Changer le titre d'une section de l'accueil.
2. Remplacer la photo de la section « Plus qu'une coiffure… » et la recadrer.
3. Faire mener un bouton vers WhatsApp.
4. Créer une annonce « Congés » sur la page Contact.
5. Masquer puis réafficher une section.
6. Regarder l'aperçu sur mobile, puis publier.
Noter chaque hésitation (où elle cherche, ce qu'elle ne comprend pas) : ce sont les points à simplifier.

## Éditeur visuel et accompagnement (1er novembre 2026)

Suite au retour de Nelly (manque de visibilité, interface difficile à prendre en main) :

- **« Mes pages » est un éditeur visuel** : la page s'affiche telle qu'elle sera publiée (même générateur, aperçu serveur) dans un cadre, en version Téléphone ou Ordinateur. On touche un texte entouré de pointillés pour l'écrire sur place (✦ met un mot en couleur), une photo ou un bouton pour ouvrir sa fiche, le fond d'une section pour une barre d'outils (monter, descendre, glisser, masquer, inverser, tout modifier). Les éléments gérés ailleurs (prix, photos de réalisations, annonces, menu…) affichent un message avec un raccourci vers le bon onglet.
- **« ＋ Ajouter une section ici »** entre chaque section : 5 modèles avec texte d'exemple (photo et texte, petite carte, texte seul, trois points forts, bande « Réservez »). Le texte d'exemple se remplace sur place ; la publication est refusée tant qu'il en reste. Les sections ajoutées portent `data-champ` sur leurs textes (sans effet pour les visiteurs).
- **Plan de la page** : liste des sections à réordonner par glisser-déposer (poignée ⠿).
- **Accueil « Que voulez-vous faire ? »** à l'ouverture (7 tâches courantes), **visite guidée** au premier lancement et depuis Mon compte, aide de l'éditeur (bouton « Aide »), messages brefs après chaque action.
- Le code est dans `admin/admin.js` (section « Éditeur visuel ») ; les styles propres à l'éditeur sont injectés dans le cadre et jamais publiés.

## Statistiques de visite (2 novembre 2026)

Onglet « Statistiques » de l'espace de gestion (et tuile « Statistiques de visite » de l'accueil) : visiteurs, visites, pages vues, WhatsApp ouverts et appels lancés (un clic n'est compté que si la page passe au second plan dans les 5 secondes ; l'envoi du message n'est pas mesurable, il se passe dans WhatsApp), temps passé, taux de départ après une page, courbe par jour, provenance (Google, Instagram, Facebook, TikTok, accès direct…), pages les plus vues, pages d'où partent les contacts, appareils, villes, heures d'affluence, pages d'arrivée et de départ, chemins fréquents, et le parcours détaillé des dernières visites. « Personnes sur le site en ce moment » (5 dernières minutes).

**Fonctionnement, sans cookie et anonyme** (exempté de consentement selon la CNIL) :
- `js/main.js` envoie de petits événements à `/api/stats` (`navigator.sendBeacon`) : page vue, fin de page (temps visible, défilement), clic de contact. Un numéro de visite aléatoire vit dans `sessionStorage` (disparaît à la fermeture de l'onglet).
- `api/_lib/stats.mjs` compte par jour dans une base Redis. Une personne est reconnue le temps d'une journée par une empreinte (IP + navigateur + sel du jour, sel effacé après 2 jours) ; l'adresse IP n'est jamais enregistrée. Robots ignorés. Compteurs gardés 13 mois, parcours détaillés 3 mois.
- Les visites de Nelly ne sont pas comptées : la connexion à l'espace de gestion pose `nc_stats_off` sur l'appareil. La page Confidentialité explique la mesure et propose un bouton pour la refuser.
- Lecture par l'action `stats` de `api/admin.mjs` (réservée à la session de Nelly).

**Mise en service (une seule fois)** : Vercel → projet du site → onglet **Storage** → **Create Database** → **Upstash for Redis** (offre gratuite) → la relier au projet (environnements Production et Preview). Vercel ajoute seul les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, les deux sont reconnues), puis **redéployer**. Sans base, le site fonctionne normalement et l'onglet indique que les statistiques ne sont pas encore activées. L'offre gratuite (500 000 commandes par mois) couvre environ 40 000 pages vues par mois.

**Essai local** : `outils/essai-gestion.mjs` simule la base Redis en mémoire ; sur `localhost`, la mesure ne s'active que si `localStorage.nc_stats_essai = '1'`.

**En direct** : tant qu'une page est affichée, `js/main.js` envoie un signal de présence toutes les 30 s (30 min au plus) ; une personne compte « en ce moment » pendant 90 s après son dernier signal, avec la page qu'elle regarde (`lp`). L'onglet Statistiques interroge toutes les 10 s l'action légère `direct` (personnes présentes, pages regardées, chiffres du jour) et recharge le tableau complet dès qu'un chiffre du jour change. Sous le bandeau, « Les compter pour essayer » fait compter les visites de l'appareil connecté (`nc_stats_compter`), pratique pour vérifier que tout fonctionne.

**En service depuis le 2 novembre 2026** : base `upstash-kv-camel-curtain` (offre gratuite, région Francfort), reliée au projet `nelly-coiffure`.

## Actualisation automatique de l'application

Toutes les minutes, et dès qu'on revient sur l'application (téléphone déverrouillé, onglet rouvert, retour du réseau) :
- **Nouvelle version de l'application** (empreintes `ETag` de `/admin/`, `admin.js`, `admin.css`) : la page se recharge seule et revient sur le même onglet (« Application mise à jour. »).
- **Contenu publié depuis un autre appareil** (version de `contenu/site.json`, contrôlée au plus toutes les 2 minutes) : le contenu affiché est remplacé (« Contenu actualisé… »).
- **Statistiques** : les chiffres se mettent à jour pendant que l'onglet est ouvert.

Sécurités : rien n'est rechargé tant qu'une modification n'est pas publiée (un message prévient que la nouvelle version s'installera après publication), qu'une fenêtre est ouverte ou qu'un texte est en cours de saisie. En dehors d'un retour sur l'application, il faut aussi 20 secondes sans toucher l'écran, et jamais pendant l'édition dans « Mes pages ».

## Connecteur IA (Claude, Le Chat) — protocole MCP

Nelly peut gérer le site en parlant à un assistant IA : « je suis en congé du 20 au 27 décembre, mets une annonce », « passe les knotless à 65 € », « combien de visites cette semaine ? ». Gratuit avec **Claude** (offre gratuite : 1 connecteur personnalisé) et **Le Chat** de Mistral (offre gratuite). ChatGPT réserve les connecteurs personnalisés à ses offres Business/Enterprise.

**Adresse du connecteur** : `https://www.nellycoiffure.fr/api/mcp`

**Brancher l'assistant (une seule fois, sur ordinateur de préférence)** :
- Claude (claude.ai) : Paramètres → Connecteurs → « Ajouter un connecteur personnalisé » → nom « Nelly Coiffure », adresse ci-dessus → Ajouter, puis « Se connecter ».
- Le Chat (chat.mistral.ai) : menu Connecteurs → « + Ajouter un connecteur » → onglet « Connecteur MCP personnalisé » → adresse ci-dessus (authentification détectée : OAuth) → Connecter.
- Une page aux couleurs du site s'ouvre : « Claude demande à gérer votre site ». Mot de passe de l'espace de gestion → **Autoriser**. Le connecteur fonctionne ensuite aussi dans l'application mobile de l'assistant.

**Outils proposés à l'assistant** (`site/api/mcp.mjs`, logique dans `site/api/_lib/outils-ia.mjs`) :
- Lecture : `voir_site`, `voir_page`, `voir_photos`, `statistiques`, `historique`.
- Contenu : `modifier_horaires`, `modifier_coordonnees`, `modifier_coiffure`, `ajouter_coiffure`, `supprimer_coiffure`, `modifier_galerie`, `ajouter_annonce`, `modifier_annonce`, `supprimer_annonce`, `modifier_page`, `modifier_menu`, `modifier_style`, `revenir_version`.
- Photos : `preparer_envoi_photo` (voir ci-dessous) pour une nouvelle photo ; l'assistant réutilise aussi les photos déjà en ligne. Cadrage des photos d'annonces, de sections et de pages par le paramètre `cadrage` (position : haut, bas, gauche, droite, coins ou centre ; réglage fin x / y ; zoom de 1 à 2,5, comme dans l'espace de gestion). Les photos de coiffures et de la galerie sont déjà recadrées en portrait à l'envoi. Le cadrage au doigt, le mot de passe et les réglages du compte restent dans l'espace de gestion.

**Nouvelle photo via l'assistant** (`site/api/envoi.mjs`) : un assistant ne peut pas transmettre de fichier. `preparer_envoi_photo` (usage : réalisation, annonce ou page) donne donc un lien `/envoi?j=…` à usage unique, valable 20 minutes, et l'emplacement prévu de la photo. Nelly ouvre le lien sur son téléphone et choisit la photo : elle est redimensionnée dans le navigateur comme dans l'espace de gestion (réalisation recadrée en portrait 1000×1250 et 500×625 ; annonce ou page entière, 1600 et 800 px au plus), puis enregistrée dans le dépôt (commit « photo envoyée pour l'assistant IA ») sans être affichée. L'assistant l'utilise ensuite avec l'outil voulu, après aperçu et accord. Jeton signé avec `ADMIN_SECRET`, usage unique vérifié dans la base Redis, JPEG de 900 Ko au plus.

**Sécurité** :
- Chaque modification se fait en deux temps : l'outil renvoie d'abord un **aperçu** sans rien publier ; il ne publie qu'avec `confirmer: true`, que l'assistant n'envoie qu'après l'accord de Nelly (consigne donnée à l'assistant, et outils marqués « écriture » : Claude et Le Chat demandent en plus une approbation à l'écran).
- Le contenu passe par les mêmes vérifications et la même publication que l'espace de gestion (`site/api/_lib/publication.mjs`) ; chaque publication est un commit « … (assistant IA) », annulable dans Historique.
- Connexion OAuth 2.1 (`site/api/oauth.mjs`, `site/api/_lib/oauth.mjs`) : inscription automatique de l'assistant, autorisation par le mot de passe de l'espace de gestion (8 essais par quart d'heure), code à usage unique protégé par PKCE, jeton d'accès d'une heure, renouvellement 90 jours. Rien n'est stocké : jetons signés avec `ADMIN_SECRET`.
- **Retirer l'accès** : Mon compte → « Déconnecter tous les autres appareils » (révoque aussi les assistants), ou retirer le connecteur dans Claude / Le Chat. Changer `ADMIN_SECRET` révoque tout.

**Adresses techniques** (réécritures de `vercel.json`) : `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/inscription`, `/oauth/autoriser`, `/oauth/jeton`, `/envoi`.

**Essai local** : `outils/essai-gestion.mjs` sert aussi `/api/mcp` et les adresses OAuth (mot de passe d'essai : essai).

## Vidéos et albums (5 novembre 2026)

**Album** (plusieurs photos et vidéos, comme un post Instagram) : champ `suite` d'une coiffure (`services[]`) ou d'une publication de la galerie (`photos[]`), 20 éléments au plus. Un élément vaut `{ image }` ou `{ image, video: { src, largeur, hauteur, duree } }`. Une publication de la galerie peut aussi commencer par une vidéo (`photos[].video`). Sur le site, la vignette porte une pastille ; la touche ouvre la visionneuse (`js/main.js`), où l'on fait glisser les éléments. Une annonce au format section ou carte peut afficher une vidéo (`annonces[].video`, `image` = couverture).

**Préparation de la vidéo** (`admin/video.js`, bibliothèque `admin/vendor/mediabunny.min.mjs`, licence MPL-2.0, chargée seulement à l'ajout d'une vidéo) : conversion dans le navigateur en MP4 H.264, 1080p et 30 images/s au plus, 4,5 Mbit/s au plus, soit environ 35 Mo la minute ; 60 secondes gardées au plus. Sans encodeur vidéo dans le navigateur, le fichier d'origine est accepté s'il est déjà en MP4 H.264 et assez léger, sinon un message demande de changer de navigateur.

**Envoi** : une requête Vercel est limitée à 4,5 Mo. La vidéo part donc par morceaux de 2,7 Mo, déposés comme contenus Git sans publication (`api/_lib/video.mjs`), puis réunis à la fin. Les fichiers vont dans `site/video/`, avec cache de 30 jours. Le même mécanisme dépose les photos une à une lorsqu'une publication dépasse une requête.

**Connecteur** : `preparer_envoi_video` (lien à usage unique ; informations de la vidéo dans `contenu/videos/`), `preparer_envoi_photo` avec `plusieurs: true`, paramètre `album` de `modifier_coiffure`, `album` et `albums` de `modifier_galerie`, `video` de `ajouter_annonce` et `modifier_annonce`.

**Poids** : chaque vidéo alourdit le dépôt GitHub, jusqu'à 35 Mo la minute. Préférer des vidéos courtes (15 à 30 secondes). Si les vidéos se multiplient, passer à un hébergement vidéo dédié.

**Section film** (annonce format section avec `film: true`) : le film contient toute l'animation (rubans, volets, loupe, écran final), calculé une fois sur le poste à partir de la vidéo de Nelly. La page affiche seulement la vidéo, centrée ; les textes de l'annonce restent dans le contenu mais ne sont pas affichés. La vidéo est entièrement téléchargée avant de démarrer, puis tourne en boucle ; elle démarre quand le défilement s'arrête dessus, se met en pause quand elle quitte l'écran et reprend au même endroit. Elle tente de jouer avec le son ; les navigateurs le refusent tant que le visiteur n'a rien touché sur le site : elle part alors muette, et le son arrive au premier toucher ou clic. Réseau lent : `video.leger` (720p). Un nouveau film ne se fabrique pas depuis l'application.

## Déconnecter tous les appareils

Mon compte → « Déconnecter tous les autres appareils ». Le jeton de connexion porte sa date de création ; l'action enregistre la date du moment dans `contenu/sessions.json` (hors du site public, un commit « Espace Nelly : déconnexion de tous les appareils ») et tout jeton plus ancien est refusé. L'appareil qui fait la demande reçoit un nouveau jeton et reste connecté. La date est relue au plus une fois par minute par l'API. Changer `ADMIN_SECRET` dans Vercel déconnecte aussi tout le monde.

## Limites connues
- Les 3 cartes mises en avant sur l'accueil (knotless, tresses couchées, nattes collées) gardent leur nom et leur photo ; seuls leurs prix suivent.
- La mention « Du lundi au samedi, sur rendez-vous » du pied de page ne suit pas les horaires automatiquement (elle se modifie dans « Menu et pied de page »).
- Le mot de passe se change dans Vercel (variable `ADMIN_PASSWORD`), pas depuis l'application.
- Modifier les pages à la main reste possible : relancer ensuite `node outils/seo.mjs`, qui applique aussi le contenu de `contenu/site.json`.
