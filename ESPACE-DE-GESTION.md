# Espace de gestion de Nelly (www.nellycoiffure.fr/admin)

Une application installable sur le téléphone de Nelly pour modifier elle-même son site, sans code :

| Onglet | Ce qu'elle peut faire |
|---|---|
| **Annonce** | Afficher un message en haut de toutes les pages (congés, promo, nouveauté) ou le retirer |
| **Coiffures** | Changer prix, nom, catégorie, description et photo ; masquer, ajouter, supprimer, réordonner une coiffure |
| **Photos** | Ajouter des réalisations depuis la galerie du téléphone (recadrage et allègement automatiques), changer leur coiffure, les retirer |
| **Horaires** | Ouvert / sur demande / fermé et heures, jour par jour ; les deux numéros de téléphone |
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
- **Annoncer des congés** : onglet *Annonce* → écrire le message → *Publier*. Pour l'enlever : décocher « Afficher l'annonce » → *Publier*.
- **Changer les horaires** : onglet *Horaires* → *Publier*.
- **Une erreur ?** Onglet *Historique* → *Revenir* sur une version précédente → *Publier*.
- Tant que rien n'est publié, les changements restent sur le téléphone (la barre orange l'indique) ; *Annuler* les efface.
- Le site se met à jour environ une minute après *Publier* : rafraîchir la page du site pour voir le résultat.

## Essayer sans risque sur le poste

```
node outils/essai-gestion.mjs
```
puis ouvrir http://localhost:5174/admin/ (mot de passe d'essai : `essai`). Le site est copié dans un dossier temporaire et GitHub est simulé : rien n'est publié pour de vrai.

## Limites connues de la version 1
- Les 3 cartes mises en avant sur l'accueil (knotless, tresses couchées, nattes collées) gardent leur nom et leur photo ; seuls leurs prix suivent.
- La mention « Du lundi au samedi, sur rendez-vous » du pied de page ne suit pas les horaires.
- Les textes de présentation (accueil, À propos, questions fréquentes) et les avis ne sont pas encore modifiables : prévus pour la version 2 si besoin.
- Modifier les pages à la main reste possible : relancer ensuite `node outils/seo.mjs`, qui applique aussi le contenu de `contenu/site.json`.
