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

Onglet « Statistiques » de l'espace de gestion (et tuile « Statistiques de visite » de l'accueil) : visiteurs, visites, pages vues, prises de contact (WhatsApp, appel), temps passé, taux de départ après une page, courbe par jour, provenance (Google, Instagram, Facebook, TikTok, accès direct…), pages les plus vues, pages d'où partent les contacts, appareils, villes, heures d'affluence, pages d'arrivée et de départ, chemins fréquents, et le parcours détaillé des dernières visites. « Personnes sur le site en ce moment » (5 dernières minutes).

**Fonctionnement, sans cookie et anonyme** (exempté de consentement selon la CNIL) :
- `js/main.js` envoie de petits événements à `/api/stats` (`navigator.sendBeacon`) : page vue, fin de page (temps visible, défilement), clic de contact. Un numéro de visite aléatoire vit dans `sessionStorage` (disparaît à la fermeture de l'onglet).
- `api/_lib/stats.mjs` compte par jour dans une base Redis. Une personne est reconnue le temps d'une journée par une empreinte (IP + navigateur + sel du jour, sel effacé après 2 jours) ; l'adresse IP n'est jamais enregistrée. Robots ignorés. Compteurs gardés 13 mois, parcours détaillés 3 mois.
- Les visites de Nelly ne sont pas comptées : la connexion à l'espace de gestion pose `nc_stats_off` sur l'appareil. La page Confidentialité explique la mesure et propose un bouton pour la refuser.
- Lecture par l'action `stats` de `api/admin.mjs` (réservée à la session de Nelly).

**Mise en service (une seule fois)** : Vercel → projet du site → onglet **Storage** → **Create Database** → **Upstash for Redis** (offre gratuite) → la relier au projet (environnements Production et Preview). Vercel ajoute seul les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, les deux sont reconnues), puis **redéployer**. Sans base, le site fonctionne normalement et l'onglet indique que les statistiques ne sont pas encore activées. L'offre gratuite (500 000 commandes par mois) couvre environ 40 000 pages vues par mois.

**Essai local** : `outils/essai-gestion.mjs` simule la base Redis en mémoire ; sur `localhost`, la mesure ne s'active que si `localStorage.nc_stats_essai = '1'`.

**En service depuis le 2 novembre 2026** : base `upstash-kv-camel-curtain` (offre gratuite, région Francfort), reliée au projet `nelly-coiffure`.

## Actualisation automatique de l'application

Toutes les minutes, et dès qu'on revient sur l'application (téléphone déverrouillé, onglet rouvert, retour du réseau) :
- **Nouvelle version de l'application** (empreintes `ETag` de `/admin/`, `admin.js`, `admin.css`) : la page se recharge seule et revient sur le même onglet (« Application mise à jour. »).
- **Contenu publié depuis un autre appareil** (version de `contenu/site.json`, contrôlée au plus toutes les 2 minutes) : le contenu affiché est remplacé (« Contenu actualisé… »).
- **Statistiques** : les chiffres se mettent à jour pendant que l'onglet est ouvert.

Sécurités : rien n'est rechargé tant qu'une modification n'est pas publiée (un message prévient que la nouvelle version s'installera après publication), qu'une fenêtre est ouverte ou qu'un texte est en cours de saisie. En dehors d'un retour sur l'application, il faut aussi 20 secondes sans toucher l'écran, et jamais pendant l'édition dans « Mes pages ».

## Déconnecter tous les appareils

Mon compte → « Déconnecter tous les autres appareils ». Le jeton de connexion porte sa date de création ; l'action enregistre la date du moment dans `contenu/sessions.json` (hors du site public, un commit « Espace Nelly : déconnexion de tous les appareils ») et tout jeton plus ancien est refusé. L'appareil qui fait la demande reçoit un nouveau jeton et reste connecté. La date est relue au plus une fois par minute par l'API. Changer `ADMIN_SECRET` dans Vercel déconnecte aussi tout le monde.

## Limites connues
- Les 3 cartes mises en avant sur l'accueil (knotless, tresses couchées, nattes collées) gardent leur nom et leur photo ; seuls leurs prix suivent.
- La mention « Du lundi au samedi, sur rendez-vous » du pied de page ne suit pas les horaires automatiquement (elle se modifie dans « Menu et pied de page »).
- Le mot de passe se change dans Vercel (variable `ADMIN_PASSWORD`), pas depuis l'application.
- Modifier les pages à la main reste possible : relancer ensuite `node outils/seo.mjs`, qui applique aussi le contenu de `contenu/site.json`.
