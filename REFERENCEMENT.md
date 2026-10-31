# Référencement de Nelly Coiffure : le plan complet

Objectif : apparaître en haut de Google (et de Google Maps) quand quelqu'un cherche « tresses africaines Marseille », « coiffeuse afro Marseille », « knotless braids Marseille », « coiffure afro à domicile Marseille »…

Pour une coiffeuse locale, Google classe surtout selon trois critères :
1. **La pertinence** : le site et la fiche parlent clairement de tresses africaines à Marseille. ✅ Fait sur le site.
2. **La proximité** : la cliente cherche près de chez elle. Se gère avec la fiche Google Business (zone desservie).
3. **La notoriété** : avis Google, liens vers le site, activité sur la fiche. C'est la partie qui se construit avec le temps.

Délai réaliste : indexation en quelques jours ; premières positions locales en 4 à 8 semaines avec la fiche Google et des avis ; positions solides en 3 à 6 mois. Personne ne peut garantir la première place, mais en suivant ce plan, Nelly sera devant la plupart des coiffeuses de Marseille qui n'ont ni site, ni fiche à jour.

---

## Déjà fait sur le site (technique)

- Chaque page a un sujet, un titre et une description optimisés pour une recherche précise.
- Un seul titre principal (H1) par page avec les mots-clés : « Coiffeuse tresses africaines à Marseille », « Coiffures afro et tarifs à Marseille »…
- Adresse canonique sur chaque page (évite les doublons aux yeux de Google).
- Données structurées : Google comprend qu'il s'agit d'un salon de coiffure à Marseille, avec ses 11 prestations, ses prix, ses horaires, sa zone et ses questions fréquentes.
- Plan du site (`sitemap.xml`) et `robots.txt` à jour, pages légales et 404 exclues de l'index.
- Aperçus de partage complets (WhatsApp, Facebook, X) avec image.
- Site statique, rapide, adapté au mobile, images légères, cache configuré sur Vercel.
- Ancienne page Tarifs redirigée proprement (aucun lien cassé).
- Données Google complètes : téléphone, code postal 13004, coordonnées, réseaux sociaux (Instagram, TikTok, Facebook, Snapchat) reliés au salon, Nelly présentée comme fondatrice.
- Deux pages qui captent des recherches précises, reliées depuis le pied de page de chaque page et depuis l'accueil, Contact et Coiffures :
  - `coiffure-afro-domicile-marseille.html` : « coiffeuse afro à domicile Marseille », avec les quartiers et communes desservis ;
  - `conseils-tresses-africaines.html` : préparation, entretien, durée, knotless ou box braids (article signé Nelly, avec ses questions fréquentes).
  - `knotless-braids-marseille.html`, `locks-marseille.html`, `tresses-enfant-marseille.html` : une page par coiffure phare, avec photos, prix et questions fréquentes.
  Pour les réécrire : modifier `outils/pages-guides.mjs`, puis lancer `node outils/pages-guides.mjs` et `node outils/seo.mjs`.
- Un mot-clé principal par page, jamais deux pages sur le même :

  | Page | Recherche visée |
  |---|---|
  | Accueil | tresses africaines Marseille |
  | Coiffures et tarifs | prix tresses africaines Marseille |
  | Knotless braids | knotless braids Marseille, box braids Marseille |
  | Locks | locks Marseille |
  | Tresses enfant | tresses enfant Marseille |
  | Coiffure à domicile | coiffeuse afro à domicile Marseille |
  | Conseils | entretien tresses africaines, knotless ou box braids |
  | Réalisations | photos de tresses (Google Images) |

- IndexNow (Bing, ChatGPT, Copilot) : après chaque mise en ligne, lancer `node outils/indexnow.mjs` pour signaler les pages modifiées.
- Plan du site avec les photos de Nelly (Google Images) et textes alternatifs descriptifs sur toutes les photos de réalisations.
- `favicon.ico` et icônes 48 px / 192 px + `site.webmanifest` : le logo de Nelly s'affiche à côté du site dans les résultats Google.

L'outil `outils/seo.mjs` regroupe tous ces réglages. **Après toute modification des pages, relancer :**

```
node outils/seo.mjs
```

> Attention : ne plus lancer `outils/construire-pages.mjs`. Les pages Coiffures et Réalisations ont été modifiées à la main : le générateur les écraserait.

---

## Étape 1 — Le nom de domaine ✅ Fait le 31/10/2026

Le site est sur **https://www.nellycoiffure.fr** (domaine chez OVH, site hébergé chez Vercel).
- Zone DNS OVH : `@` A `216.198.79.1` et `www` CNAME `6c989f4f1cfbea76.vercel-dns-017.com.` (valeurs données par Vercel, projet `nelly-coiffure` > Settings > Domains).
- `nellycoiffure.fr` et l'ancienne adresse `nelly-coiffure.vercel.app` redirigent vers `www.nellycoiffure.fr` (Vercel et `site/vercel.json`).
- Le domaine se renouvelle chaque année chez OVH : activer le renouvellement automatique, sinon le site disparaît à l'échéance.

## Étape 2 — Google Search Console ✅ Fait le 31/10/2026

C'est le tableau de bord de Google pour le site : indexation, erreurs, mots-clés qui amènent des visites.

État au 31/10/2026 :
- Propriété **Domaine `nellycoiffure.fr`** validée par l'entrée TXT `google-site-verification=…` de la zone DNS OVH (ne jamais la supprimer, sinon la validation est perdue).
- `sitemap.xml` envoyé et lu : 10 pages découvertes.
- Indexation demandée pour l'accueil, Coiffures, Knotless braids, Coiffure à domicile, Locks et Tresses enfant. Les autres pages sont trouvées par le plan du site.
- PageSpeed mobile (accueil) : performances 95, SEO 100, bonnes pratiques 100, accessibilité 87 → corrigée (étoiles des avis, points du carrousel).

Pour info, la procédure suivie :

1. Aller sur https://search.google.com/search-console avec le compte Google de Nelly.
2. Ajouter une propriété :
   - le plus simple : type « Préfixe d'URL » avec `https://www.nellycoiffure.fr/`, méthode « Balise HTML » ;
   - ou type « Domaine » (`nellycoiffure.fr`), validation par un enregistrement TXT à ajouter dans la zone DNS OVH (je peux le faire).
3. Pour la balise HTML : copier uniquement le code entre les guillemets de `content="…"`, me l'envoyer (ou le coller dans `outils/seo.mjs`, ligne `GOOGLE_VERIFICATION`), relancer le script, pousser, puis cliquer « Valider ».
4. Menu « Sitemaps » : soumettre `sitemap.xml`.
5. Menu « Inspection de l'URL » : inspecter l'accueil puis cliquer « Demander l'indexation ». Idem pour Coiffures et Réalisations.
6. Ensuite, une fois par mois : regarder « Performances » (requêtes, clics, position moyenne) et « Pages » (erreurs d'indexation).

Bonus : Bing Webmaster Tools (https://www.bing.com/webmasters) peut importer la propriété Search Console en un clic. Bing alimente aussi ChatGPT et Copilot.

## Étape 3 — La fiche Google Business Profile (le levier n°1, gratuit)

C'est elle qui fait apparaître Nelly dans Google Maps et dans le bloc des 3 coiffeuses en haut des résultats.

1. Aller sur https://business.google.com et créer la fiche « Nelly Coiffure ».
2. Catégorie principale : **Coiffeur afro** (ou « Salon de coiffure » si absente). Catégories secondaires : « Coiffeur à domicile », « Tresses ».
3. Type d'activité : **entreprise de services avec zone desservie** (adresse masquée, puisque l'adresse exacte n'est donnée qu'à la confirmation). Zone : Marseille + Aubagne, Allauch, Plan-de-Cuques, Les Pennes-Mirabeau, Septèmes-les-Vallons, Cassis.
4. Renseigner, à l'identique du site :
   - téléphone WhatsApp de Nelly ;
   - site web : l'adresse du site ;
   - horaires (lundi au vendredi 9 h – 19 h, samedi 8 h – 18 h) ;
   - description (750 caractères) avec les mots naturels : tresses africaines, knotless braids, locks, twists, tissage, Marseille, à domicile ;
   - **Services** : les 11 prestations avec leurs prix (comme sur le site).
5. Valider la fiche (Google envoie un code par vidéo, SMS ou courrier selon les cas).
6. Ajouter **au moins 10 vraies photos** prises par Nelly (coiffures, mains au travail, son espace), puis 2 à 3 nouvelles par semaine.
7. Publier une **actualité** chaque semaine (une coiffure du jour, une disponibilité, une astuce d'entretien) : une fiche active remonte.
8. Activer la messagerie et répondre vite aux questions.

## Étape 4 — Les avis Google (le facteur de classement local le plus fort)

1. Dans la fiche : « Demander des avis » donne un lien court. L'envoyer sur WhatsApp à chaque cliente après le rendez-vous, avec un petit message : « Merci pour votre confiance ! Si vous êtes contente de vos tresses, un avis m'aiderait beaucoup : [lien] ».
2. Objectif : 10 avis le premier mois, puis 3 à 5 par mois. La régularité compte plus que le nombre.
3. Répondre à **chaque** avis, en citant naturellement la coiffure : « Merci Awa, ravie que vos knotless vous plaisent ! ».
4. Ensuite, me donner le lien de la fiche : je l'ajoute au site (bouton « Voir les avis Google ») et dans les données structurées (ligne `FICHE_GOOGLE` de `outils/seo.mjs`).

⚠️ Ne jamais acheter d'avis, en écrire soi-même ou en échanger : c'est interdit en France (jusqu'à 300 000 € d'amende) et Google supprime la fiche.

## Étape 5 — La cohérence partout (NAP)

Google recoupe les informations. Le **nom**, la **zone** et le **téléphone** doivent être écrits exactement pareil partout : site, fiche Google, Instagram, TikTok, Facebook, annuaires.

Créer ou mettre à jour, avec le lien vers le site :
- Instagram et TikTok (lien du site dans la bio) : m'envoyer les liens, je les ajoute au site ;
- Page Facebook ;
- Apple Business Connect (Plans d'Apple, utilisé sur iPhone) : https://businessconnect.apple.com ;
- Bing Places : https://www.bingplaces.com (import depuis Google possible) ;
- PagesJaunes ;
- Planity ou Treatwell si Nelly veut aussi y être visible.

## Étape 6 — Les liens vers le site

Chaque site sérieux qui pointe vers celui de Nelly est un « vote » pour Google.
- Liens depuis tous les réseaux et annuaires ci-dessus.
- Partenariats locaux : boutiques de mèches et cosmétiques afro de Marseille, photographes, maquilleuses, organisatrices de mariages (échange de recommandations).
- Groupes et pages de quartier, associations, événements afro à Marseille.

À éviter : acheter des liens, les annuaires douteux, les échanges massifs. Google les repère et pénalise.

## Étape 7 — Le contenu qui attire des recherches (à faire ensemble)

Les clientes posent des questions à Google avant de réserver. Des pages guides bien écrites captent ces recherches et amènent des visites qualifiées. Idées, une page par sujet :
- « Combien de temps durent des knotless braids ? »
- « Comment entretenir ses tresses africaines »
- « Knotless ou box braids : que choisir ? »
- « Préparer ses cheveux avant la pose de tresses »
- « Tresses pour enfant : conseils pour une première pose »
- « Coiffure afro à domicile à Marseille : comment ça se passe »

Une page par mois suffit. Je peux les rédiger et les intégrer dans le design (avec le vocabulaire de Nelly), puis les ajouter au plan du site.

## Étape 8 — Les photos du site

Google Images est une vraie source de visites pour la coiffure. Les photos doivent être celles de Nelly, nommées et décrites (c'est déjà le cas sur le site). À chaque nouvelle réalisation : l'ajouter au site **et** à la fiche Google.

---

## Suivi mensuel (30 minutes)

- Search Console : clics, requêtes, position moyenne, pages non indexées.
- Fiche Google : vues, appels, clics vers le site, demandes d'itinéraire, nouveaux avis.
- Tester les recherches clés en navigation privée : « tresses africaines Marseille », « coiffeuse afro Marseille », « knotless braids Marseille », « coiffure afro à domicile Marseille ».

## Ce qui bloque encore le site lui-même

- Les deux pages guides : à faire relire par Nelly (zone de déplacement, durées de tenue, conseils) pour qu'elles parlent avec ses mots.
- Les contenus provisoires (histoire de Nelly, horaires, mentions légales) : Google valorise les informations précises et vérifiables.
