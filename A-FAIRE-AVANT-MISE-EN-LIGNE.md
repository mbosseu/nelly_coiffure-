# Nelly Coiffure : à faire avant la mise en ligne

Le site compte 8 pages : `index.html`, `coiffures.html`, `realisations.html`, `a-propos.html`, `tarifs.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html`.
Plusieurs contenus sont **fictifs, prévus pour le lancement**. Ils sont listés ci-dessous et doivent être validés ou remplacés par Nelly.

## Bloquant
- [ ] **Numéro WhatsApp** → `site/js/main.js`, ligne 2 (`WHATSAPP_NUMBER`, format 336XXXXXXXX). Tant qu'il reste `33600000000`, aucun bouton WhatsApp ne fonctionne.
- [ ] **Avis clientes** (accueil et À propos) : à ne publier que s'il s'agit de **vrais avis de vraies clientes**, avec leur accord. Publier de faux avis est interdit en France (pratique commerciale trompeuse, art. L121-4 du Code de la consommation) et se repère facilement. Idéalement, chaque avis doit être retrouvable sur la fiche Google de Nelly.
- [ ] **Photos de Nelly** (`coiffure/`, présentées comme ses réalisations, avec autorisation selon le propriétaire du site) : 12 photos sont utilisées, dans `site/img/nelly/` (design, via `outils/integrer-photos.mjs`) et `site/img/realisations/` (galerie, via `coiffure/VALIDEES.txt` et `outils/preparer-realisations.mjs`). Vérifier l’accord des personnes reconnaissables (droit à l’image), en particulier pour les enfants (accord des parents). Les photos portant la signature d’un autre compte, une interface d’application, des captures de boutiques ou des retouches IA ne sont pas publiées.
- [ ] Les images restantes de `img/maquette/` (pièce de l’expérience, texture du bloc rendez-vous, aperçu d’enfant du trouveur) sont des visuels de la maquette. Les photos d’autres créatrices de la v1 ont été sorties du site (`outils/archives-v1/`) : elles ne doivent jamais être publiées.

## Données fictives à valider
- [x] **Tarifs des prestations** : vrais prix de Nelly (noms des dossiers de `coiffure/`), regroupés dans le bloc `CARTE` de `outils/construire-pages.mjs`. Pour changer un prix : le modifier là, lancer `node outils/construire-pages.mjs`, puis mettre à jour les cartes de l'accueil (`index.html`) et la conversation d'exemple (`js/main.js`, bloc `SCRIPT`).
- [ ] **À confirmer avec Nelly** : « Tresses couchées enfant » à 30 € (déduit des photos du dossier `tresse coucher_30euro`), mèches comprises ou non, suppléments (domicile +10 / +20 €, perles +5 €, encore fictifs).
- [ ] **Durées et tenues** (fictives) → bloc `STYLES` du générateur et bloc `STYLES` du trouveur dans `js/main.js`.
- [ ] **FAQ** → `tarifs.html` (bloc `FAQ` du générateur) : acompte, annulation 24 h avant, paiement en espèces ou virement. Le même texte se trouve dans le bloc JSON-LD en haut de la page.
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
