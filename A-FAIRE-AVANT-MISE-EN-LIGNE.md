# Nelly Coiffure : à faire avant la mise en ligne

Le site compte 8 pages : `index.html`, `coiffures.html`, `realisations.html`, `a-propos.html`, `tarifs.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html`.
Plusieurs contenus sont **fictifs, prévus pour le lancement**. Ils sont listés ci-dessous et doivent être validés ou remplacés par Nelly.

## Bloquant
- [ ] **Numéro WhatsApp** → `site/js/main.js`, ligne 2 (`WHATSAPP_NUMBER`, format 336XXXXXXXX). Tant qu'il reste `33600000000`, aucun bouton WhatsApp ne fonctionne.
- [ ] **Avis clientes** (accueil et À propos) : à ne publier que s'il s'agit de **vrais avis de vraies clientes**, avec leur accord. Publier de faux avis est interdit en France (pratique commerciale trompeuse, art. L121-4 du Code de la consommation) et se repère facilement. Idéalement, chaque avis doit être retrouvable sur la fiche Google de Nelly.
- [ ] **Photos** : toutes les images de `img/maquette/` viennent de la maquette (modèles), pas du travail de Nelly. La page Réalisations doit montrer **ses vraies réalisations** avant la mise en ligne. Les photos d’autres créatrices de la v1 ont été sorties du site (`outils/archives-v1/`) : elles ne doivent jamais être publiées.

## Données fictives à valider
- [ ] **Tarifs** → `tarifs.html` (grille, options et estimateur, qui lit directement la grille) et mentions « Dès … € » dans `coiffures.html` et dans `js/main.js` (bloc `STYLES` du trouveur).
  - Knotless 90 / 110 / 140 €, box braids 80 / 100 / 130 €, fulani 70 / 90 / 110 €, cornrows 35 / 50 / 65 €.
  - Domicile Marseille +10 €, communes voisines +20 €, perles +5 €, moins de 12 ans −20 %, défaire dès 20 €, coiffage événement dès 15 €.
- [ ] **Durées et tenues** de chaque coiffure → `coiffures.html` et `tarifs.html`.
- [ ] **FAQ** → `tarifs.html` : acompte de 20 €, annulation 24 h avant, paiement en espèces ou virement, enfants dès 4 ans. Le même texte se trouve dans le bloc JSON-LD en haut de la page.
- [ ] **Zone et suppléments de déplacement** → `tarifs.html` (options et estimateur) et bloc « Où ? » de `contact.html`.
- [ ] **Horaires** → bloc « Disponibilités » de `contact.html`, et mention « Du lundi au samedi » dans le pied de page de chaque page.
- [ ] **Mentions légales** → `mentions-legales.html` : compléter les éléments entre crochets (nom, SIRET, adresse, hébergeur), puis retirer l’encadré d’avertissement.
- [ ] **Conversation d’exemple** de la page Contact (prix, horaires) → bloc `SCRIPT` dans `js/main.js`, à garder cohérent avec les tarifs.
- [ ] **Histoire et valeurs de Nelly** → `a-propos.html` : texte rédigé pour le lancement, à relire et personnaliser par Nelly.
- [ ] **Liens Instagram et TikTok** (`href="#"`) → pied de page de chaque page, `realisations.html` et `contact.html`.
- [ ] **Nom de domaine** : remplacer `https://www.nellycoiffure.fr` (provisoire) dans `site/robots.txt` et `site/sitemap.xml`. Mettre aussi l’adresse complète de l’image de partage dans les balises `og:image` de chaque page (ex. `https://…/img/marque/partage.jpg`), sinon WhatsApp n’affiche pas l’aperçu.
- [ ] **Hébergement** : configurer `404.html` comme page d’erreur (option standard chez Netlify, OVH, o2switch…). Ne publier que le dossier `site/`.

## Photos à demander à Nelly
- Une **photo de Nelly** (portrait ou au travail) pour À propos.
- 3 à 4 photos par coiffure (knotless, box braids, fulani, cornrows), avec l'accord des clientes.
- Si possible, des photos **avant/après** sous le même angle.

Conseils (un téléphone suffit) : lumière du jour près d'une fenêtre, sans flash ; fond uni ; 3 angles (dos, profil, face) ; photo verticale à hauteur de tête.

Pour traiter de nouvelles photos : les déposer dans `image et video/`, adapter la liste dans `outils/preparer-images.mjs`, puis lancer `node outils/preparer-images.mjs`.

## Visibilité locale
- [ ] Créer la fiche **Google Business Profile** « Nelly Coiffure » (catégorie Coiffeur afro / Tresses africaines). C'est le levier n°1 pour les recherches « tresses africaines Marseille » et pour recueillir de vrais avis.

## Tester le site en local
```
node outils/serveur.mjs
```
puis ouvrir http://localhost:5173
