// Espace de gestion de Nelly Coiffure.
// Les modifications restent sur l'appareil (brouillon) jusqu'à « Publier » : l'API régénère alors le site
// et Vercel le remet en ligne en une minute environ. « Aperçu » montre la page générée sans rien publier.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DOSSIER = 'img/realisations/catalogue';
const MAX_ENVOI = 3.6 * 1024 * 1024; // marge sous la limite de 4,5 Mo d'une requête Vercel
const CLE_BROUILLON = 'nc_brouillon';
const TEL = /^0[1-9](?:[ .]?\d{2}){4}$/;
const RESEAUX = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', snapchat: 'Snapchat', youtube: 'YouTube' };
// Seul Instagram est obligatoire (boutons de la page Réalisations) ; un réseau laissé vide disparaît du site
const reseauValide = (cle, v) => (cle !== 'instagram' && !String(v || '').trim()) || urlValide(v);
const PAGES = [
  ['index.html', 'Accueil'], ['coiffures.html', 'Coiffures et tarifs'], ['realisations.html', 'Réalisations'],
  ['a-propos.html', 'À propos'], ['contact.html', 'Contact'], ['knotless-braids-marseille.html', 'Knotless braids'],
  ['locks-marseille.html', 'Locks'], ['tresses-enfant-marseille.html', 'Tresses enfant'],
  ['coiffure-afro-domicile-marseille.html', 'Coiffure à domicile'], ['conseils-tresses-africaines.html', 'Conseils tresses'],
];
const FORMATS = { section: 'Grande section', carte: 'Carte', encadre: 'Encadré', bandeau: 'Bandeau', cartes: 'Grille de cartes', appel: 'Bande d’appel' };

const etat = {
  base: null, // contenu publié (dernière version chargée)
  contenu: null, // contenu en cours de modification
  version: null, // empreinte du contenu publié, pour ne pas écraser une publication faite ailleurs
  nouvelles: new Map(), // image → { grand, petit (base64), apercu (URL), largeur, hauteur } pas encore publiées
  onglet: 'annonces',
  defaire: [], // états précédents (annuler / rétablir)
  refaire: [],
  instantane: null,
  dernierAjout: 0,
};

// --- API -------------------------------------------------------------------------

async function api(action, { methode = 'GET', corps, params = '' } = {}) {
  let r;
  try {
    r = await fetch(`/api/admin?action=${action}${params}`, {
      method: methode,
      credentials: 'same-origin',
      headers: corps ? { 'Content-Type': 'application/json', 'X-Nelly-Admin': '1' } : { 'X-Nelly-Admin': '1' },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new Error('Pas de connexion internet. Vos modifications sont gardées sur cet appareil : réessayez dès que le réseau revient.');
  }
  const donnees = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== 'connexion') {
    afficherConnexion('Votre session a expiré. Reconnectez-vous : vos modifications non publiées sont conservées.');
    throw new Error(donnees.erreur || 'Session expirée.');
  }
  if (r.status === 413) throw new Error('L’envoi est trop lourd. Publiez moins de photos à la fois.');
  if (!r.ok) throw new Error(donnees.erreur || `Erreur ${r.status}`);
  return donnees;
}

// --- Démarrage et connexion -------------------------------------------------------

function afficherConnexion(message = '') {
  $$('dialog[open]').forEach((d) => d.close());
  $('#appli').hidden = true;
  $('#connexion').hidden = false;
  $('#message-connexion').textContent = message;
  $('#message-connexion').hidden = !message;
  $('#mdp').focus();
}

// Afficher ou masquer le mot de passe pendant la saisie
function voirMotDePasse(visible) {
  $('#mdp').type = visible ? 'text' : 'password';
  $('#voir-mdp').setAttribute('aria-pressed', String(visible));
  $('#voir-mdp').setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  $('#voir-mdp-texte').textContent = visible ? 'Masquer' : 'Afficher';
}
$('#voir-mdp').addEventListener('click', () => {
  voirMotDePasse($('#mdp').type === 'password');
  $('#mdp').focus();
});

$('#form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bouton = $('#form-connexion button');
  const erreur = $('#erreur-connexion');
  erreur.hidden = true;
  bouton.disabled = true;
  try {
    await api('connexion', { methode: 'POST', corps: { motDePasse: $('#mdp').value } });
    $('#mdp').value = '';
    voirMotDePasse(false);
    await demarrer();
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
  } finally {
    bouton.disabled = false;
  }
});

async function demarrer() {
  const { contenu, version, navigationDefaut } = await api('contenu');
  etat.navDefaut = navigationDefaut;
  normaliser(contenu);
  etat.base = contenu;
  etat.version = version;
  etat.contenu = structuredClone(contenu);
  // Brouillon non publié gardé sur cet appareil (les nouvelles images, elles, ne survivent pas à la fermeture)
  try {
    const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) || 'null');
    if (b && b.version === version && JSON.stringify(b.contenu) !== JSON.stringify(contenu)) {
      etat.contenu = b.contenu;
      normaliser(etat.contenu);
      if (retirerImagesPerdues()) setTimeout(() => alert('Certaines images ajoutées avant la fermeture de l’application n’avaient pas été publiées. Ajoutez-les de nouveau.'), 300);
    }
  } catch { /* stockage indisponible : on repart du contenu publié */ }
  etat.defaire = [];
  etat.refaire = [];
  etat.instantane = JSON.stringify(etat.contenu);
  $('#connexion').hidden = true;
  $('#appli').hidden = false;
  // Les visites de Nelly sur son propre site ne sont pas comptées dans les statistiques
  try { if (localStorage.getItem('nc_stats_compter') !== '1') localStorage.setItem('nc_stats_off', '1'); } catch { /* sans effet */ }
  toutAfficher();
  accueillir();
}

// Contenu des anciennes versions (une seule annonce texte, pas de réseaux) → format actuel
function normaliser(c) {
  if (!Array.isArray(c.annonces)) {
    const a = c.annonce || {};
    c.annonces = String(a.texte || '').trim() ? [{ id: 'annonce-1', active: !!a.active, format: 'bandeau', titre: '', texte: a.texte, pages: ['toutes'] }] : [];
  }
  delete c.annonce;
  c.pages = c.pages && typeof c.pages === 'object' ? c.pages : {};
  c.reseaux = c.reseaux || {
    instagram: 'https://www.instagram.com/nellycoiffure237/', tiktok: 'https://www.tiktok.com/@nellycoiffure237',
    facebook: 'https://www.facebook.com/share/1CFM1XgV6n/', snapchat: 'https://snapchat.com/t/rsEMEsWo',
  };
  c.reseaux.youtube = c.reseaux.youtube || '';
  return c;
}

function retirerImagesPerdues() {
  const connues = new Set(imagesUtilisees(etat.base));
  const perdues = imagesUtilisees(etat.contenu).filter((img) => !connues.has(img) && !etat.nouvelles.has(img));
  if (!perdues.length) return false;
  etat.contenu.photos = etat.contenu.photos.filter((p) => !perdues.includes(p.image));
  etat.contenu.services = etat.contenu.services.filter((s) => !perdues.includes(s.photo));
  etat.contenu.annonces.forEach((a) => { if (a.image && perdues.includes(a.image.src)) a.image = null; (a.cartes || []).forEach((x) => { if (x.image && perdues.includes(x.image.src)) x.image = null; }); });
  Object.values(etat.contenu.pages).forEach((p) => Object.keys(p.images || {}).forEach((id) => { if (perdues.includes(p.images[id].src)) delete p.images[id]; }));
  if (perdues.includes(etat.contenu.marque?.logo?.src)) delete etat.contenu.marque;
  if (perdues.includes(etat.contenu.fonds?.cta)) delete etat.contenu.fonds;
  return true;
}

// --- Mon compte ------------------------------------------------------------------

let invitationInstallation = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitationInstallation = e; });
const estInstallee = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const estIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

$('#ouvrir-compte').addEventListener('click', () => {
  $('#installer').hidden = estInstallee() || !invitationInstallation;
  $('#aide-iphone').hidden = estInstallee() || !estIphone();
  $('#fiche-compte').showModal();
});
$('#installer').addEventListener('click', async () => {
  if (!invitationInstallation) return;
  invitationInstallation.prompt();
  await invitationInstallation.userChoice.catch(() => {});
  invitationInstallation = null;
  $('#installer').hidden = true;
});
$('#deconnexion').addEventListener('click', async () => {
  if (modifie() && !confirm('Des modifications ne sont pas publiées. Elles resteront sur cet appareil jusqu’à votre prochaine connexion. Se déconnecter ?')) return;
  try {
    await api('deconnexion', { methode: 'POST', corps: {} });
  } catch (err) {
    alert(`La déconnexion n’a pas pu être confirmée : ${err.message}`);
    return;
  }
  afficherConnexion('Vous êtes déconnectée.');
});
$('#deconnecter-partout').addEventListener('click', async () => {
  if (!confirm('Déconnecter tous les autres appareils (téléphone, tablette, ordinateur) ? Ils devront retaper le mot de passe. Cet appareil reste connecté.')) return;
  const bouton = $('#deconnecter-partout');
  const message = $('#message-compte');
  bouton.disabled = true;
  try {
    await api('deconnecter-partout', { methode: 'POST', corps: {} });
    message.className = 'message message--ok';
    message.textContent = 'C’est fait : les autres appareils seront déconnectés d’ici une minute.';
  } catch (err) {
    message.className = 'message message--erreur';
    message.textContent = err.message;
  } finally {
    message.hidden = false;
    bouton.disabled = false;
  }
});

// --- Brouillon, annuler / rétablir, barre de publication ---------------------------

const modifie = () => etat.contenu && JSON.stringify(etat.contenu) !== JSON.stringify(etat.base);

// À appeler après chaque modification : mémorise l'état précédent pour « Annuler »
// (les frappes rapprochées dans un même champ comptent comme une seule action)
function changement({ regrouper = false } = {}) {
  const maintenant = JSON.stringify(etat.contenu);
  if (maintenant !== etat.instantane) {
    if (!(regrouper && Date.now() - etat.dernierAjout < 1200 && etat.defaire.length)) etat.defaire.push(etat.instantane);
    if (etat.defaire.length > 60) etat.defaire.shift();
    etat.refaire = [];
    etat.instantane = maintenant;
    etat.dernierAjout = Date.now();
  }
  majBarre();
}

function majBarre() {
  try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ version: etat.version, contenu: etat.contenu })); } catch { /* sans effet */ }
  const n = resumeModifications().length;
  $('#barre-publier').hidden = !modifie() && !etat.defaire.length;
  $('#nb-modifs').textContent = modifie() ? `${n || 1} modification${n > 1 ? 's' : ''}` : 'Aucune modification';
  $('#nb-modifs-court').textContent = modifie() ? `${n || 1} à publier` : '';
  if (modifie()) proposerDemoPublier();
  $('#publier').disabled = !modifie();
  $('#ouvrir-apercu').disabled = !modifie();
  $('#defaire').disabled = !etat.defaire.length;
  $('#refaire').disabled = !etat.refaire.length;
  ajusterEditeur();
}

function revenirA(texte) {
  etat.contenu = JSON.parse(texte);
  etat.instantane = texte;
  toutAfficher({ garderPile: true });
}
$('#defaire').addEventListener('click', () => {
  if (!etat.defaire.length) return;
  etat.refaire.push(etat.instantane);
  revenirA(etat.defaire.pop());
});
$('#refaire').addEventListener('click', () => {
  if (!etat.refaire.length) return;
  etat.defaire.push(etat.instantane);
  revenirA(etat.refaire.pop());
});

function resumeModifications() {
  const a = etat.base;
  const b = etat.contenu;
  const lignes = [];
  for (const x of b.annonces) {
    const avant = a.annonces.find((y) => y.id === x.id);
    const genre = x.emplacement ? 'section' : 'annonce';
    if (!avant) lignes.push(`Nouvelle ${genre} : ${x.titre || x.texte}`);
    else if (JSON.stringify(avant) !== JSON.stringify(x)) lignes.push(`${genre === 'section' ? 'Section' : 'Annonce'} modifiée : ${x.titre || x.texte}`);
  }
  for (const x of a.annonces) if (!b.annonces.some((y) => y.id === x.id)) lignes.push(`${x.emplacement ? 'Section' : 'Annonce'} supprimée : ${x.titre || x.texte}`);
  if ((a.theme || 'cuivre') !== (b.theme || 'cuivre')) lignes.push('Couleurs du site');
  if (JSON.stringify(a.marque || null) !== JSON.stringify(b.marque || null)) lignes.push(b.marque ? 'Nouveau logo' : 'Logo d’origine');
  if (JSON.stringify(a.fonds || null) !== JSON.stringify(b.fonds || null)) lignes.push(b.fonds ? 'Nouvelle image de fond' : 'Image de fond d’origine');
  if (JSON.stringify(a.horaires) !== JSON.stringify(b.horaires)) lignes.push('Horaires');
  if (JSON.stringify(a.telephones) !== JSON.stringify(b.telephones)) lignes.push('Téléphones');
  for (const [cle, nom] of Object.entries(RESEAUX)) if ((a.reseaux[cle] || '') !== (b.reseaux[cle] || '')) lignes.push(`Lien ${nom}`);
  if (JSON.stringify(a.navigation || null) !== JSON.stringify(b.navigation || null)) lignes.push('Menu et pied de page');
  for (const [f, n] of PAGES) if (JSON.stringify(a.pages[f] || {}) !== JSON.stringify(b.pages[f] || {})) lignes.push(`Page ${n} modifiée`);
  for (const s of b.services) {
    const avant = a.services.find((x) => x.cle === s.cle);
    if (!avant) lignes.push(`Nouvelle coiffure : ${s.nom}`);
    else if (JSON.stringify(avant) !== JSON.stringify(s)) lignes.push(avant.prix !== s.prix ? `${s.nom} : ${avant.prix} € → ${s.prix} €` : `${s.nom} modifiée`);
  }
  for (const s of a.services) if (!b.services.some((x) => x.cle === s.cle)) lignes.push(`Coiffure supprimée : ${s.nom}`);
  if (a.services.map((s) => s.cle).join() !== b.services.map((s) => s.cle).join() && !lignes.some((l) => l.includes('oiffure'))) lignes.push('Ordre des coiffures');
  const ajoutees = b.photos.filter((p) => !a.photos.some((x) => x.image === p.image)).length;
  const retirees = a.photos.filter((p) => !b.photos.some((x) => x.image === p.image)).length;
  if (ajoutees) lignes.push(`${ajoutees} photo${ajoutees > 1 ? 's' : ''} ajoutée${ajoutees > 1 ? 's' : ''}`);
  if (retirees) lignes.push(`${retirees} photo${retirees > 1 ? 's' : ''} retirée${retirees > 1 ? 's' : ''}`);
  if (!ajoutees && !retirees && JSON.stringify(a.photos) !== JSON.stringify(b.photos)) lignes.push('Photos réorganisées');
  return lignes;
}

$('#annuler-tout').addEventListener('click', () => {
  if (!confirm('Annuler toutes les modifications non publiées ?')) return;
  etat.defaire.push(etat.instantane);
  etat.refaire = [];
  revenirA(JSON.stringify(etat.base));
});

// --- Onglets ---------------------------------------------------------------------

const TITRES = { pages: 'Mes pages', annonces: 'Annonces', coiffures: 'Coiffures et prix', photos: 'Photos', infos: 'Infos et liens', historique: 'Historique', stats: 'Statistiques' };
$$('.onglets button').forEach((b) => b.addEventListener('click', () => ouvrirOnglet(b.dataset.cible)));

function ouvrirOnglet(nom) {
  etat.onglet = nom;
  $$('.onglet').forEach((s) => { s.hidden = s.dataset.onglet !== nom; });
  $$('.onglets button').forEach((b) => (b.dataset.cible === nom ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $('#titre-onglet').textContent = TITRES[nom];
  if (nom === 'historique') afficherHistorique();
  if (nom === 'stats') { chargerStats(); chargerDirect(); afficherAppareil(); }
  document.body.classList.toggle('mode-editeur', nom === 'pages');
  $('#toast').hidden = true;
  if (nom === 'pages') { ajusterEditeur(); chargerSections(); }
  window.scrollTo(0, 0);
}

function toutAfficher({ garderPile = false } = {}) {
  afficherAnnonces();
  afficherCoiffures();
  afficherPhotos();
  afficherInfos();
  ouvrirOnglet(etat.onglet);
  if (!garderPile) etat.instantane = JSON.stringify(etat.contenu);
  majBarre();
}

// --- Outils ----------------------------------------------------------------------

const urlImage = (img, petit = true) => etat.nouvelles.get(img)?.apercu || `/${img}${petit ? '-sm' : ''}.jpg`;
const imagesUtilisees = (c) => [...new Set([...c.services.map((s) => s.photo), ...c.photos.map((p) => p.image), ...(c.annonces || []).flatMap((a) => [a.image?.src, ...(a.cartes || []).map((x) => x.image?.src)]).filter(Boolean), ...Object.values(c.pages || {}).flatMap((p) => Object.values(p.images || {}).map((im) => im.src)), c.marque?.logo?.src, c.fonds?.cta].filter(Boolean))];
const echapper = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const versCle = (nom) => nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'element';
const urlValide = (u) => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; } };
const aujourdhui = () => new Date().toLocaleDateString('sv');
const dateFr = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

async function chargerImage(fichier) {
  if (!/^image\//.test(fichier.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(fichier.name)) throw new Error('Ce fichier n’est pas une image. Choisissez une photo (JPEG, PNG…).');
  if (fichier.size > 40 * 1024 * 1024) throw new Error('Cette image est trop lourde (plus de 40 Mo). Choisissez-en une autre.');
  const url = URL.createObjectURL(fichier);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch {
    URL.revokeObjectURL(url);
    throw new Error('Ce format d’image n’est pas lisible ici. Sur iPhone, choisissez la photo depuis « Photos » plutôt que « Fichiers ».');
  }
  return { img, liberer: () => URL.revokeObjectURL(url) };
}

const dessiner = (img, l, h, qualite, recadrer) => {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  let sx = 0; let sy = 0; let sl = img.naturalWidth; let sh = img.naturalHeight;
  if (recadrer) {
    const ratio = l / h;
    if (sl / sh > ratio) sl = sh * ratio; else sh = sl / ratio;
    sx = (img.naturalWidth - sl) / 2; sy = (img.naturalHeight - sh) / 2;
  }
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sl, sh, 0, 0, l, h);
  return c.toDataURL('image/jpeg', qualite);
};

// Photo de réalisation → deux JPEG recadrés en 4:5 (1000×1250 et 500×625), comme les photos du site
async function preparerPhoto(fichier) {
  const { img, liberer } = await chargerImage(fichier);
  try {
    const grand = dessiner(img, 1000, 1250, 0.82, true);
    const petit = dessiner(img, 500, 625, 0.8, true);
    return { grand: grand.split(',')[1], petit: petit.split(',')[1], apercu: petit };
  } finally { liberer(); }
}

// Image d'annonce → image entière (sans recadrage), 1600 px et 800 px au plus ; le cadrage se règle ensuite
async function preparerImageLibre(fichier) {
  const { img, liberer } = await chargerImage(fichier);
  try {
    const echelle = (max) => Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const l = Math.round(img.naturalWidth * echelle(1600)); const h = Math.round(img.naturalHeight * echelle(1600));
    const grand = dessiner(img, l, h, 0.82, false);
    const petit = dessiner(img, Math.round(img.naturalWidth * echelle(800)), Math.round(img.naturalHeight * echelle(800)), 0.8, false);
    return { grand: grand.split(',')[1], petit: petit.split(',')[1], apercu: petit, largeur: l, hauteur: h };
  } finally { liberer(); }
}

// Nom jamais utilisé pour une nouvelle image : les navigateurs gardent les images en cache 30 jours
let sequence = 0;
const nouveauNom = (dossier, prefixe) => `${dossier}/${prefixe}-${Date.now()}${String(sequence++ % 100).padStart(2, '0')}`;

const tailleEnvoi = () => [...etat.nouvelles.entries()].filter(([img, p]) => p.grand && imagesUtilisees(etat.contenu).includes(img)).reduce((t, [, p]) => t + p.grand.length + p.petit.length, 0);

$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-fermer]')) d.close();
  });
});

// --- Annonces --------------------------------------------------------------------

function statutAnnonce(a) {
  if (!a.active) return ['Masquée', 'gris'];
  if (a.fin && a.fin < aujourdhui()) return ['Terminée', 'gris'];
  if (a.debut && a.debut > aujourdhui()) return [`Programmée le ${dateFr(a.debut)}`, 'orange'];
  return ['En ligne', 'vert'];
}

function afficherAnnonces() {
  const ul = $('#liste-annonces');
  const liste = etat.contenu.annonces;
  const visibles = liste.map((a, i) => i).filter((i) => !liste[i].emplacement);
  if (!visibles.length) {
    ul.innerHTML = '<li class="vide">Aucune annonce pour le moment. Créez-en une pour mettre en avant une offre ou une information.</li>';
    return;
  }
  ul.innerHTML = visibles.map((i, k) => {
    const a = liste[i];
    const [statut, couleur] = statutAnnonce(a);
    const pages = a.pages.includes('toutes') ? 'Toutes les pages' : a.pages.map((p) => PAGES.find(([f]) => f === p)?.[1]).filter(Boolean).join(', ');
    const image = a.image?.src && a.format !== 'encadre' && a.format !== 'bandeau' ? `<img class="liste__image" src="${urlImage(a.image.src)}" alt="">` : `<span class="liste__icone" aria-hidden="true">${a.format === 'bandeau' ? '▬' : '✦'}</span>`;
    return `
      <li>
        ${image}
        <button type="button" class="liste__texte" data-annonce="${i}">
          <strong>${echapper(a.titre || a.texte)}</strong>
          <small>${FORMATS[a.format]} · ${echapper(pages)}${a.fin ? ` · jusqu’au ${dateFr(a.fin)}` : ''}</small>
          <span class="pastille pastille--${couleur}">${statut}</span>
        </button>
        <span class="liste__ordre">
          <button type="button" data-a-monter="${k}" aria-label="Monter l’annonce" ${k === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-a-descendre="${k}" aria-label="Descendre l’annonce" ${k === visibles.length - 1 ? 'disabled' : ''}>▼</button>
        </span>
      </li>`;
  }).join('');
}

$('#liste-annonces').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const l = etat.contenu.annonces;
  if (b.dataset.annonce !== undefined) return ouvrirAnnonce(Number(b.dataset.annonce));
  const visibles = l.map((a, x) => x).filter((x) => !l[x].emplacement);
  const k = Number(b.dataset.aMonter ?? b.dataset.aDescendre);
  const i = visibles[k];
  const j = visibles[b.dataset.aMonter !== undefined ? k - 1 : k + 1];
  [l[i], l[j]] = [l[j], l[i]];
  afficherAnnonces();
  changement();
});

$('#ajouter-annonce').addEventListener('click', () => ouvrirAnnonce(-1));

$('#a-bouton-page').innerHTML = PAGES.map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
$('#a-pages').innerHTML = PAGES.map(([f, n]) => `<label class="case"><input type="checkbox" value="${f}"><span>${n}</span></label>`).join('');

let ficheAnnonce = null; // { index, a }

function ouvrirAnnonce(index, { page } = {}) {
  const a = index >= 0 ? structuredClone(etat.contenu.annonces[index]) : {
    id: `${page ? 'section' : 'annonce'}-${Date.now().toString(36)}`, active: true, format: 'section', etiquette: '', titre: '', texte: '',
    image: null, bouton: { texte: '', type: 'whatsapp', valeur: '' }, pages: [page || 'index.html'], debut: '', fin: '', fond: 'clair',
    ...(page ? { emplacement: { page, apres: sections.filter((x) => !x.premiere).slice(-2, -1)[0]?.id || 'fin' } } : {}),
  };
  a.bouton = a.bouton || { texte: '', type: 'whatsapp', valeur: '' };
  if (a.format === 'cartes' && !a.cartes) a.cartes = [];
  ficheAnnonce = { index, a };
  const section = Boolean(a.emplacement);
  $('#annonce-titre-fiche').textContent = section ? (index >= 0 ? 'Modifier la section' : 'Nouvelle section') : (index >= 0 ? 'Modifier l’annonce' : 'Nouvelle annonce');
  // Emplacement : « après » une des sections de la page (sauf elle-même)
  if (section) {
    $('#a-apres').innerHTML = sections.filter((x) => x.id !== `a-${a.id}`).map((x) => `<option value="${x.id}">${echapper(x.titre)}</option>`).join('') + '<option value="fin">Tout en bas de la page</option>';
    $('#a-apres').value = [...$('#a-apres').options].some((o) => o.value === a.emplacement.apres) ? a.emplacement.apres : 'fin';
  }
  $('#a-etiquette').value = a.etiquette || '';
  $('#a-titre').value = a.titre || '';
  $('#a-texte').value = a.texte || '';
  $('#a-bouton-texte').value = a.bouton.texte || '';
  $('#a-bouton-type').value = a.bouton.type || 'whatsapp';
  $('#a-bouton-wa').value = a.bouton.type === 'whatsapp' ? a.bouton.valeur || '' : '';
  $('#a-bouton-page').value = a.bouton.type === 'page' ? a.bouton.valeur || 'contact.html' : 'contact.html';
  $('#a-bouton-tel').value = a.bouton.type === 'telephone' ? a.bouton.valeur || '' : etat.contenu.telephones.principal;
  $('#a-bouton-url').value = a.bouton.type === 'externe' ? a.bouton.valeur || '' : '';
  $('#a-toutes').checked = a.pages.includes('toutes');
  $$('#a-pages input').forEach((c) => { c.checked = a.pages.includes(c.value); });
  $('#a-debut').value = a.debut || '';
  $('#a-fin').value = a.fin || '';
  $('#a-active').checked = a.active !== false;
  $('#a-alt').value = a.image?.alt || '';
  $('#a-supprimer').hidden = index < 0;
  $('#a-erreur').hidden = true;
  majFicheAnnonce();
  $('#fiche-annonce').showModal();
  $('#fiche-annonce').scrollTop = 0;
}

// Adapte la fiche au format choisi (champs utiles seulement) et au type de destination du bouton
function majFicheAnnonce() {
  const a = ficheAnnonce.a;
  $$('#a-formats button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.format === a.format)));
  $$('#a-dispositions button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.disposition === (a.disposition || 'gauche'))));
  $$('#a-fonds button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fond === (a.fond || 'clair'))));
  const section = Boolean(a.emplacement);
  $('[data-format="bandeau"]').hidden = section;
  $('#a-bloc-pages').hidden = section;
  $('#a-bloc-emplacement').hidden = !section;
  $('#a-active-texte').textContent = section ? 'Section visible sur le site' : 'Annonce active';
  $('#a-bloc-fond').hidden = a.format === 'bandeau' || a.format === 'appel';
  $('#a-bloc-cartes').hidden = a.format !== 'cartes';
  if (a.format === 'cartes') afficherCartes();
  const bandeau = a.format === 'bandeau';
  const avecImage = a.format === 'section' || a.format === 'carte';
  $('#a-bloc-etiquette').hidden = bandeau;
  $('#a-bloc-titre').hidden = bandeau;
  $('#a-texte-label').textContent = bandeau ? 'Message (une phrase courte)' : 'Texte';
  const max = bandeau ? 160 : 400;
  $('#a-texte').maxLength = max;
  $('#a-texte-max').textContent = max;
  $('#a-texte-compte').textContent = $('#a-texte').value.length;
  $('#a-bloc-image').hidden = !avecImage;
  $('#a-bouton-texte').placeholder = bandeau ? 'Ex. : En savoir plus' : 'Ex. : Je réserve sur WhatsApp';
  const type = $('#a-bouton-type').value;
  $('#a-bloc-destination').hidden = !$('#a-bouton-texte').value.trim();
  ['whatsapp', 'page', 'telephone', 'externe'].forEach((t) => { $(`#a-dest-${t}`).hidden = t !== type; });
  if (!$('#a-bouton-wa').value) $('#a-bouton-wa').placeholder = `Bonjour Nelly, je suis intéressée par : ${$('#a-titre').value || 'votre offre'}.`;
  $('#a-pages').hidden = $('#a-toutes').checked;
  // Image et cadrage
  const img = a.image;
  $('#a-cadreur').hidden = !img;
  $('#a-image-retirer').hidden = !img;
  $('#a-image-bouton').firstChild.textContent = img ? 'Remplacer l’image' : 'Ajouter une image';
  if (img) {
    const ratios = a.disposition === 'dessus' ? ['16 / 7', '4 / 3'] : a.format === 'carte' ? ['1 / 1', '16 / 10'] : ['4 / 5', '4 / 3'];
    $$('.cadreur__cadre').forEach((cadre, i) => {
      cadre.style.aspectRatio = ratios[i];
      const im = $('img', cadre);
      const src = etat.nouvelles.get(img.src)?.apercu || `/${img.src}-sm.jpg`;
      if (im.getAttribute('src') !== src) im.src = src;
      im.style.objectPosition = `${img.x}% ${img.y}%`;
      im.style.transform = `scale(${img.zoom})`;
      im.style.transformOrigin = `${img.x}% ${img.y}%`;
    });
  }
}

$('#a-dispositions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-disposition]');
  if (!b) return;
  ficheAnnonce.a.disposition = b.dataset.disposition;
  majFicheAnnonce();
});

$('#a-formats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-format]');
  if (!b) return;
  ficheAnnonce.a.format = b.dataset.format;
  if (b.dataset.format === 'cartes' && !(ficheAnnonce.a.cartes || []).length) ficheAnnonce.a.cartes = [{ titre: '', texte: '', image: null }, { titre: '', texte: '', image: null }];
  majFicheAnnonce();
});
$('#a-fonds').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fond]');
  if (!b) return;
  ficheAnnonce.a.fond = b.dataset.fond;
  majFicheAnnonce();
});

// Grille de cartes : 2 ou 3 cartes (titre, texte, image recadrable)
function afficherCartes() {
  const cartes = ficheAnnonce.a.cartes;
  $('#a-cartes').innerHTML = cartes.map((c, i) => `
    <fieldset class="bloc-bouton" data-carte="${i}">
      <legend>Carte ${i + 1}</legend>
      <label>Titre<input data-c-champ="titre" maxlength="60" value="${echapper(c.titre || '')}"></label>
      <label>Texte<textarea data-c-champ="texte" maxlength="300" rows="2">${echapper(c.texte || '')}</textarea></label>
      ${c.image ? `<div class="cadreur__cadre cadre-carte" style="aspect-ratio: 4 / 3"><img alt="" src="${etat.nouvelles.get(c.image.src)?.apercu || `/${c.image.src}-sm.jpg`}" style="object-position: ${c.image.x}% ${c.image.y}%"></div>` : ''}
      <div class="ligne-boutons">
        <label class="bouton bouton--contour bouton--fichier">${c.image ? 'Remplacer l’image' : 'Ajouter une image'}<input type="file" data-c-image accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label>
        ${c.image ? '<button type="button" class="bouton bouton--discret" data-c-centre>Recentrer</button><button type="button" class="bouton bouton--danger" data-c-sans-image>Sans image</button>' : ''}
        ${cartes.length > 2 ? '<button type="button" class="bouton bouton--danger" data-c-retirer>Retirer la carte</button>' : ''}
      </div>
    </fieldset>`).join('');
  $('#a-carte-ajouter').hidden = cartes.length >= 3;
}
$('#a-cartes').addEventListener('input', (e) => {
  const champ = e.target.dataset.cChamp;
  if (champ) ficheAnnonce.a.cartes[Number(e.target.closest('[data-carte]').dataset.carte)][champ] = e.target.value;
});
$('#a-cartes').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-c-image]')) return;
  const i = Number(e.target.closest('[data-carte]').dataset.carte);
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const image = await preparerImageLibre(f);
    const src = nouveauNom('img/annonces', `carte-${i + 1}`);
    etat.nouvelles.set(src, image);
    ficheAnnonce.a.cartes[i].image = { src, x: 50, y: 50, zoom: 1, largeur: image.largeur, hauteur: image.hauteur, alt: ficheAnnonce.a.cartes[i].titre || '' };
    afficherCartes();
  } catch (err) { $('#a-erreur').textContent = err.message; $('#a-erreur').hidden = false; }
});
$('#a-cartes').addEventListener('click', (e) => {
  const bloc = e.target.closest('[data-carte]');
  if (!bloc) return;
  const i = Number(bloc.dataset.carte);
  const c = ficheAnnonce.a.cartes[i];
  if (e.target.closest('[data-c-retirer]')) ficheAnnonce.a.cartes.splice(i, 1);
  else if (e.target.closest('[data-c-sans-image]')) c.image = null;
  else if (e.target.closest('[data-c-centre]')) Object.assign(c.image, { x: 50, y: 50 });
  else return;
  afficherCartes();
});
let glisseCarte = null;
$('#a-cartes').addEventListener('pointerdown', (e) => {
  const cadre = e.target.closest('.cadre-carte');
  if (!cadre) return;
  const c = ficheAnnonce.a.cartes[Number(cadre.closest('[data-carte]').dataset.carte)];
  glisseCarte = { cadre, c, px: e.clientX, py: e.clientY, x: c.image.x, y: c.image.y };
  cadre.setPointerCapture(e.pointerId);
});
$('#a-cartes').addEventListener('pointermove', (e) => {
  if (!glisseCarte) return;
  const r = glisseCarte.cadre.getBoundingClientRect();
  const im = glisseCarte.c.image;
  im.x = Math.round(Math.min(100, Math.max(0, glisseCarte.x - ((e.clientX - glisseCarte.px) / r.width) * 100)));
  im.y = Math.round(Math.min(100, Math.max(0, glisseCarte.y - ((e.clientY - glisseCarte.py) / r.height) * 100)));
  $('img', glisseCarte.cadre).style.objectPosition = `${im.x}% ${im.y}%`;
});
['pointerup', 'pointercancel'].forEach((t) => $('#a-cartes').addEventListener(t, () => { glisseCarte = null; }));
$('#a-carte-ajouter').addEventListener('click', () => {
  if (ficheAnnonce.a.cartes.length < 3) ficheAnnonce.a.cartes.push({ titre: '', texte: '', image: null });
  afficherCartes();
});
['#a-texte', '#a-bouton-texte', '#a-titre'].forEach((s) => $(s).addEventListener('input', majFicheAnnonce));
['#a-bouton-type', '#a-toutes'].forEach((s) => $(s).addEventListener('change', majFicheAnnonce));

$('#a-image').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const erreur = $('#a-erreur');
  erreur.hidden = true;
  try {
    const image = await preparerImageLibre(f);
    const src = nouveauNom('img/annonces', versCle($('#a-titre').value || 'annonce').slice(0, 30));
    etat.nouvelles.set(src, image);
    ficheAnnonce.a.image = { src, x: 50, y: 50, zoom: 1, largeur: image.largeur, hauteur: image.hauteur, alt: $('#a-alt').value };
    majFicheAnnonce();
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
  }
});
$('#a-image-retirer').addEventListener('click', () => { ficheAnnonce.a.image = null; majFicheAnnonce(); });

// Cadrage : faire glisser l'image, agrandir, réduire, recentrer
$$('[data-cadrage]').forEach((b) => b.addEventListener('click', () => {
  const img = ficheAnnonce.a.image;
  if (!img) return;
  if (b.dataset.cadrage === 'plus') img.zoom = Math.min(2.5, Math.round((img.zoom + 0.15) * 100) / 100);
  if (b.dataset.cadrage === 'moins') img.zoom = Math.max(1, Math.round((img.zoom - 0.15) * 100) / 100);
  if (b.dataset.cadrage === 'centre') Object.assign(img, { x: 50, y: 50, zoom: 1 });
  majFicheAnnonce();
}));
$$('.cadreur__cadre').forEach((cadre) => {
  let depart = null;
  cadre.addEventListener('pointerdown', (e) => {
    if (!ficheAnnonce.a.image) return;
    depart = { px: e.clientX, py: e.clientY, x: ficheAnnonce.a.image.x, y: ficheAnnonce.a.image.y };
    cadre.setPointerCapture(e.pointerId);
    cadre.classList.add('est-deplace');
  });
  cadre.addEventListener('pointermove', (e) => {
    if (!depart) return;
    const r = cadre.getBoundingClientRect();
    const img = ficheAnnonce.a.image;
    // Glisser vers la droite montre la partie gauche de l'image (le point de cadrage recule)
    img.x = Math.round(Math.min(100, Math.max(0, depart.x - ((e.clientX - depart.px) / r.width) * 100 / img.zoom)));
    img.y = Math.round(Math.min(100, Math.max(0, depart.y - ((e.clientY - depart.py) / r.height) * 100 / img.zoom)));
    majFicheAnnonce();
  });
  const fin = () => { depart = null; cadre.classList.remove('est-deplace'); };
  cadre.addEventListener('pointerup', fin);
  cadre.addEventListener('pointercancel', fin);
});

$('#form-annonce').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'valider') return;
  const a = ficheAnnonce.a;
  a.etiquette = $('#a-etiquette').value.trim();
  a.titre = $('#a-titre').value.trim();
  a.texte = $('#a-texte').value.trim();
  if (a.image) a.image.alt = $('#a-alt').value.trim();
  const type = $('#a-bouton-type').value;
  const valeurs = { whatsapp: $('#a-bouton-wa').value.trim() || $('#a-bouton-wa').placeholder, page: $('#a-bouton-page').value, telephone: $('#a-bouton-tel').value.trim(), externe: $('#a-bouton-url').value.trim() };
  a.bouton = { texte: $('#a-bouton-texte').value.trim(), type, valeur: valeurs[type] };
  if (a.emplacement) {
    a.emplacement = { page: a.emplacement.page, apres: $('#a-apres').value };
    a.pages = [a.emplacement.page];
  } else a.pages = $('#a-toutes').checked ? ['toutes'] : $$('#a-pages input:checked').map((c) => c.value);
  if (a.format === 'cartes') a.cartes = a.cartes.filter((c) => String(c.titre || '').trim() || String(c.texte || '').trim() || c.image).map((c) => ({ ...c, titre: String(c.titre || '').trim(), texte: String(c.texte || '').trim() }));
  else delete a.cartes;
  if (a.format === 'bandeau' || a.format === 'appel') delete a.fond;
  a.debut = $('#a-debut').value;
  a.fin = $('#a-fin').value;
  a.active = $('#a-active').checked;
  if (!['section', 'carte'].includes(a.format)) a.image = null;
  const erreur = verifierAnnonce(a);
  if (erreur) {
    e.preventDefault();
    $('#a-erreur').textContent = erreur;
    $('#a-erreur').hidden = false;
    $('#a-erreur').scrollIntoView({ block: 'center' });
    return;
  }
  if (ficheAnnonce.index < 0) etat.contenu.annonces.unshift(a);
  else etat.contenu.annonces[ficheAnnonce.index] = a;
  afficherAnnonces();
  changement();
  if (a.emplacement) chargerSections();
});

function verifierAnnonce(a) {
  if (a.format === 'bandeau' ? !a.texte : !a.titre) return a.format === 'bandeau' ? 'Écrivez le message du bandeau.' : `Donnez un titre ${a.emplacement ? 'à la section' : 'à l’annonce'}.`;
  if (a.format === 'cartes') {
    const cartes = (a.cartes || []).filter((c) => String(c.titre || '').trim());
    if ((a.cartes || []).some((c) => !String(c.titre || '').trim())) return 'Chaque carte a besoin d’un titre (ou retirez la carte vide).';
    if (cartes.length < 2) return 'La grille a besoin d’au moins 2 cartes.';
  }
  if ((a.format === 'section') && !a.image) return 'La grande section a besoin d’une image. Ajoutez-en une, ou choisissez « Encadré ».';
  if (a.bouton.texte) {
    if (a.bouton.type === 'externe' && !urlValide(a.bouton.valeur)) return 'L’adresse du bouton doit être complète et commencer par https:// (copiez-la depuis votre navigateur).';
    if (a.bouton.type === 'telephone' && !TEL.test(a.bouton.valeur)) return 'Le numéro du bouton doit ressembler à 06 12 34 56 78.';
  }
  if (!a.emplacement && !a.pages.length) return 'Choisissez au moins une page où afficher l’annonce.';
  if (a.debut && a.fin && a.fin < a.debut) return 'La date de fin est avant la date de début.';
  if (a.fin && a.fin < aujourdhui()) return 'La date de fin est déjà passée : l’annonce ne serait pas affichée.';
  return '';
}

$('#a-supprimer').addEventListener('click', () => {
  const a = etat.contenu.annonces[ficheAnnonce.index];
  if (!confirm(`Supprimer ${a.emplacement ? 'la section' : 'l’annonce'} « ${a.titre || a.texte} » ?\n\nAstuce : pour la retirer temporairement, décochez plutôt « Annonce active ».`)) return;
  etat.contenu.annonces.splice(ficheAnnonce.index, 1);
  $('#fiche-annonce').close();
  afficherAnnonces();
  changement();
  if (a.emplacement) chargerSections();
});

// --- Coiffures -------------------------------------------------------------------

function afficherCoiffures() {
  const ul = $('#liste-coiffures');
  const services = etat.contenu.services;
  ul.innerHTML = services.map((s, i) => `
    <li class="${s.visible === false ? 'est-masque' : ''}">
      <img class="liste__image" src="${urlImage(s.photo)}" alt="" loading="lazy">
      <button type="button" class="liste__texte" data-modifier="${i}">
        <strong>${echapper(s.nom)}${s.visible === false ? '<span class="badge">masquée</span>' : ''}</strong>
        <small>${echapper(s.categorie)} · ${echapper(s.description || '')}</small>
      </button>
      <span class="liste__prix">${s.prix} €</span>
      <span class="liste__ordre">
        <button type="button" data-monter="${i}" aria-label="Monter ${echapper(s.nom)}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" data-descendre="${i}" aria-label="Descendre ${echapper(s.nom)}" ${i === services.length - 1 ? 'disabled' : ''}>▼</button>
      </span>
    </li>`).join('');
  $('#categories').innerHTML = [...new Set(services.map((s) => s.categorie))].map((c) => `<option value="${echapper(c)}">`).join('');
}

$('#liste-coiffures').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const s = etat.contenu.services;
  if (b.dataset.modifier !== undefined) return ouvrirCoiffure(Number(b.dataset.modifier));
  const i = Number(b.dataset.monter ?? b.dataset.descendre);
  const j = b.dataset.monter !== undefined ? i - 1 : i + 1;
  [s[i], s[j]] = [s[j], s[i]];
  afficherCoiffures();
  changement();
});

$('#ajouter-coiffure').addEventListener('click', () => ouvrirCoiffure(-1));

let fiche = null; // { index, brouillon }

function ouvrirCoiffure(index) {
  const s = index >= 0 ? etat.contenu.services[index] : { nom: '', categorie: 'Tresses', description: '', prix: '', photo: '', visible: true };
  fiche = { index, brouillon: structuredClone(s) };
  $('#fiche-titre').textContent = index >= 0 ? 'Modifier la coiffure' : 'Nouvelle coiffure';
  $('#c-nom').value = s.nom;
  $('#c-prix').value = s.prix;
  $('#c-categorie').value = s.categorie;
  $('#c-description').value = s.description || '';
  $('#c-visible').checked = s.visible !== false;
  $('#c-supprimer').hidden = index < 0;
  $('#c-erreur').hidden = true;
  afficherChoixPhoto();
  $('#fiche-coiffure').showModal();
}

function afficherChoixPhoto() {
  const s = fiche.brouillon;
  const choix = [...new Set([s.photo, ...etat.contenu.photos.filter((p) => p.style === s.cle).map((p) => p.image)].filter(Boolean))];
  $('#c-photos').innerHTML = choix.length
    ? choix.map((img) => `<button type="button" data-photo="${img}" aria-pressed="${img === s.photo}" aria-label="Choisir cette photo"><img src="${urlImage(img)}" alt=""></button>`).join('')
    : '<p class="aide">Ajoutez une photo pour cette coiffure.</p>';
}

$('#c-photos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-photo]');
  if (!b) return;
  fiche.brouillon.photo = b.dataset.photo;
  afficherChoixPhoto();
});

$('#c-fichier').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const style = fiche.brouillon.cle || versCle($('#c-nom').value.trim() || 'coiffure');
    const img = nouveauNom(DOSSIER, style);
    etat.nouvelles.set(img, await preparerPhoto(f));
    fiche.brouillon.photo = img;
    afficherChoixPhoto();
  } catch (err) {
    $('#c-erreur').textContent = err.message;
    $('#c-erreur').hidden = false;
  }
});

$('#form-coiffure').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'valider') return;
  const s = fiche.brouillon;
  s.nom = $('#c-nom').value.trim();
  s.prix = Number($('#c-prix').value);
  s.categorie = $('#c-categorie').value.trim();
  s.description = $('#c-description').value.trim();
  s.visible = $('#c-visible').checked;
  const erreur = !s.nom ? 'Indiquez un nom.' : !(Number.isInteger(s.prix) && s.prix > 0) ? 'Indiquez un prix en euros (nombre entier).' : !s.categorie ? 'Indiquez une catégorie.' : !s.photo ? 'Choisissez ou ajoutez une photo.' : '';
  if (erreur) { e.preventDefault(); $('#c-erreur').textContent = erreur; $('#c-erreur').hidden = false; return; }
  if (fiche.index < 0) {
    // Nouvelle coiffure : identifiants uniques, utilisés dans les adresses des pages
    let cle = versCle(s.nom);
    const prises = new Set(etat.contenu.services.flatMap((x) => [x.cle, x.ancre]));
    for (let n = 2; prises.has(cle); n++) cle = `${versCle(s.nom)}-${n}`;
    s.cle = cle; s.ancre = cle; s.alt = `${s.nom}, exemple de coiffure`;
    // La photo prise pendant la création est rangée sous ce nom définitif
    if (etat.nouvelles.has(s.photo) && !s.photo.includes(`/${cle}-`)) {
      const img = nouveauNom(DOSSIER, cle);
      etat.nouvelles.set(img, etat.nouvelles.get(s.photo));
      etat.nouvelles.delete(s.photo);
      s.photo = img;
    }
    etat.contenu.services.push(s);
  } else {
    s.alt = etat.contenu.services[fiche.index].nom === s.nom ? s.alt : `${s.nom}, exemple de coiffure`;
    etat.contenu.services[fiche.index] = s;
  }
  afficherCoiffures();
  afficherPhotos();
  changement();
});

$('#c-supprimer').addEventListener('click', () => {
  const s = etat.contenu.services[fiche.index];
  const nb = etat.contenu.photos.filter((p) => p.style === s.cle).length;
  const msg = `Supprimer « ${s.nom} » du site${nb ? ` et ses ${nb} photo${nb > 1 ? 's' : ''} de la galerie` : ''} ?\n\nAstuce : pour la retirer temporairement, décochez plutôt « Visible sur le site ».`;
  if (!confirm(msg)) return;
  etat.contenu.services.splice(fiche.index, 1);
  etat.contenu.photos = etat.contenu.photos.filter((p) => p.style !== s.cle);
  $('#fiche-coiffure').close();
  afficherCoiffures();
  afficherPhotos();
  changement();
});

// --- Photos ----------------------------------------------------------------------

function afficherPhotos() {
  const services = etat.contenu.services;
  const options = services.map((s) => `<option value="${s.cle}">${echapper(s.nom)}</option>`).join('');
  const choixStyle = $('#photo-style').value;
  const choixFiltre = $('#photo-filtre').value;
  $('#photo-style').innerHTML = options;
  if (services.some((s) => s.cle === choixStyle)) $('#photo-style').value = choixStyle;
  $('#photo-filtre').innerHTML = `<option value="">Toutes les photos (${etat.contenu.photos.length})</option>${services.map((s) => {
    const n = etat.contenu.photos.filter((p) => p.style === s.cle).length;
    return n ? `<option value="${s.cle}">${echapper(s.nom)} (${n})</option>` : '';
  }).join('')}`;
  if ([...$('#photo-filtre').options].some((o) => o.value === choixFiltre)) $('#photo-filtre').value = choixFiltre;
  const filtre = $('#photo-filtre').value;
  $('#grille-photos').innerHTML = etat.contenu.photos.map((p, i) => ({ p, i })).filter(({ p }) => !filtre || p.style === filtre).map(({ p, i }) => {
    const s = services.find((x) => x.cle === p.style);
    return `<button type="button" data-photo="${i}" aria-label="Photo ${echapper(s ? s.nom : p.style)}"><img src="${urlImage(p.image)}" alt="" loading="lazy">${etat.nouvelles.get(p.image)?.grand ? '<span class="badge">nouvelle</span>' : ''}<small>${echapper(s ? s.nom : p.style)}</small></button>`;
  }).join('');
}

$('#photo-filtre').addEventListener('change', afficherPhotos);

$('#photo-fichiers').addEventListener('change', async (e) => {
  const fichiers = [...e.target.files];
  e.target.value = '';
  const style = $('#photo-style').value;
  const msg = $('#photo-message');
  if (!fichiers.length || !style) return;
  msg.className = 'message'; msg.hidden = false;
  msg.innerHTML = '<span class="chargement"></span> Préparation des photos…';
  let ajoutees = 0;
  let probleme = '';
  for (const f of fichiers) {
    try {
      const photo = await preparerPhoto(f);
      if (tailleEnvoi() + photo.grand.length + photo.petit.length > MAX_ENVOI) {
        probleme = 'Limite d’envoi atteinte : publiez d’abord ces photos, puis ajoutez les suivantes.';
        break;
      }
      const img = nouveauNom(DOSSIER, style);
      etat.nouvelles.set(img, photo);
      etat.contenu.photos.unshift({ style, image: img });
      ajoutees += 1;
    } catch (err) {
      probleme = err.message;
    }
  }
  msg.className = probleme ? 'message message--erreur' : 'message message--ok';
  msg.textContent = `${ajoutees ? `${ajoutees} photo${ajoutees > 1 ? 's' : ''} prête${ajoutees > 1 ? 's' : ''}. ` : ''}${probleme || 'Appuyez sur « Publier » pour les mettre en ligne.'}`;
  afficherPhotos();
  afficherCoiffures();
  changement();
});

let photoOuverte = -1;
$('#grille-photos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-photo]');
  if (!b) return;
  photoOuverte = Number(b.dataset.photo);
  const p = etat.contenu.photos[photoOuverte];
  $('#p-image').src = etat.nouvelles.get(p.image)?.apercu || `/${p.image}.jpg`;
  $('#p-style').innerHTML = etat.contenu.services.map((s) => `<option value="${s.cle}">${echapper(s.nom)}</option>`).join('');
  $('#p-style').value = p.style;
  $('#fiche-photo').showModal();
});
$('#p-style').addEventListener('change', (e) => {
  etat.contenu.photos[photoOuverte].style = e.target.value;
  afficherPhotos();
  changement();
});
$('#p-supprimer').addEventListener('click', () => {
  const p = etat.contenu.photos[photoOuverte];
  if (etat.contenu.services.some((s) => s.photo === p.image)) {
    alert('Cette photo sert de photo principale à une coiffure. Choisissez d’abord une autre photo pour cette coiffure (onglet Coiffures).');
    return;
  }
  if (!confirm('Retirer cette photo du site ?')) return;
  etat.contenu.photos.splice(photoOuverte, 1);
  $('#fiche-photo').close();
  afficherPhotos();
  changement();
});

// --- Logo et image de fond ----------------------------------------------------------

const CREME = [246, 230, 212];
let logoCharge = null; // image choisie, gardée pour pouvoir changer l'option « retirer le fond » sans la recharger

// Logo → PNG transparent recadré au plus près (600 px de large au plus) + version claire pour le fond sombre
// (les parties foncées passent en crème, le cuivre est conservé : même règle que le logo d'origine)
function traiterLogo(img, retirerFond) {
  const echelle = Math.min(1, 1200 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * echelle)); c.height = Math.max(1, Math.round(img.naturalHeight * echelle));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const donnees = ctx.getImageData(0, 0, c.width, c.height);
  const d = donnees.data;
  const px = (x, y) => (y * c.width + x) * 4;
  const coins = [px(0, 0), px(c.width - 1, 0), px(0, c.height - 1), px(c.width - 1, c.height - 1)].map((i) => [d[i], d[i + 1], d[i + 2], d[i + 3]]);
  const ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const fondUni = coins.every((x) => x[3] > 250 && ecart(x, coins[0]) < 25);
  if (retirerFond && fondUni) {
    const f = [0, 1, 2].map((k) => coins.reduce((t, x) => t + x[k], 0) / 4);
    for (let i = 0; i < d.length; i += 4) {
      const e = ecart([d[i], d[i + 1], d[i + 2]], f);
      if (e < 28) d[i + 3] = 0;
      else if (e < 60) d[i + 3] = Math.round(d[i + 3] * ((e - 28) / 32));
    }
  }
  // Recadrage sur les parties visibles
  let x0 = c.width; let y0 = c.height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[px(x, y) + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('Le logo semble vide. Choisissez une autre image.');
  ctx.putImageData(donnees, 0, 0);
  let l = x1 - x0 + 1; const h = y1 - y0 + 1;
  // Logo très haut : marges transparentes sur les côtés, pour garder une taille raisonnable dans l'en-tête
  const lCadre = Math.max(l, Math.ceil(h / 0.85));
  const rendre = (largeur, clair) => {
    const k = largeur / lCadre;
    const s = document.createElement('canvas');
    s.width = largeur; s.height = Math.max(1, Math.round(h * k));
    const sc = s.getContext('2d', { willReadFrequently: true });
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(c, x0, y0, l, h, Math.round(((lCadre - l) / 2) * k), 0, Math.round(l * k), s.height);
    if (clair) {
      const im = sc.getImageData(0, 0, s.width, s.height);
      const p = im.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const t = Math.max(0, Math.min(1, (120 - (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2])) / 70));
        if (t > 0) for (let q = 0; q < 3; q++) p[i + q] = Math.round(p[i + q] * (1 - t) + CREME[q] * t);
      }
      sc.putImageData(im, 0, 0);
    }
    return { url: s.toDataURL('image/png'), largeur: s.width, hauteur: s.height };
  };
  // Taille de fichier limitée : on réduit la largeur si besoin
  for (const largeur of [Math.min(600, lCadre), 480, 360]) {
    const grand = rendre(largeur, false);
    const petit = rendre(largeur, true);
    if ((grand.url.length + petit.url.length) * 0.75 < 1.4 * 1024 * 1024 || largeur === 360) {
      return { grand: grand.url.split(',')[1], petit: petit.url.split(',')[1], apercu: grand.url, apercuClair: petit.url, ext: 'png', largeur: grand.largeur, hauteur: grand.hauteur, fondUni };
    }
  }
}

function appliquerLogoCharge() {
  const logo = traiterLogo(logoCharge, $('#logo-retirer-fond').checked);
  const actuel = etat.contenu.marque?.logo?.src;
  const deja = etat.nouvelles.get(actuel);
  if (tailleEnvoi() - (deja?.grand ? deja.grand.length + deja.petit.length : 0) + logo.grand.length + logo.petit.length > MAX_ENVOI) throw new Error('Trop d’images en attente : publiez d’abord vos modifications, puis changez le logo.');
  const src = etat.contenu.marque?.logo?.src && etat.nouvelles.has(etat.contenu.marque.logo.src) ? etat.contenu.marque.logo.src : nouveauNom('img/marque', 'logo');
  etat.nouvelles.set(src, logo);
  etat.contenu.marque = { logo: { src, largeur: logo.largeur, hauteur: logo.hauteur } };
  $('#logo-option-fond').hidden = !logo.fondUni;
  afficherMarque();
  changement();
}

$('#logo-fichier').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const erreur = $('#logo-erreur');
  erreur.hidden = true;
  try {
    const { img } = await chargerImage(f);
    logoCharge = img;
    $('#logo-retirer-fond').checked = true;
    appliquerLogoCharge();
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
  }
});
$('#logo-retirer-fond').addEventListener('change', () => { if (logoCharge) appliquerLogoCharge(); });
$('#logo-origine').addEventListener('click', () => {
  delete etat.contenu.marque;
  logoCharge = null;
  $('#logo-option-fond').hidden = true;
  afficherMarque();
  changement();
});

$('#fond-fichier').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const erreur = $('#fond-erreur');
  erreur.hidden = true;
  try {
    const image = await preparerImageLibre(f);
    if (tailleEnvoi() + image.grand.length + image.petit.length > MAX_ENVOI) throw new Error('Trop d’images en attente : publiez d’abord vos modifications, puis changez l’image.');
    const src = nouveauNom('img/pages', 'fond-rendez-vous');
    etat.nouvelles.set(src, image);
    etat.contenu.fonds = { cta: src };
    afficherMarque();
    changement();
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
  }
});
$('#fond-origine').addEventListener('click', () => {
  delete etat.contenu.fonds;
  afficherMarque();
  changement();
});

function afficherMarque() {
  const logo = etat.contenu.marque?.logo;
  const n = logo && etat.nouvelles.get(logo.src);
  $('#logo-apercu').src = logo ? n?.apercu || `/${logo.src}.png` : '/img/marque/logo.webp';
  $('#logo-apercu-clair').src = logo ? n?.apercuClair || `/${logo.src}-clair.png` : '/img/marque/logo-clair.webp';
  $('#logo-origine').hidden = !logo;
  if (!logo || !n) $('#logo-option-fond').hidden = true;
  const fond = etat.contenu.fonds?.cta;
  $('#fond-apercu').src = fond ? urlImage(fond) : '/img/maquette/cta-tresses-sm.webp';
  $('#fond-origine').hidden = !fond;
}

// --- Infos : horaires, téléphones, réseaux ----------------------------------------

function afficherPalettes() {
  $$('#palettes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === (etat.contenu.theme || 'cuivre'))));
}
$('#palettes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme]');
  if (!b) return;
  if (b.dataset.theme === 'cuivre') delete etat.contenu.theme; else etat.contenu.theme = b.dataset.theme;
  afficherPalettes();
  changement();
});

function afficherInfos() {
  afficherPalettes();
  afficherMarque();
  $('#liste-horaires').innerHTML = etat.contenu.horaires.map((j, i) => `
    <div class="jour">
      <strong>${j.jour}</strong>
      <select data-jour="${i}" data-champ="etat" aria-label="${j.jour}">
        <option value="ouvert" ${j.etat === 'ouvert' ? 'selected' : ''}>Ouvert</option>
        <option value="demande" ${j.etat === 'demande' ? 'selected' : ''}>Sur demande</option>
        <option value="ferme" ${j.etat === 'ferme' ? 'selected' : ''}>Fermé</option>
      </select>
      <div class="jour__heures" ${j.etat === 'ouvert' ? '' : 'hidden'}>
        <input type="time" data-jour="${i}" data-champ="debut" value="${j.debut}" aria-label="${j.jour}, ouverture" step="900">
        <span>à</span>
        <input type="time" data-jour="${i}" data-champ="fin" value="${j.fin}" aria-label="${j.jour}, fermeture" step="900">
      </div>
    </div>`).join('');
  $('#tel-principal').value = etat.contenu.telephones.principal;
  $('#tel-secondaire').value = etat.contenu.telephones.secondaire;
  verifierTelephones();
  const aide = $('#liste-reseaux .aide').outerHTML;
  $('#liste-reseaux').innerHTML = aide + Object.entries(RESEAUX).map(([cle, nom]) => `
    <label for="r-${cle}">${nom}</label>
    <div class="champ-lien">
      <input id="r-${cle}" type="url" inputmode="url" data-reseau="${cle}" value="${echapper(etat.contenu.reseaux[cle])}" placeholder="${cle === 'instagram' ? '' : 'Laisser vide si vous n’avez pas ce réseau'}">
      <a class="bouton bouton--discret" href="${echapper(etat.contenu.reseaux[cle])}" target="_blank" rel="noopener" data-tester="${cle}">Tester</a>
    </div>
    <p class="message message--erreur" id="erreur-r-${cle}" ${reseauValide(cle, etat.contenu.reseaux[cle]) ? 'hidden' : ''}>Adresse incomplète : elle doit commencer par https://</p>`).join('');
}

$('#liste-horaires').addEventListener('change', (e) => {
  const el = e.target.closest('[data-jour]');
  if (!el) return;
  const j = etat.contenu.horaires[Number(el.dataset.jour)];
  j[el.dataset.champ] = el.value;
  if (el.dataset.champ === 'etat') {
    if (j.etat === 'ouvert' && !j.debut) { j.debut = '09:00'; j.fin = '19:00'; }
    if (j.etat !== 'ouvert') { j.debut = ''; j.fin = ''; }
    afficherInfos();
  }
  changement();
});

function verifierTelephones() {
  for (const cle of ['principal', 'secondaire']) {
    const ok = TEL.test(String(etat.contenu.telephones[cle]).trim());
    const e = $(`#erreur-tel-${cle}`);
    e.textContent = 'Le numéro doit ressembler à 06 12 34 56 78.';
    e.hidden = ok;
  }
}
['principal', 'secondaire'].forEach((cle) => $(`#tel-${cle}`).addEventListener('input', (e) => {
  etat.contenu.telephones[cle] = e.target.value;
  verifierTelephones();
  changement({ regrouper: true });
}));

$('#liste-reseaux').addEventListener('input', (e) => {
  const cle = e.target.dataset.reseau;
  if (!cle) return;
  etat.contenu.reseaux[cle] = e.target.value.trim();
  const ok = urlValide(e.target.value);
  $(`#erreur-r-${cle}`).hidden = reseauValide(cle, e.target.value);
  $(`[data-tester="${cle}"]`).href = ok ? e.target.value.trim() : '#';
  changement({ regrouper: true });
});

// --- Menu et pied de page ----------------------------------------------------------

let ficheNav = null; // copie de travail, appliquée au contenu seulement à « Valider »

const nomPage = (v) => {
  const [f, ancre] = String(v).split('#');
  const n = (PAGES.find(([x]) => x === f) || [])[1] || f;
  return ancre ? `${n} › ${ancre.replace(/-/g, ' ')}` : n;
};
// Choix de page : les pages du site, plus la destination actuelle si elle vise un endroit précis d'une page
const optionsPage = (choisie) => [...PAGES.map(([f]) => f), ...(PAGES.some(([f]) => f === choisie) ? [] : [choisie])]
  .map((v) => `<option value="${echapper(v)}" ${v === choisie ? 'selected' : ''}>${echapper(nomPage(v))}</option>`).join('');
const ordre = (chemin, i, n) => `
  <button type="button" class="bouton bouton--discret" data-nav-monter="${chemin}" data-i="${i}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
  <button type="button" class="bouton bouton--discret" data-nav-descendre="${chemin}" data-i="${i}" aria-label="Descendre" ${i === n - 1 ? 'disabled' : ''}>↓</button>
  <button type="button" class="bouton bouton--danger" data-nav-retirer="${chemin}" data-i="${i}" aria-label="Retirer">✕</button>`;

function afficherNav() {
  const n = ficheNav;
  $('#nav-menu').innerHTML = n.menu.map((x, i) => `
    <div class="ligne-nav" data-menu="${i}">
      <input data-champ="texte" maxlength="30" value="${echapper(x.texte)}" aria-label="Nom du lien ${i + 1}">
      <select data-champ="page" aria-label="Page du lien ${i + 1}">${optionsPage(x.page)}</select>
      <span class="ligne-nav__ordre">${ordre('menu', i, n.menu.length)}</span>
    </div>`).join('');
  $('#nav-menu-ajouter').hidden = n.menu.length >= 7;
  $('#nav-rdv-texte').value = n.rendezVous.texte;
  $('#nav-rdv-court').value = n.rendezVous.court || '';
  $('#nav-rdv-message').value = n.rendezVous.message;
  $('#nav-invite').value = n.pied.invite;
  $('#nav-presentation').value = n.pied.presentation;
  $('#nav-infos').value = n.pied.infos.join('\n');
  $('#nav-colonnes').innerHTML = n.pied.colonnes.map((c, ci) => `
    <fieldset class="bloc-bouton" data-colonne="${ci}">
      <legend>Colonne ${ci + 1}</legend>
      <label>Titre de la colonne<input data-champ="titre" maxlength="40" value="${echapper(c.titre)}"></label>
      ${c.liens.map((l, li) => `
      <div class="ligne-nav" data-lien="${li}">
        <input data-champ="texte" maxlength="40" value="${echapper(l.texte)}" aria-label="Texte du lien">
        <select data-champ="type" aria-label="Destination">
          <option value="page" ${l.lien.type === 'page' ? 'selected' : ''}>Page du site</option>
          <option value="externe" ${l.lien.type === 'externe' ? 'selected' : ''}>Autre site</option>
        </select>
        ${l.lien.type === 'externe'
          ? `<input data-champ="valeur" type="url" inputmode="url" placeholder="https://…" value="${echapper(l.lien.valeur)}" aria-label="Adresse du site">`
          : `<select data-champ="valeur" aria-label="Page">${optionsPage(l.lien.valeur)}</select>`}
        <span class="ligne-nav__ordre">${ordre(`col-${ci}`, li, c.liens.length)}</span>
      </div>`).join('')}
      <div class="ligne-nav__actions">
        ${c.liens.length < 10 ? `<button type="button" class="bouton bouton--contour" data-nav-ajouter-lien="${ci}">＋ Ajouter un lien</button>` : ''}
        <button type="button" class="bouton bouton--danger" data-nav-retirer-colonne="${ci}">Retirer la colonne</button>
      </div>
    </fieldset>`).join('');
  $('#nav-colonne-ajouter').hidden = n.pied.colonnes.length >= 3;
  $('#nav-erreur').hidden = true;
}

$('#ouvrir-nav').addEventListener('click', () => {
  ficheNav = structuredClone(etat.contenu.navigation || etat.navDefaut);
  afficherNav();
  $('#fiche-nav').showModal();
  $('#fiche-nav').scrollTop = 0;
});

// Chaque saisie met à jour la copie de travail (le contenu, lui, ne change qu'à « Valider »)
$('#form-nav').addEventListener('input', (e) => {
  const el = e.target;
  const n = ficheNav;
  const menu = el.closest('[data-menu]');
  const colonne = el.closest('[data-colonne]');
  const lien = el.closest('[data-lien]');
  if (menu) n.menu[Number(menu.dataset.menu)][el.dataset.champ] = el.value;
  else if (lien) {
    const l = n.pied.colonnes[Number(colonne.dataset.colonne)].liens[Number(lien.dataset.lien)];
    if (el.dataset.champ === 'texte') l.texte = el.value;
    else if (el.dataset.champ === 'valeur') l.lien.valeur = el.value.trim();
  } else if (colonne) n.pied.colonnes[Number(colonne.dataset.colonne)].titre = el.value;
  else if (el.id === 'nav-rdv-texte') n.rendezVous.texte = el.value;
  else if (el.id === 'nav-rdv-court') n.rendezVous.court = el.value;
  else if (el.id === 'nav-rdv-message') n.rendezVous.message = el.value;
  else if (el.id === 'nav-invite') n.pied.invite = el.value;
  else if (el.id === 'nav-presentation') n.pied.presentation = el.value;
  else if (el.id === 'nav-infos') n.pied.infos = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
});
$('#form-nav').addEventListener('change', (e) => {
  if (e.target.dataset.champ !== 'type') return;
  const colonne = e.target.closest('[data-colonne]');
  const l = ficheNav.pied.colonnes[Number(colonne.dataset.colonne)].liens[Number(e.target.closest('[data-lien]').dataset.lien)];
  l.lien = e.target.value === 'externe' ? { type: 'externe', valeur: '' } : { type: 'page', valeur: 'index.html' };
  afficherNav();
});

$('#form-nav').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const n = ficheNav;
  const liste = (chemin) => (chemin === 'menu' ? n.menu : n.pied.colonnes[Number(chemin.slice(4))].liens);
  const i = Number(b.dataset.i);
  if (b.dataset.navMonter || b.dataset.navDescendre) {
    const l = liste(b.dataset.navMonter || b.dataset.navDescendre);
    const j = b.dataset.navMonter ? i - 1 : i + 1;
    [l[i], l[j]] = [l[j], l[i]];
  } else if (b.dataset.navRetirer) {
    const l = liste(b.dataset.navRetirer);
    if (b.dataset.navRetirer === 'menu' && l.length <= 2) { alert('Le menu doit garder au moins 2 liens.'); return; }
    l.splice(i, 1);
  } else if (b.dataset.navAjouterLien) {
    n.pied.colonnes[Number(b.dataset.navAjouterLien)].liens.push({ texte: '', lien: { type: 'page', valeur: 'index.html' } });
  } else if (b.dataset.navRetirerColonne) {
    if (!confirm('Retirer cette colonne et tous ses liens ?')) return;
    n.pied.colonnes.splice(Number(b.dataset.navRetirerColonne), 1);
  } else if (b.id === 'nav-menu-ajouter') n.menu.push({ texte: '', page: 'index.html' });
  else if (b.id === 'nav-colonne-ajouter') n.pied.colonnes.push({ titre: '', liens: [{ texte: '', lien: { type: 'page', valeur: 'index.html' } }] });
  else if (b.id === 'nav-origine') {
    if (!confirm('Remettre le menu et le pied de page d’origine ?')) return;
    ficheNav = structuredClone(etat.navDefaut);
  } else return;
  afficherNav();
  const champ = b.id === 'nav-menu-ajouter' ? $('#nav-menu .ligne-nav:last-child input') : b.dataset.navAjouterLien ? $$(`[data-colonne="${b.dataset.navAjouterLien}"] [data-lien]`).at(-1).querySelector("input") : null;
  champ?.focus();
});

function verifierNav(n) {
  if (n.menu.some((x) => !x.texte.trim())) return 'Chaque lien du menu a besoin d’un nom.';
  if (!n.rendezVous.texte.trim()) return 'Le bouton de rendez-vous a besoin d’un texte.';
  for (const c of n.pied.colonnes) {
    if (!c.titre.trim()) return 'Chaque colonne du pied de page a besoin d’un titre.';
    for (const l of c.liens) {
      if (!l.texte.trim()) return `Un lien de la colonne « ${c.titre} » n’a pas de texte.`;
      if (l.lien.type === 'externe' && !urlValide(l.lien.valeur)) return `Lien « ${l.texte} » : l’adresse doit être complète et commencer par https://`;
    }
  }
  if (n.pied.infos.length > 5) return '5 lignes d’informations au maximum.';
  return '';
}

$('#nav-valider').addEventListener('click', (e) => {
  e.preventDefault();
  const n = ficheNav;
  n.menu.forEach((x) => { x.texte = x.texte.trim(); });
  n.pied.colonnes.forEach((c) => { c.titre = c.titre.trim(); c.liens.forEach((l) => { l.texte = l.texte.trim(); }); });
  const pb = verifierNav(n);
  if (pb) { $('#nav-erreur').textContent = pb; $('#nav-erreur').hidden = false; return; }
  if (JSON.stringify(n) === JSON.stringify(etat.navDefaut)) delete etat.contenu.navigation;
  else etat.contenu.navigation = structuredClone(n);
  $('#fiche-nav').close();
  changement();
});

// --- Historique ------------------------------------------------------------------

async function afficherHistorique() {
  const ul = $('#liste-historique');
  ul.innerHTML = '<li><span class="chargement"></span> Chargement…</li>';
  try {
    const { versions } = await api('historique');
    ul.innerHTML = versions.map((v, i) => `
      <li>
        <span class="liste__texte"><strong>${new Date(v.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</strong><small>${echapper(v.message.replace(/^Espace Nelly : /, ''))}</small></span>
        ${i === 0 ? '<span class="pastille pastille--vert">en ligne</span>' : `<button type="button" class="bouton bouton--contour" data-version="${v.sha}">Revenir</button>`}
      </li>`).join('');
  } catch (err) {
    ul.innerHTML = `<li class="message message--erreur">${echapper(err.message)}</li>`;
  }
}

$('#liste-historique').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-version]');
  if (!b) return;
  if (!confirm('Revenir à cette version ? Elle sera chargée ici : vérifiez-la (Aperçu) puis appuyez sur « Publier » pour la remettre en ligne.')) return;
  b.disabled = true;
  try {
    const { contenu } = await api('version', { params: `&sha=${b.dataset.version}` });
    etat.contenu = normaliser(contenu);
    changement();
    toutAfficher({ garderPile: true });
  } catch (err) {
    alert(err.message);
    b.disabled = false;
  }
});

// --- Pages : sections, textes, images, boutons ------------------------------------

$('#page-choix').innerHTML = PAGES.map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
let sections = []; // structure de la page affichée (fournie par le serveur, avec les modifications en cours)
// Adresse d'une image de page : depuis l'appareil si elle n'est pas encore publiée
const srcPage = (src) => etat.nouvelles.get(src.replace(/\.jpg$/, ''))?.apercu || `/${src}`;
const pageEnCours = () => $('#page-choix').value;
const modifsPage = (f = pageEnCours()) => {
  etat.contenu.pages[f] = etat.contenu.pages[f] || {};
  return etat.contenu.pages[f];
};
const nettoyerPage = (f = pageEnCours()) => {
  const p = etat.contenu.pages[f];
  if (!p) return;
  for (const k of ['textes', 'images', 'boutons']) if (p[k] && !Object.keys(p[k]).length) delete p[k];
  for (const k of ['ordre', 'masquees', 'inversees']) if (p[k] && !p[k].length) delete p[k];
  if (!Object.keys(p).length) delete etat.contenu.pages[f];
};

// La page s'affiche telle qu'elle sera publiée (même générateur que le site) dans l'éditeur visuel.
// Un seul appel fournit la page et sa structure (sections, textes, images, boutons).
let chargementPage = 0;
async function chargerSections({ defiler = null } = {}) {
  const n = ++chargementPage;
  const msg = $('#page-message');
  try {
    const { sections: liste, html } = await api('apercu', { methode: 'POST', corps: { contenu: etat.contenu, page: pageEnCours() } });
    if (n !== chargementPage) return;
    sections = liste;
    msg.hidden = true;
    afficherSections();
    await afficherEditeur(html, defiler);
  } catch (err) {
    msg.className = 'message message--erreur';
    msg.textContent = err.message;
    msg.hidden = false;
    $('#editeur-chargement').hidden = true;
  }
}

function afficherSections() {
  const ul = $('#liste-sections');
  ul.innerHTML = sections.map((s, i) => {
    const img = s.images[0];
    const vignette = img ? `<img class="liste__image" src="${srcPage(img.src)}" alt="">` : '<span class="liste__icone" aria-hidden="true">¶</span>';
    const details = [s.textes.length && `${s.textes.length} texte${s.textes.length > 1 ? 's' : ''}`, s.images.length && `${s.images.length} image${s.images.length > 1 ? 's' : ''}`, s.boutons.length && `${s.boutons.length} bouton${s.boutons.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    return `
      <li class="${s.masquee ? 'est-masque' : ''}" data-i="${i}">
        ${s.premiere ? '<span class="poignee poignee--fixe" aria-hidden="true"></span>' : `<span class="poignee" data-poignee="${i}" aria-hidden="true" title="Glisser pour déplacer">⠿</span>`}
        ${vignette}
        <button type="button" class="liste__texte" data-section="${i}">
          <strong>${echapper(s.titre)}${s.masquee ? '<span class="badge">masquée</span>' : ''}${s.inversee ? '<span class="badge">inversée</span>' : ''}</strong>
          <small>${s.ajout ? `${FORMATS[etat.contenu.annonces.find((a) => a.id === s.ajout)?.format] || 'Section'} · ajoutée par vous` : details || 'Section décorative'}</small>
        </button>
        ${s.premiere ? '<span class="pastille pastille--gris">fixe</span>' : `
        <button type="button" class="icone-sombre" data-masquer="${i}" aria-label="${s.masquee ? 'Réafficher' : 'Masquer'} la section ${echapper(s.titre)}" title="${s.masquee ? 'Réafficher' : 'Masquer'}">${s.masquee ? '◌' : '👁'}</button>
        <span class="liste__ordre">
          <button type="button" data-s-monter="${i}" aria-label="Monter la section" ${i <= 1 ? 'disabled' : ''}>▲</button>
          <button type="button" data-s-descendre="${i}" aria-label="Descendre la section" ${i === sections.length - 1 ? 'disabled' : ''}>▼</button>
        </span>`}
      </li>`;
  }).join('');
}

$('#page-choix').addEventListener('change', () => { ed.defilement = 0; chargerSections(); });
$('#ajouter-section').addEventListener('click', () => { $('#fiche-plan').close(); ouvrirModeles(sections[sections.length - 1]?.id || 'fin'); });
$('#editeur-plan').addEventListener('click', () => { afficherSections(); $('#fiche-plan').showModal(); });

// Ordre et visibilité des sections (plan, barre d'outils de l'éditeur)
function enregistrerOrdre(ids) {
  modifsPage().ordre = ids.filter((id) => !sections.find((s) => s.id === id)?.premiere);
  sections.sort((a, b) => (a.premiere ? -1 : b.premiere ? 1 : ids.indexOf(a.id) - ids.indexOf(b.id)));
  nettoyerPage();
  changement();
}
function basculerMasquee(s) {
  const p = modifsPage();
  const m = new Set(p.masquees || []);
  if (s.masquee) m.delete(s.id); else m.add(s.id);
  p.masquees = [...m];
  s.masquee = !s.masquee;
  nettoyerPage();
  changement();
}

$('#liste-sections').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.section !== undefined) {
    const s = sections[Number(b.dataset.section)];
    $('#fiche-plan').close();
    if (s.ajout) return ouvrirAnnonce(etat.contenu.annonces.findIndex((a) => a.id === s.ajout));
    return ouvrirSection(Number(b.dataset.section));
  }
  if (b.dataset.masquer !== undefined) basculerMasquee(sections[Number(b.dataset.masquer)]);
  else {
    const i = Number(b.dataset.sMonter ?? b.dataset.sDescendre);
    const j = b.dataset.sMonter !== undefined ? i - 1 : i + 1;
    const ids = sections.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    enregistrerOrdre(ids);
  }
  afficherSections();
  chargerSections();
});

// Glisser-déposer dans le plan (doigt ou souris) : la ligne suit le pointeur, les autres s'écartent
$('#liste-sections').addEventListener('pointerdown', (e) => {
  const poignee = e.target.closest('[data-poignee]');
  if (!poignee) return;
  e.preventDefault();
  const li = poignee.closest('li');
  const ul = li.parentElement;
  li.classList.add('en-deplacement');
  try { poignee.setPointerCapture(e.pointerId); } catch { /* sans effet */ }
  const bouger = (ev) => {
    const autres = [...ul.children].filter((x) => x !== li && !x.querySelector('.poignee--fixe'));
    const apres = autres.find((x) => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
    if (apres) ul.insertBefore(li, apres); else ul.appendChild(li);
    const zone = $('#fiche-plan');
    const r = zone.getBoundingClientRect();
    if (ev.clientY < r.top + 60) zone.scrollTop -= 12; else if (ev.clientY > r.bottom - 60) zone.scrollTop += 12;
  };
  const finir = () => {
    document.removeEventListener('pointermove', bouger); document.removeEventListener('pointerup', finir); document.removeEventListener('pointercancel', finir);
    li.classList.remove('en-deplacement');
    const ids = [...ul.children].map((x) => sections[Number(x.dataset.i)].id);
    if (ids.join() !== sections.map((s) => s.id).join()) {
      enregistrerOrdre(ids);
      chargerSections();
      notifier('Ordre des sections modifié');
    }
    afficherSections();
  };
  document.addEventListener('pointermove', bouger);
  document.addEventListener('pointerup', finir);
  document.addEventListener('pointercancel', finir);
});

let ficheSection = null; // { section, images: { id: {src,x,y,zoom,alt} } }
const LIBELLES = { titre: 'Titre', 'petit-titre': 'Petit titre', question: 'Question', texte: 'Texte' };

function ouvrirSection(index) {
  const s = sections[index];
  const p = etat.contenu.pages[pageEnCours()] || {};
  ficheSection = { section: s, images: structuredClone(p.images || {}) };
  $('#section-titre').textContent = s.titre;
  $('#section-erreur').hidden = true;
  const textes = s.textes.map((t) => {
    const valeur = p.textes?.[t.id] ?? t.texte;
    const long = valeur.length > 60 || valeur.includes('\n');
    return `<label for="champ-${t.id}">${LIBELLES[t.type]}</label>${long
      ? `<textarea id="champ-${t.id}" data-texte="${t.id}" rows="${Math.min(6, Math.ceil(valeur.length / 45) + 1)}" maxlength="2000">${echapper(valeur)}</textarea>`
      : `<input id="champ-${t.id}" data-texte="${t.id}" maxlength="300" value="${echapper(valeur)}">`}`;
  }).join('');
  const images = s.images.map((im) => `
    <div class="bloc-image" data-image="${im.id}" data-ratio="${im.largeur} / ${im.hauteur}">
      <div class="cadreur__cadre cadre-page" style="aspect-ratio: ${im.largeur} / ${im.hauteur}"><img alt=""></div>
      <div class="cadreur__commandes">
        <label class="bouton bouton--contour bouton--fichier">Remplacer<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-remplacer="${im.id}"></label>
        <button type="button" class="bouton bouton--contour" data-zoom="moins" aria-label="Réduire">－</button>
        <button type="button" class="bouton bouton--contour" data-zoom="plus" aria-label="Agrandir">＋</button>
        <button type="button" class="bouton bouton--discret" data-zoom="centre">Recentrer</button>
        <button type="button" class="bouton bouton--danger" data-origine="${im.id}">Image d’origine</button>
      </div>
      <p class="aide aide--petite" data-aide-image>Image d’origine. « Remplacer » pour en choisir une autre : elle sera ajustée à ce cadre.</p>
      <label for="alt-${im.id}">Description de l’image</label>
      <input id="alt-${im.id}" data-alt="${im.id}" maxlength="120" value="${echapper(ficheSection.images[im.id]?.alt ?? im.alt)}">
    </div>`).join('');
  const boutons = s.boutons.map((b) => {
    const m = p.boutons?.[b.id] || {};
    const type = m.type || (b.wa ? 'whatsapp' : /^tel:/.test(b.href) ? 'telephone' : /^https?:/.test(b.href) ? 'externe' : 'page');
    const valeur = m.valeur ?? (type === 'whatsapp' ? b.wa : type === 'telephone' ? b.href.replace(/^tel:\+33/, '0').replace(/(\d{2})(?=\d)/g, '$1 ') : b.href);
    return `
    <fieldset class="bloc-bouton" data-bouton="${b.id}">
      <legend>Bouton « ${echapper(b.texte)} »</legend>
      <label>Texte du bouton<input data-b-texte maxlength="60" value="${echapper(m.texte ?? b.texte)}"></label>
      <label>Le bouton mène vers
        <select data-b-type>
          <option value="whatsapp" ${type === 'whatsapp' ? 'selected' : ''}>Une conversation WhatsApp avec moi</option>
          <option value="page" ${type === 'page' ? 'selected' : ''}>Une page du site</option>
          <option value="telephone" ${type === 'telephone' ? 'selected' : ''}>Un appel téléphonique</option>
          <option value="externe" ${type === 'externe' ? 'selected' : ''}>Un autre site</option>
        </select>
      </label>
      <label data-b-champ="whatsapp">Message prérempli<input data-b-valeur="whatsapp" maxlength="200" value="${echapper(type === 'whatsapp' ? valeur : '')}"></label>
      <label data-b-champ="page">Page<select data-b-valeur="page">${PAGES.map(([f, n]) => `<option value="${f}" ${type === 'page' && valeur.split('#')[0] === f ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label data-b-champ="telephone">Numéro<input data-b-valeur="telephone" type="tel" value="${echapper(type === 'telephone' ? valeur : etat.contenu.telephones.principal)}"></label>
      <label data-b-champ="externe">Adresse du site<input data-b-valeur="externe" type="url" inputmode="url" placeholder="https://…" value="${echapper(type === 'externe' ? valeur : '')}"></label>
    </fieldset>`;
  }).join('');
  const disposition = s.inversible ? `
    <p class="etiquette">Disposition</p>
    <div class="dispositions" role="radiogroup" aria-label="Disposition de la section">
      <label><input type="radio" name="disposition" value="origine" ${s.inversee ? '' : 'checked'}><span><i class="dispo dispo--origine" aria-hidden="true"></i>Comme à l’origine</span></label>
      <label><input type="radio" name="disposition" value="inverse" ${s.inversee ? 'checked' : ''}><span><i class="dispo dispo--inverse" aria-hidden="true"></i>Image et texte inversés</span></label>
    </div>
    <p class="aide aide--petite">Sur ordinateur, l’image et le texte changent de côté. Sur téléphone, ils restent l’un sous l’autre.</p>` : '';
  $('#section-champs').innerHTML = [
    disposition,
    textes && `<p class="etiquette">Textes</p>${textes}`,
    images && `<p class="etiquette">Images <button class="lien-demo" type="button" data-voir-demo="photo">▶ Comment changer une photo</button></p>${images}`,
    boutons && `<p class="etiquette">Boutons</p>${boutons}`,
  ].filter(Boolean).join('') || '<p class="aide">Cette section est décorative : elle n’a pas de texte modifiable. Vous pouvez la déplacer ou la masquer depuis la liste.</p>';
  $$('#section-champs .bloc-bouton').forEach(majBouton);
  $$('#section-champs .bloc-image').forEach(majImage);
  $('#fiche-section').showModal();
  $('#fiche-section').scrollTop = 0;
}

function majBouton(bloc) {
  const type = $('[data-b-type]', bloc).value;
  $$('[data-b-champ]', bloc).forEach((l) => { l.hidden = l.dataset.bChamp !== type; });
}

function majImage(bloc) {
  const id = bloc.dataset.image;
  const s = ficheSection.section.images.find((x) => x.id === id);
  const m = ficheSection.images[id];
  const img = $('.cadre-page img', bloc);
  const src = m ? (etat.nouvelles.get(m.src)?.apercu || `/${m.src}-sm.jpg`) : `/${s.origine || s.src}`;
  if (img.getAttribute('src') !== src) img.src = src;
  img.style.objectPosition = m ? `${m.x}% ${m.y}%` : '';
  img.style.transform = m && m.zoom !== 1 ? `scale(${m.zoom})` : '';
  img.style.transformOrigin = m ? `${m.x}% ${m.y}%` : '';
  $$('[data-zoom]', bloc).forEach((b) => { b.hidden = !m; });
  $('[data-origine]', bloc).hidden = !m;
  $('[data-aide-image]', bloc).textContent = m ? 'Faites glisser l’image pour la placer dans le cadre. Le cadre est celui du site : l’image n’est jamais déformée.' : 'Image d’origine. « Remplacer » pour en choisir une autre : elle sera ajustée à ce cadre.';
}

$('#section-champs').addEventListener('change', async (e) => {
  if (e.target.matches('[data-b-type]')) return majBouton(e.target.closest('.bloc-bouton'));
  const id = e.target.dataset.remplacer;
  if (!id) return;
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const image = await preparerImageLibre(f);
    const src = nouveauNom('img/pages', `${pageEnCours().replace('.html', '')}-${id}`);
    etat.nouvelles.set(src, image);
    const alt = $(`[data-alt="${id}"]`).value;
    ficheSection.images[id] = { src, x: 50, y: 50, zoom: 1, alt };
    majImage(e.target.closest('.bloc-image'));
  } catch (err) {
    $('#section-erreur').textContent = err.message;
    $('#section-erreur').hidden = false;
  }
});

$('#section-champs').addEventListener('click', (e) => {
  const bloc = e.target.closest('.bloc-image');
  if (!bloc) return;
  const id = bloc.dataset.image;
  if (e.target.closest('[data-origine]')) { delete ficheSection.images[id]; return majImage(bloc); }
  const z = e.target.closest('[data-zoom]')?.dataset.zoom;
  const m = ficheSection.images[id];
  if (!z || !m) return;
  if (z === 'plus') m.zoom = Math.min(2.5, Math.round((m.zoom + 0.15) * 100) / 100);
  if (z === 'moins') m.zoom = Math.max(1, Math.round((m.zoom - 0.15) * 100) / 100);
  if (z === 'centre') Object.assign(m, { x: 50, y: 50, zoom: 1 });
  majImage(bloc);
});

// Glisser l'image dans son cadre
let glisse = null;
$('#section-champs').addEventListener('pointerdown', (e) => {
  const cadre = e.target.closest('.cadre-page');
  if (!cadre) return;
  const m = ficheSection.images[cadre.closest('.bloc-image').dataset.image];
  if (!m) return;
  glisse = { cadre, m, px: e.clientX, py: e.clientY, x: m.x, y: m.y };
  cadre.setPointerCapture(e.pointerId);
  cadre.classList.add('est-deplace');
});
$('#section-champs').addEventListener('pointermove', (e) => {
  if (!glisse) return;
  const r = glisse.cadre.getBoundingClientRect();
  glisse.m.x = Math.round(Math.min(100, Math.max(0, glisse.x - ((e.clientX - glisse.px) / r.width) * 100 / glisse.m.zoom)));
  glisse.m.y = Math.round(Math.min(100, Math.max(0, glisse.y - ((e.clientY - glisse.py) / r.height) * 100 / glisse.m.zoom)));
  majImage(glisse.cadre.closest('.bloc-image'));
});
['pointerup', 'pointercancel'].forEach((t) => $('#section-champs').addEventListener(t, () => {
  if (glisse) glisse.cadre.classList.remove('est-deplace');
  glisse = null;
}));

$('#form-section').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'valider') return;
  const s = ficheSection.section;
  const p = modifsPage();
  const erreur = (m) => { e.preventDefault(); $('#section-erreur').textContent = m; $('#section-erreur').hidden = false; $('#section-erreur').scrollIntoView({ block: 'center' }); };
  // Textes : seuls ceux qui diffèrent du texte affiché sont gardés comme modifications
  const textes = { ...(p.textes || {}) };
  for (const champ of $$('[data-texte]')) {
    const t = s.textes.find((x) => x.id === champ.dataset.texte);
    const v = champ.value.replace(/\r/g, '').trim();
    if (!v) return erreur(`Le champ « ${LIBELLES[t.type]} » est vide. Écrivez un texte (ou fermez sans valider pour annuler).`);
    if (v !== t.texte || textes[t.id] !== undefined) textes[t.id] = v;
  }
  // Boutons
  const boutons = { ...(p.boutons || {}) };
  for (const bloc of $$('[data-bouton]')) {
    const b = s.boutons.find((x) => x.id === bloc.dataset.bouton);
    const texte = $('[data-b-texte]', bloc).value.trim();
    const type = $('[data-b-type]', bloc).value;
    const valeur = $(`[data-b-valeur="${type}"]`, bloc).value.trim();
    if (!texte) return erreur('Un bouton n’a plus de texte.');
    if (type === 'externe' && !urlValide(valeur)) return erreur(`L’adresse du bouton « ${texte} » doit être complète et commencer par https://`);
    if (type === 'telephone' && !TEL.test(valeur)) return erreur(`Le numéro du bouton « ${texte} » doit ressembler à 06 12 34 56 78.`);
    const avant = { type: b.wa ? 'whatsapp' : /^tel:/.test(b.href) ? 'telephone' : /^https?:/.test(b.href) ? 'externe' : 'page', valeur: b.wa || b.href };
    const change = texte !== b.texte || type !== avant.type || (type !== 'telephone' && valeur !== avant.valeur) || (type === 'telephone' && `tel:+33${valeur.replace(/\D/g, '').replace(/^0/, '')}` !== b.href);
    if (change || boutons[b.id]) boutons[b.id] = { texte, type, valeur: valeur || (type === 'whatsapp' ? `Bonjour Nelly, ${texte.toLowerCase()}` : valeur) };
  }
  // Images (descriptions comprises)
  const images = { ...(p.images || {}) };
  for (const im of s.images) {
    const m = ficheSection.images[im.id];
    if (m) { m.alt = $(`[data-alt="${im.id}"]`).value.trim(); images[im.id] = m; } else delete images[im.id];
  }
  p.textes = textes; p.boutons = boutons; p.images = images;
  const dispo = $('[name="disposition"]:checked', $('#section-champs'));
  if (dispo) {
    const inv = new Set(p.inversees || []);
    if (dispo.value === 'inverse') inv.add(s.id); else inv.delete(s.id);
    p.inversees = [...inv];
  }
  nettoyerPage();
  changement();
  chargerSections();
});

// --- Aperçu ----------------------------------------------------------------------

$('#apercu-page').innerHTML = PAGES.map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
let largeurApercu = 390;

function pageConseillee() {
  const a = resumeModifications().join(' ');
  if (/Annonce/.test(a)) {
    const ann = etat.contenu.annonces.find((x) => JSON.stringify(x) !== JSON.stringify(etat.base.annonces.find((y) => y.id === x.id)));
    const p = ann?.pages?.[0];
    if (p && p !== 'toutes') return p;
    return 'index.html';
  }
  const page = PAGES.find(([f]) => JSON.stringify(etat.base.pages[f] || {}) !== JSON.stringify(etat.contenu.pages[f] || {}));
  if (page) return page[0];
  if (/photo/.test(a)) return 'realisations.html';
  if (/Horaires|Téléphones/.test(a)) return 'contact.html';
  if (/€|oiffure/.test(a)) return 'coiffures.html';
  return 'index.html';
}

// Page générée → affichable ici : liens relatifs au site, images pas encore publiées affichées depuis l'appareil
// (adresses « blob: » et non « data: » : la virgule d'une adresse data: casse les listes srcset des images)
const adressesBlob = new Map();
function adresseBlob(dataUrl) {
  if (!adressesBlob.has(dataUrl)) {
    const [entete, base64] = dataUrl.split(',');
    const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    adressesBlob.set(dataUrl, URL.createObjectURL(new Blob([octets], { type: entete.slice(5).split(';')[0] })));
  }
  return adressesBlob.get(dataUrl);
}
function preparerPage(html, extra = '') {
  let page = html.replace('<head>', `<head><base href="${location.origin}/" target="_blank">${extra}`);
  for (const [img, p] of etat.nouvelles) {
    if (!p.apercu) continue;
    const a = adresseBlob(p.apercu);
    const clair = p.apercuClair ? adresseBlob(p.apercuClair) : a;
    page = page.split(`${img}-sm.jpg`).join(a).split(`${img}.jpg`).join(a).split(`${img}-clair.png`).join(clair).split(`${img}.png`).join(a);
  }
  return page;
}

async function ouvrirApercu() {
  $('#apercu-page').value = pageConseillee();
  $('#fiche-apercu').showModal();
  await chargerApercu();
}
$('#ouvrir-apercu').addEventListener('click', ouvrirApercu);
$('#apercu-page').addEventListener('change', chargerApercu);
$$('[data-ecran]').forEach((b) => b.addEventListener('click', () => {
  largeurApercu = Number(b.dataset.ecran);
  $$('[data-ecran]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  ajusterApercu();
}));
window.addEventListener('resize', ajusterApercu);

function ajusterApercu() {
  const zone = $('#apercu-zone');
  const cadre = $('#apercu-cadre');
  const echelle = Math.min(1, (zone.clientWidth - 16) / largeurApercu);
  cadre.style.width = `${largeurApercu}px`;
  cadre.style.height = `${(zone.clientHeight - 16) / echelle}px`;
  cadre.style.transform = `scale(${echelle})`;
}

async function chargerApercu() {
  const cadre = $('#apercu-cadre');
  const chargement = $('#apercu-chargement');
  const alertes = $('#apercu-alertes');
  chargement.hidden = false;
  chargement.innerHTML = '<span class="chargement"></span> Préparation de l’aperçu…';
  cadre.style.visibility = 'hidden';
  try {
    const { html, avertissements } = await api('apercu', { methode: 'POST', corps: { contenu: etat.contenu, page: $('#apercu-page').value } });
    cadre.srcdoc = preparerPage(html);
    cadre.onload = () => { chargement.hidden = true; cadre.style.visibility = 'visible'; ajusterApercu(); };
    alertes.hidden = !avertissements.length;
    alertes.innerHTML = avertissements.map((a) => `<li>⚠️ ${echapper(a)}</li>`).join('');
  } catch (err) {
    chargement.textContent = err.message;
  }
}
$('#apercu-publier').addEventListener('click', () => { $('#fiche-apercu').close(); ouvrirPublication(); });

// --- Publication -----------------------------------------------------------------

function verifierAvantPublication() {
  const problemes = [];
  verifierTelephones();
  for (const cle of ['principal', 'secondaire']) if (!TEL.test(String(etat.contenu.telephones[cle]).trim())) problemes.push(`Téléphone ${cle === 'principal' ? 'principal' : 'secondaire'} incomplet (onglet Infos).`);
  for (const [cle, nom] of Object.entries(RESEAUX)) if (!reseauValide(cle, etat.contenu.reseaux[cle])) problemes.push(`Lien ${nom} incomplet (onglet Infos).`);
  for (const a of etat.contenu.annonces) {
    const exemples = [a.titre, a.texte, ...(a.cartes || []).flatMap((c) => [c.titre, c.texte])].filter((t) => TEXTES_EXEMPLE.has(t));
    if (a.active && exemples.length) problemes.push(`La section « ${a.titre} » contient encore un texte d’exemple : touchez-le sur la page pour écrire le vôtre.`);
  }
  for (const a of etat.contenu.annonces) { const e = verifierAnnonce(a); if (e && !(a.fin && a.fin < aujourdhui())) problemes.push(`Annonce « ${a.titre || a.texte} » : ${e}`); }
  return problemes;
}

function ouvrirPublication() {
  const problemes = verifierAvantPublication();
  const lignes = resumeModifications();
  $('#publier-contenu').innerHTML = problemes.length ? `
    <h2>Avant de publier</h2>
    <p class="aide">Corrigez ces points : ils empêcheraient la mise à jour du site.</p>
    <ul class="etapes">${problemes.map((l) => `<li>⚠️ ${echapper(l)}</li>`).join('')}</ul>
    <div class="fiche__actions"><span></span><button class="bouton bouton--plein" type="button" data-fermer>Compris</button></div>` : `
    <h2>Publier sur le site ?</h2>
    <ul class="etapes">${(lignes.length ? lignes : ['Modifications diverses']).map((l) => `<li>• ${echapper(l)}</li>`).join('')}</ul>
    <p class="aide">Le site sera mis à jour dans environ une minute.</p>
    <p class="message message--erreur" id="publier-erreur" hidden></p>
    <div class="fiche__actions">
      <button class="bouton bouton--discret" type="button" id="publier-apercu">Voir l’aperçu</button>
      <span></span>
      <button class="bouton bouton--discret" type="button" data-fermer>Pas maintenant</button>
      <button class="bouton bouton--plein" type="button" id="confirmer-publier">Publier</button>
    </div>`;
  $('#fiche-publier').showModal();
}
$('#publier').addEventListener('click', ouvrirPublication);

$('#fiche-publier').addEventListener('click', async (e) => {
  if (e.target.closest('#publier-apercu')) { $('#fiche-publier').close(); return ouvrirApercu(); }
  if (!e.target.closest('#confirmer-publier')) return;
  const bouton = $('#confirmer-publier');
  const erreur = $('#publier-erreur');
  bouton.disabled = true;
  bouton.innerHTML = '<span class="chargement"></span> Publication…';
  erreur.hidden = true;
  const utilisees = imagesUtilisees(etat.contenu);
  const photos = [...etat.nouvelles.entries()].filter(([img, p]) => p.grand && utilisees.includes(img))
    .flatMap(([img, p]) => (p.ext === 'png'
      ? [{ chemin: `${img}.png`, base64: p.grand }, { chemin: `${img}-clair.png`, base64: p.petit }]
      : [{ chemin: `${img}.jpg`, base64: p.grand }, { chemin: `${img}-sm.jpg`, base64: p.petit }]));
  try {
    const r = await api('publier', { methode: 'POST', corps: { contenu: etat.contenu, photos, version: etat.version, resume: resumeModifications().join(', ') } });
    etat.base = normaliser(r.contenu || structuredClone(etat.contenu));
    etat.contenu = structuredClone(etat.base);
    etat.version = r.version;
    // Les images envoyées restent affichées depuis l'appareil le temps que le site se mette à jour (sans être renvoyées)
    for (const [avant, apres] of Object.entries(r.renommees || {})) {
      if (etat.nouvelles.has(avant)) { etat.nouvelles.set(apres, etat.nouvelles.get(avant)); etat.nouvelles.delete(avant); }
    }
    for (const [img, p] of etat.nouvelles) etat.nouvelles.set(img, { apercu: p.apercu, apercuClair: p.apercuClair });
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans effet */ }
    etat.defaire = [];
    etat.refaire = [];
    toutAfficher();
    $('#publier-contenu').innerHTML = `
      <h2>C’est envoyé ✓</h2>
      <p class="aide">Le site se met à jour : vos changements seront visibles dans environ une minute (pensez à rafraîchir la page du site).</p>
      <div class="fiche__actions"><span></span>
        <a class="bouton bouton--contour" href="/" target="_blank" rel="noopener">Voir le site</a>
        <button class="bouton bouton--plein" type="button" data-fermer>Terminé</button>
      </div>`;
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
    bouton.disabled = false;
    bouton.textContent = 'Réessayer';
  }
});

// --- Éditeur visuel -------------------------------------------------------------------
// La page s'affiche comme sur le site. On touche un texte pour l'écrire sur place, une photo ou un bouton pour
// ouvrir sa fiche, le fond d'une section pour la déplacer (flèches ou glisser), « ＋ » pour en ajouter une.
// Les modifications utilisent les mêmes données que les fiches (contenu.pages, annonces) : rien de spécial à publier.

// Sur un grand écran, l'éditeur montre d'abord la version ordinateur
const ed = { ecran: window.innerWidth >= 1000 ? 'ordinateur' : 'mobile', defilement: 0, choisie: null };
$$('[data-ed-ecran]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.edEcran === ed.ecran)));

// Styles ajoutés à la page dans l'éditeur seulement (jamais publiés)
const STYLE_EDITEUR = `<style id="style-editeur">
  html { scroll-behavior: auto !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
  body::before { display: none !important; }
  .reveal, [data-stagger] > *, .reveal-script span, .intro, .line > span, .page-hero__script span, .hero__script span { opacity: 1 !important; transform: none !important; clip-path: none !important; }
  .wa-float, .sticky-cta { display: none !important; }
  .header { position: absolute !important; }
  [data-t], [data-champ] { outline: 1.5px dashed rgba(181, 122, 80, .7); outline-offset: 3px; border-radius: 3px; cursor: text; }
  [data-t]:hover, [data-champ]:hover { outline-style: solid; background: rgba(181, 122, 80, .08); }
  [contenteditable="true"] { outline: 2.5px solid #B57A50 !important; background: rgba(255, 252, 248, .92) !important; color: #1E140E !important; -webkit-text-fill-color: #1E140E !important; }
  img[data-i], [data-ajout] img, a[data-b] { cursor: pointer; }
  main > section { cursor: pointer; position: relative; }
  main > section[hidden] { display: block !important; opacity: .4; }
  main > section[hidden]::after { content: "Masquée : invisible pour vos clientes"; position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 60; padding: 6px 14px; border-radius: 99px; background: #1E140E; color: #F6ECE2; font: 600 13px/1.3 Poppins, sans-serif; white-space: nowrap; }
  main > section.ed-choisie { outline: 3px solid #B57A50; outline-offset: -3px; }
  main > section.ed-glisse { opacity: .35; }
  .ed-plus { position: relative; z-index: 55; height: 0; display: flex; justify-content: center; align-items: center; }
  .ed-plus button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 2px solid #fff; border-radius: 99px; background: #B57A50; color: #fff; font: 600 13px/1 Poppins, sans-serif; box-shadow: 0 6px 18px rgba(60, 30, 15, .35); cursor: pointer; }
  .ed-ligne { position: absolute; left: 0; right: 0; height: 4px; background: #B57A50; z-index: 70; pointer-events: none; box-shadow: 0 0 0 3px rgba(255,255,255,.8); }
  .ed-outils, .ed-texte { position: fixed; left: 8px; right: 8px; z-index: 2000; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 8px; border-radius: 18px; background: #1E140E; box-shadow: 0 10px 30px rgba(0,0,0,.35); font: 500 13px/1.2 Poppins, sans-serif; }
  .ed-outils { bottom: 8px; }
  .ed-texte { top: 8px; }
  .ed-outils p, .ed-texte p { width: 100%; text-align: center; color: #DDAE86; font-size: 12px; margin: 0 0 2px; }
  .ed-outils button, .ed-texte button { min-height: 36px; padding: 0 11px; border: 0; border-radius: 99px; background: #F6ECE2; color: #1E140E; font: inherit; cursor: pointer; touch-action: none; }
  .ed-outils button:disabled { opacity: .35; }
  .ed-outils .ed-principal, .ed-texte .ed-principal { background: #B57A50; color: #fff; }
</style>`;

// Taille de l'écran simulé : téléphone (largeur réelle sur téléphone) ou ordinateur (réduit pour tenir)
function ajusterEditeur() {
  const zone = $('#editeur-zone');
  const cadre = $('#editeur-cadre');
  if (!zone || $('[data-onglet="pages"]').hidden) return;
  const haut = zone.getBoundingClientRect().top;
  const bas = ($('#barre-publier').hidden ? 0 : $('#barre-publier').offsetHeight + 8) + $('.onglets').offsetHeight + 8;
  zone.style.height = `${Math.max(320, window.innerHeight - haut - bas)}px`;
  const largeur = ed.ecran === 'ordinateur' ? 1280 : Math.min(430, zone.clientWidth);
  const echelle = Math.min(1, zone.clientWidth / largeur);
  cadre.style.width = `${largeur}px`;
  cadre.style.height = `${zone.clientHeight / echelle}px`;
  cadre.style.transform = echelle < 1 ? `scale(${echelle})` : '';
}
window.addEventListener('resize', ajusterEditeur);
$$('[data-ed-ecran]').forEach((b) => b.addEventListener('click', () => {
  ed.ecran = b.dataset.edEcran;
  $$('[data-ed-ecran]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  ajusterEditeur();
}));

function afficherEditeur(html, defiler) {
  const cadre = $('#editeur-cadre');
  try { ed.defilement = cadre.contentWindow?.scrollY || ed.defilement; } catch { /* page pas encore chargée */ }
  const premier = !cadre.srcdoc;
  $('#editeur-chargement').hidden = !premier;
  if (premier) cadre.style.visibility = 'hidden';
  return new Promise((fin) => {
    cadre.onload = () => {
      const doc = cadre.contentDocument;
      installerEditeur(doc);
      const cible = defiler && doc.querySelector(`main > section[data-s="${defiler}"]`);
      if (cible) { cible.scrollIntoView({ block: 'center' }); choisirSection(doc, cible); } else cadre.contentWindow.scrollTo(0, ed.defilement);
      cadre.style.visibility = 'visible';
      $('#editeur-chargement').hidden = true;
      ajusterEditeur();
      fin();
    };
    cadre.srcdoc = preparerPage(html, STYLE_EDITEUR);
  });
}

const sectionDe = (el) => sections.find((s) => s.id === el.dataset.s);
const annonceDe = (s) => etat.contenu.annonces.find((a) => a.id === s.ajout);

// Éléments du site qui se modifient ailleurs : un message simple et un raccourci
const AILLEURS = [
  ['[data-prix], .services-grid, .tarifs, .style__prix', 'Les coiffures et leurs prix se modifient dans l’onglet Coiffures.', 'coiffures', 'Ouvrir Coiffures'],
  ['.gallery, .gallery__item, .mosaic, .filters', 'Les photos de réalisations se gèrent dans l’onglet Photos.', 'photos', 'Ouvrir Photos'],
  ['.promo:not([data-ajout]), .annonce', 'Cette annonce se modifie dans l’onglet Annonces.', 'annonces', 'Ouvrir Annonces'],
  ['.hours, .horaires, [data-horaires]', 'Les horaires se modifient dans l’onglet Infos.', 'infos', 'Ouvrir Infos'],
  ['header, .site-footer, .nav', 'Le menu, le logo et le pied de page se modifient dans l’onglet Infos.', 'infos', 'Ouvrir Infos'],
  ['h1', 'Le grand titre de la page est protégé : il compte beaucoup pour Google.', '', ''],
];

function installerEditeur(doc) {
  const win = doc.defaultView;
  const main = doc.querySelector('main');
  if (!main) return;
  // Boutons « ＋ » entre les sections (et à la fin)
  const placerPlus = () => {
    doc.querySelectorAll('.ed-plus').forEach((x) => x.remove());
    for (const s of main.querySelectorAll(':scope > section[data-s]')) {
      const plus = doc.createElement('div');
      plus.className = 'ed-plus';
      plus.innerHTML = '<button type="button">＋ Ajouter une section ici</button>';
      plus.dataset.apres = s.dataset.s;
      s.after(plus);
    }
  };
  placerPlus();
  ed.placerPlus = placerPlus;

  // Les liens ne quittent pas l'éditeur ; chaque toucher est interprété
  doc.addEventListener('click', (e) => {
    const lien = e.target.closest('a');
    if (lien) e.preventDefault();
    if (e.target.closest('.ed-outils, .ed-texte, [contenteditable="true"]')) return;
    const plus = e.target.closest('.ed-plus');
    if (plus) return ouvrirModeles(plus.dataset.apres);
    const sectionEl = e.target.closest('main > section[data-s]');
    const s = sectionEl && sectionDe(sectionEl);
    const texte = e.target.closest('[data-t], [data-champ]');
    if (texte && s) return modifierTexte(doc, texte, s);
    const image = e.target.closest('img');
    const bouton = e.target.closest('a[data-b], [data-ajout] a.btn');
    if (s && (image?.matches('[data-i]') || (image && s.ajout) || bouton)) return ouvrirElement(s, image?.dataset.i, bouton?.dataset.b);
    for (const [selecteur, message, onglet, libelle] of AILLEURS) {
      if (e.target.closest(selecteur) && !(sectionEl && e.target.closest(selecteur) === sectionEl && !s)) {
        if (e.target.closest(selecteur).contains(sectionEl) && s) break;
        return notifier(message, onglet ? { libelle, action: () => ouvrirOnglet(onglet) } : null);
      }
    }
    if (sectionEl && s) choisirSection(doc, sectionEl);
    else if (!sectionEl) fermerOutils(doc);
  }, true);
  win.addEventListener('scroll', () => { ed.defilement = win.scrollY; }, { passive: true });
}

function ouvrirElement(s, image, bouton) {
  if (s.ajout) return ouvrirAnnonce(etat.contenu.annonces.findIndex((a) => a.id === s.ajout));
  ouvrirSection(sections.indexOf(s));
  const cible = image ? $(`#section-champs [data-image="${image}"]`) : bouton ? $(`#section-champs [data-bouton="${bouton}"]`) : null;
  if (cible) setTimeout(() => cible.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
}

// --- Texte modifié sur place
const versSaisieDom = (el) => [...el.childNodes].map((n) => {
  if (n.nodeType === 3) return n.nodeValue;
  if (n.nodeName === 'BR') return '\n';
  if (/^(EM|I)$/.test(n.nodeName)) { const t = versSaisieDom(n); return t.trim() ? `*${t}*` : t; }
  if (/^(DIV|P)$/.test(n.nodeName)) return `\n${versSaisieDom(n)}`;
  return versSaisieDom(n);
}).join('');
const nettoyerSaisie = (t) => t.replace(/\r/g, '').replace(/\*\*/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function valeurChamp(a, champ) {
  const m = champ.match(/^carte-(\d+)-(titre|texte)$/);
  return m ? a.cartes?.[Number(m[1])]?.[m[2]] ?? '' : a[champ] ?? '';
}
function ecrireChamp(a, champ, v) {
  const m = champ.match(/^carte-(\d+)-(titre|texte)$/);
  if (m) a.cartes[Number(m[1])][m[2]] = v; else a[champ] = v;
}

function modifierTexte(doc, el, s) {
  fermerOutils(doc);
  const unique = /^(H2|H3|H4|SUMMARY|LI|SMALL|SPAN|DT)$/.test(el.nodeName) || el.classList.contains('eyebrow');
  const avant = el.innerHTML;
  el.contentEditable = 'true';
  el.focus();
  const barre = doc.createElement('div');
  barre.className = 'ed-texte';
  barre.innerHTML = `<p>Écrivez directement. ${unique ? '' : 'Entrée = nouvelle ligne. '}Sélectionnez un mot puis ✦ pour le mettre en couleur.</p>
    <button type="button" data-ed="couleur">✦ Couleur</button><button type="button" data-ed="annuler">Annuler</button><button type="button" class="ed-principal" data-ed="ok">✓ Terminé</button>`;
  doc.body.appendChild(barre);
  let fini = false;
  const terminer = (garder) => {
    if (fini) return;
    fini = true;
    barre.remove();
    el.removeAttribute('contenteditable');
    if (!garder) { el.innerHTML = avant; return; }
    const v = nettoyerSaisie(versSaisieDom(el));
    if (!v) { el.innerHTML = avant; notifier('Un texte ne peut pas être vide : le texte précédent est remis. Pour retirer toute la section, utilisez « Masquer ».'); return; }
    if (s.ajout) {
      const a = annonceDe(s);
      if (!a || valeurChamp(a, el.dataset.champ) === v) return;
      ecrireChamp(a, el.dataset.champ, v);
      afficherAnnonces();
    } else {
      const t = s.textes.find((x) => x.id === el.dataset.t);
      if (!t || t.texte === v) return;
      const p = modifsPage();
      p.textes = { ...(p.textes || {}), [t.id]: v };
      t.texte = v;
    }
    changement();
    notifier('✓ Texte modifié (pas encore en ligne)');
  };
  barre.addEventListener('pointerdown', (e) => e.preventDefault()); // garde la sélection dans le texte
  barre.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'couleur') { doc.execCommand('italic'); return; }
    terminer(b.dataset.ed === 'ok');
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') terminer(false);
    if (e.key === 'Enter') { e.preventDefault(); if (unique) terminer(true); else doc.execCommand('insertLineBreak'); }
  });
  el.addEventListener('paste', (e) => { e.preventDefault(); doc.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  el.addEventListener('blur', () => setTimeout(() => { if (doc.activeElement !== el) terminer(true); }, 150), { once: true });
}

// --- Section choisie : barre d'outils
function fermerOutils(doc) {
  doc.querySelectorAll('.ed-outils').forEach((x) => x.remove());
  doc.querySelectorAll('.ed-choisie').forEach((x) => x.classList.remove('ed-choisie'));
  ed.choisie = null;
}

function choisirSection(doc, el) {
  fermerOutils(doc);
  const s = sectionDe(el);
  if (!s) return;
  ed.choisie = s.id;
  el.classList.add('ed-choisie');
  const ordre = [...doc.querySelectorAll('main > section[data-s]')];
  const i = ordre.indexOf(el);
  const outils = doc.createElement('div');
  outils.className = 'ed-outils';
  outils.innerHTML = `<p>${echapper(s.titre)}${s.premiere ? ' · reste en haut de la page' : ''}</p>
    ${s.premiere ? '' : `<button type="button" data-ed="monter" ${i <= 1 ? 'disabled' : ''}>↑ Monter</button>
    <button type="button" data-ed="descendre" ${i >= ordre.length - 1 ? 'disabled' : ''}>↓ Descendre</button>
    <button type="button" data-ed="glisser" title="Maintenir et glisser">⠿ Glisser</button>
    <button type="button" data-ed="masquer">${s.masquee ? 'Réafficher' : 'Masquer'}</button>`}
    ${s.inversible ? `<button type="button" data-ed="inverser">⇄ Inverser</button>` : ''}
    <button type="button" class="ed-principal" data-ed="modifier">✎ ${s.ajout ? 'Modifier' : 'Tout modifier'}</button>
    <button type="button" data-ed="fermer" aria-label="Fermer">✕</button>`;
  doc.body.appendChild(outils);
  outils.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b || b.dataset.ed === 'glisser') return;
    actionSection(doc, el, s, b.dataset.ed);
  });
  outils.querySelector('[data-ed="glisser"]')?.addEventListener('pointerdown', (e) => glisserSection(doc, el, e));
}

function actionSection(doc, el, s, action) {
  const main = doc.querySelector('main');
  if (action === 'fermer') return fermerOutils(doc);
  if (action === 'modifier') return ouvrirElement(s);
  if (action === 'masquer') {
    basculerMasquee(s);
    el.hidden = s.masquee;
    notifier(s.masquee ? 'Section masquée : vos clientes ne la verront plus. Touchez-la pour la réafficher.' : 'Section réaffichée');
    return choisirSection(doc, el);
  }
  if (action === 'inverser') {
    const p = modifsPage();
    const inv = new Set(p.inversees || []);
    s.inversee = !s.inversee;
    if (s.inversee) inv.add(s.id); else inv.delete(s.id);
    p.inversees = [...inv];
    nettoyerPage();
    changement();
    if (s.inversee) el.setAttribute('data-inverse', '1'); else el.removeAttribute('data-inverse');
    notifier(ed.ecran === 'mobile' ? 'Image et texte inversés : visible sur ordinateur (choisissez « Ordinateur » en haut pour voir).' : 'Image et texte inversés');
    return;
  }
  const ordre = [...main.querySelectorAll(':scope > section[data-s]')];
  const i = ordre.indexOf(el);
  const j = action === 'monter' ? i - 1 : i + 1;
  if (j < 1 || j >= ordre.length) return;
  if (action === 'monter') ordre[j].before(el); else ordre[j].after(el);
  appliquerOrdreDom(doc);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  choisirSection(doc, el);
}

function appliquerOrdreDom(doc) {
  enregistrerOrdre([...doc.querySelectorAll('main > section[data-s]')].map((x) => x.dataset.s));
  ed.placerPlus?.();
  afficherSections();
}

// Glisser une section : une ligne indique où elle sera posée ; la page défile près des bords
function glisserSection(doc, el, e) {
  e.preventDefault();
  const win = doc.defaultView;
  const bouton = e.target;
  try { bouton.setPointerCapture(e.pointerId); } catch { /* sans effet */ }
  el.classList.add('ed-glisse');
  const ligne = doc.createElement('div');
  ligne.className = 'ed-ligne';
  doc.body.appendChild(ligne);
  let cible = null;
  let y = e.clientY;
  const calculer = () => {
    const autres = [...doc.querySelectorAll('main > section[data-s]')].slice(1).filter((x) => x !== el);
    cible = autres.find((x) => { const r = x.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;
    const ref = cible || autres[autres.length - 1];
    if (!ref) return;
    const r = ref.getBoundingClientRect();
    ligne.style.top = `${(cible ? r.top : r.bottom) + win.scrollY - 2}px`;
  };
  const defiler = setInterval(() => {
    if (y < 90) win.scrollBy(0, -18); else if (y > win.innerHeight - 140) win.scrollBy(0, 18); else return;
    calculer();
  }, 30);
  const bouger = (ev) => { y = ev.clientY; calculer(); };
  const finir = () => {
    clearInterval(defiler);
    doc.removeEventListener('pointermove', bouger); doc.removeEventListener('pointerup', finir); doc.removeEventListener('pointercancel', finir);
    ligne.remove();
    el.classList.remove('ed-glisse');
    const main = doc.querySelector('main');
    const avant = [...main.querySelectorAll(':scope > section[data-s]')].map((x) => x.dataset.s).join();
    if (cible) cible.before(el);
    else { const toutes = [...main.querySelectorAll(':scope > section[data-s]')]; toutes[toutes.length - 1].after(el); }
    const apres = [...main.querySelectorAll(':scope > section[data-s]')].map((x) => x.dataset.s).join();
    if (apres !== avant) { appliquerOrdreDom(doc); notifier('Section déplacée'); }
    el.scrollIntoView({ block: 'center' });
    choisirSection(doc, el);
  };
  calculer();
  doc.addEventListener('pointermove', bouger);
  doc.addEventListener('pointerup', finir);
  doc.addEventListener('pointercancel', finir);
}

// --- Ajouter une section à partir d'un modèle (texte d'exemple à remplacer sur la page)
const MODELES = [
  { cle: 'promo', nom: 'Photo et texte', aide: 'Une belle photo à côté d’un texte. Idéal pour une offre.', photo: true,
    a: { format: 'section', etiquette: 'Offre du moment', titre: 'Le titre de votre offre', texte: 'Décrivez votre offre en une ou deux phrases : ce qui est inclus, jusqu’à quand…', bouton: { texte: 'J’en profite', type: 'whatsapp', valeur: 'Bonjour Nelly, je suis intéressée par votre offre.' } } },
  { cle: 'carte', nom: 'Petite carte avec photo', aide: 'Plus discrète : une petite photo et un court texte.', photo: true,
    a: { format: 'carte', etiquette: 'Nouveauté', titre: 'Votre titre ici', texte: 'Un court texte pour présenter la nouveauté.', bouton: { texte: '', type: 'whatsapp', valeur: '' } } },
  { cle: 'info', nom: 'Texte seul', aide: 'Un encadré élégant, pour une information (congés, nouveauté…).',
    a: { format: 'encadre', etiquette: 'Information', titre: 'Votre titre ici', texte: 'Votre message ici. Touchez ce texte pour l’écrire.', bouton: { texte: '', type: 'whatsapp', valeur: '' } } },
  { cle: 'points', nom: 'Trois points forts', aide: 'Trois petites cartes côte à côte.',
    a: { format: 'cartes', etiquette: 'Pourquoi me choisir', titre: 'Votre titre ici', texte: '', bouton: { texte: '', type: 'whatsapp', valeur: '' },
      cartes: [{ titre: 'Premier point', texte: 'Une phrase pour l’expliquer.' }, { titre: 'Deuxième point', texte: 'Une phrase pour l’expliquer.' }, { titre: 'Troisième point', texte: 'Une phrase pour l’expliquer.' }] } },
  { cle: 'appel', nom: 'Bande « Réservez »', aide: 'Une bande sombre qui invite à prendre rendez-vous.',
    a: { format: 'appel', etiquette: '', titre: 'Envie d’une nouvelle coiffure ?', texte: 'Écrivez-moi sur WhatsApp, je vous réponds rapidement.', bouton: { texte: 'Prendre rendez-vous', type: 'whatsapp', valeur: 'Bonjour Nelly, je souhaite prendre rendez-vous pour une coiffure.' } } },
];
const TEXTES_EXEMPLE = new Set(MODELES.flatMap((m) => [m.a.titre, m.a.texte, ...(m.a.cartes || []).flatMap((c) => [c.titre, c.texte])]).filter((t) => t && !/^(Envie d’une nouvelle coiffure \?|Écrivez-moi sur WhatsApp, je vous réponds rapidement\.)$/.test(t)));
let modeleApres = 'fin';

function ouvrirModeles(apres) {
  modeleApres = apres;
  $('#modeles').innerHTML = MODELES.map((m) => `
    <${m.photo ? 'label' : 'button type="button"'} class="modele" data-modele="${m.cle}">
      <span class="mini mini--${m.a.format}">${{ section: '<i></i><b></b>', carte: '<i></i><b></b>', encadre: '<b></b>', cartes: '<i></i><i></i><i></i>', appel: '<b></b>' }[m.a.format]}</span>
      <strong>${m.nom}</strong><small>${m.aide}${m.photo ? '<br><em>Choisissez la photo pour commencer.</em>' : ''}</small>
      ${m.photo ? `<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-modele-photo="${m.cle}">` : ''}
    </${m.photo ? 'label' : 'button'}>`).join('');
  $('#fiche-modeles').showModal();
}

async function creerDepuisModele(cle, fichier) {
  const m = MODELES.find((x) => x.cle === cle);
  const a = { id: `section-${Date.now().toString(36)}`, active: true, pages: [pageEnCours()], debut: '', fin: '', fond: 'clair', image: null, ...structuredClone(m.a), emplacement: { page: pageEnCours(), apres: modeleApres } };
  if (fichier) {
    const image = await preparerImageLibre(fichier);
    if (tailleEnvoi() + image.grand.length + image.petit.length > MAX_ENVOI) throw new Error('Trop d’images en attente : publiez d’abord vos modifications, puis ajoutez la section.');
    const src = nouveauNom('img/annonces', 'section');
    etat.nouvelles.set(src, image);
    a.image = { src, x: 50, y: 50, zoom: 1, alt: '', largeur: image.largeur, hauteur: image.hauteur };
  }
  etat.contenu.annonces.push(a);
  afficherAnnonces();
  changement();
  $('#fiche-modeles').close();
  await chargerSections({ defiler: `a-${a.id}` });
  notifier('Section ajoutée ✓ Touchez ses textes pour les remplacer par les vôtres.');
}

$('#modeles').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-modele]');
  if (b) creerDepuisModele(b.dataset.modele).catch((err) => notifier(err.message));
});
$('#modeles').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) creerDepuisModele(e.target.dataset.modelePhoto, f).catch((err) => notifier(err.message));
  e.target.value = '';
});

// --- Message bref (avec un raccourci éventuel)
let minuterieToast = null;
function notifier(message, raccourci = null) {
  const t = $('#toast');
  t.innerHTML = `<span>${echapper(message)}</span>${raccourci ? `<button type="button">${echapper(raccourci.libelle)}</button>` : ''}`;
  if (raccourci) t.querySelector('button').onclick = () => { t.hidden = true; raccourci.action(); };
  t.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { t.hidden = true; }, raccourci ? 6000 : 3200);
}

// --- Accueil « Que voulez-vous faire ? » et visite guidée
const CLE_ACCUEIL = 'nc_accueil_masque';
const CLE_VISITE = 'nc_visite_faite';
// Icônes fines (trait), dans l'esprit du site
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONES = {
  plume: svg('<path d="M20 4c-6 0-11 5-12 11l-2 5 5-2c6-1 11-6 11-12z"/><path d="M8 16l6-6"/>'),
  plus: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  annonce: svg('<path d="M4 10v4l11 5V5L4 10z"/><path d="M15 9a3 3 0 010 6"/><path d="M7 15l1 4"/>'),
  ciseaux: svg('<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.3L20 18M8.2 15.7L20 6"/>'),
  photo: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'),
  horloge: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  courbe: svg('<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/><circle cx="19" cy="6" r="1.2"/>'),
  historique: svg('<path d="M4 12a8 8 0 102.3-5.6"/><path d="M4 4v4h4"/><path d="M12 8v4l2.5 1.5"/>'),
  palette: svg('<path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.7-1.5H17a3.5 3.5 0 003.5-3.5c0-4.4-3.8-7.7-8.5-7.7z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>'),
};

// Tableau de bord : une action principale mise en avant, puis les autres par thème (tuiles)
const TACHES = [
  { icone: 'plume', titre: 'Modifier mes pages', aide: 'Touchez un texte ou une photo de votre site pour le changer, directement.', vedette: true, action: () => ouvrirOnglet('pages') },
  { groupe: 'Mettre en avant', icone: 'plus', titre: 'Ajouter une section', aide: 'Promo, information, points forts', action: () => { ouvrirOnglet('pages'); setTimeout(() => ouvrirModeles(sections[sections.length - 1]?.id || 'fin'), 400); } },
  { groupe: 'Mettre en avant', icone: 'annonce', titre: 'Annoncer une promo', aide: 'Sur une ou plusieurs pages, avec des dates', action: () => { ouvrirOnglet('annonces'); $('#ajouter-annonce').click(); } },
  { groupe: 'Mon salon', icone: 'ciseaux', titre: 'Prix et coiffures', aide: 'Tarifs, descriptions, photos', action: () => ouvrirOnglet('coiffures') },
  { groupe: 'Mon salon', icone: 'photo', titre: 'Mes réalisations', aide: 'Ajouter vos dernières photos', action: () => ouvrirOnglet('photos') },
  { groupe: 'Mon salon', icone: 'horloge', titre: 'Horaires et contact', aide: 'Jours, téléphone, réseaux', action: () => ouvrirOnglet('infos') },
  { groupe: 'Suivre mon site', icone: 'courbe', titre: 'Statistiques de visite', aide: 'Visiteurs, WhatsApp, parcours', action: () => ouvrirOnglet('stats') },
  { groupe: 'Suivre mon site', icone: 'historique', titre: 'Historique', aide: 'Revenir à une version précédente', action: () => ouvrirOnglet('historique') },
  { groupe: 'Mon salon', icone: 'palette', titre: 'Style du site', aide: 'Couleurs, logo, menu', action: () => { ouvrirOnglet('infos'); setTimeout(() => $('#palettes').scrollIntoView({ block: 'center' }), 100); } },
];
const FLECHE = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
function afficherTaches() {
  const tuile = (t, i) => `<button type="button" class="tache${t.vedette ? ' tache--vedette' : ''}" data-tache="${i}">
      <span class="tache__icone">${ICONES[t.icone]}</span>
      <span class="tache__texte"><strong>${t.titre}</strong><small>${t.aide}</small></span>
      <span class="tache__fleche">${t.vedette ? '<em>Commencer</em>' : ''}${FLECHE}</span>
    </button>`;
  const groupes = [...new Set(TACHES.filter((t) => t.groupe).map((t) => t.groupe))];
  $('#taches').innerHTML = TACHES.map((t, i) => (t.vedette ? tuile(t, i) : '')).join('')
    + groupes.map((g) => `<section class="taches__groupe"><h3>${g}</h3><div class="taches__grille">${TACHES.map((t, i) => (t.groupe === g ? tuile(t, i) : '')).join('')}</div></section>`).join('');
}
afficherTaches();
$('#taches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tache]');
  if (!b) return;
  $('#fiche-accueil').close();
  TACHES[Number(b.dataset.tache)].action();
});
$('#accueil-masquer').addEventListener('change', (e) => { try { localStorage.setItem(CLE_ACCUEIL, e.target.checked ? '1' : ''); } catch { /* sans effet */ } });
function ouvrirAccueil() {
  try { $('#accueil-masquer').checked = localStorage.getItem(CLE_ACCUEIL) === '1'; } catch { /* sans effet */ }
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#accueil-date').textContent = date.charAt(0).toUpperCase() + date.slice(1);
  const n = modifie() ? resumeModifications().length || 1 : 0;
  $('#accueil-etat').textContent = n ? `${n} modification${n > 1 ? 's' : ''} en attente de publication` : 'Votre site est à jour';
  $('#accueil-etat').classList.toggle('accueil__etat--attente', Boolean(n));
  $('#fiche-accueil').showModal();
}
$('#ouvrir-accueil')?.addEventListener('click', () => { $('#fiche-compte').close(); ouvrirAccueil(); });
$('#ouvrir-visite')?.addEventListener('click', () => { $('#fiche-compte').close(); lancerVisite(); });
$('#lancer-visite').addEventListener('click', () => { $('#fiche-accueil').close(); lancerVisite(); });
$('#editeur-aide').addEventListener('click', () => ouvrirAide());
const CLE_CONSEIL = 'nc_conseil_vu';
try { $('#editeur-conseil').hidden = localStorage.getItem(CLE_CONSEIL) === '1'; } catch { /* sans effet */ }
$('#conseil-compris').addEventListener('click', () => {
  $('#editeur-conseil').hidden = true;
  try { localStorage.setItem(CLE_CONSEIL, '1'); } catch { /* sans effet */ }
  ajusterEditeur();
});

// Premier démarrage : visite guidée ; ensuite l'écran d'accueil (sauf s'il a été masqué)
function accueillir() {
  let visite = ''; let masque = '';
  try { visite = localStorage.getItem(CLE_VISITE); masque = localStorage.getItem(CLE_ACCUEIL); } catch { /* sans effet */ }
  if (!visite) { ouvrirAccueil(); return; }
  if (!masque) ouvrirAccueil();
}

const VISITE = [
  ['.onglets', 'En bas, chaque bouton ouvre une partie de votre site. Vous pouvez y aller dans l’ordre que vous voulez.'],
  ['.onglets [data-cible="pages"]', '« Mes pages » montre votre site tel qu’il est. Touchez un texte pour l’écrire, une photo pour la changer, ou « ＋ » pour ajouter une section.'],
  ['.onglets [data-cible="annonces"]', '« Annonces » sert à mettre en avant une promo ou une information, avec une date de début et de fin si vous voulez.'],
  ['#ouvrir-compte', 'Tout ce que vous faites reste en brouillon sur cet appareil. Une barre apparaît en bas avec « Aperçu », « ↶ » pour annuler et « Publier » pour mettre en ligne. Rien ne part sans votre accord.'],
  ['#ouvrir-compte', 'Retrouvez ici l’écran « Que voulez-vous faire ? », cette visite, et la déconnexion. Bonne découverte !'],
];
const VISITE_EDITEUR = [
  ['#editeur-zone', 'Voici votre page, comme vos clientes la voient. Les textes entourés de pointillés s’écrivent directement : touchez-en un.'],
  ['#editeur-zone', 'Touchez une photo ou un bouton pour le changer. Touchez le fond d’une section : une barre apparaît pour la monter, la descendre, la glisser ou la masquer.'],
  ['#editeur-zone', 'Les boutons « ＋ Ajouter une section ici », entre les sections, proposent des modèles prêts à remplir.'],
  ['#editeur-plan', '« Plan » montre toutes les sections de la page en liste : faites-les glisser par la poignée ⠿ pour changer l’ordre.'],
  ['.editeur__ecrans', 'Passez de « Téléphone » à « Ordinateur » pour vérifier le rendu sur les deux.'],
];
let visite = null;
function lancerVisite(etapes = VISITE) {
  visite = { etapes, i: 0 };
  $('#visite').hidden = false;
  afficherEtape();
}
function afficherEtape() {
  const [selecteur, texte] = visite.etapes[visite.i];
  const cible = $(selecteur);
  $$('.visite-cible').forEach((x) => x.classList.remove('visite-cible'));
  const visible = cible && cible.getClientRects().length > 0;
  if (visible) { cible.classList.add('visite-cible'); cible.scrollIntoView({ block: 'nearest' }); }
  $('#visite').classList.toggle('visite--sans-cible', !visible);
  $('#visite-etape').textContent = `Étape ${visite.i + 1} sur ${visite.etapes.length}`;
  $('#visite-texte').textContent = texte;
  $('#visite-suivant').textContent = visite.i === visite.etapes.length - 1 ? 'Terminer' : 'Suivant';
  const bulle = $('.visite__bulle');
  // Bulle sous la cible, ou au-dessus si la cible est en bas de l'écran ; au centre sans cible
  const r = visible ? cible.getBoundingClientRect() : null;
  const dessus = r && r.top > window.innerHeight / 2;
  bulle.style.top = !r ? '30%' : dessus ? 'auto' : `${Math.min(window.innerHeight - 220, r.bottom + 14)}px`;
  bulle.style.bottom = dessus ? `${window.innerHeight - r.top + 14}px` : 'auto';
}
function finirVisite() {
  $('#visite').hidden = true;
  $$('.visite-cible').forEach((x) => x.classList.remove('visite-cible'));
  try { localStorage.setItem(CLE_VISITE, '1'); } catch { /* sans effet */ }
  visite = null;
}
$('#visite-suivant').addEventListener('click', () => { if (++visite.i >= visite.etapes.length) finirVisite(); else afficherEtape(); });
$('#visite-fin').addEventListener('click', finirVisite);

// --- Démonstrations animées ------------------------------------------------------------
// Une mini-maquette de l'écran, un doigt qui montre les gestes, une phrase par étape.
// Chaque étape : légende, élément à toucher (data-d), puis une action sur la maquette.

const pauseDemo = (ms) => new Promise((r) => { demo.minuteries.push(setTimeout(r, ms)); });
const demo = { cle: null, jeton: 0, minuteries: [] };

// Petits outils pour écrire les scènes
const D = {
  el: (nom) => $(`#demo [data-d="${nom}"]`),
  montrer: (nom, oui = true) => D.el(nom)?.classList.toggle('d-visible', oui),
  classe: (nom, c, oui = true) => D.el(nom)?.classList.toggle(c, oui),
  async taper(nom, texte, jeton) {
    const el = D.el(nom);
    el.textContent = '';
    for (const lettre of texte) { if (jeton !== demo.jeton) return; el.textContent += lettre; await pauseDemo(55); }
  },
  // Déplacement fluide d'un élément dans la liste (il glisse à sa nouvelle place)
  deplacer(nom, avantNom, apres = false) {
    const el = D.el(nom); const ref = D.el(avantNom);
    const blocs = [...el.parentElement.children];
    const avant = new Map(blocs.map((b) => [b, b.getBoundingClientRect().top]));
    if (apres) ref.after(el); else ref.before(el);
    for (const b of blocs) {
      const dy = avant.get(b) - b.getBoundingClientRect().top;
      if (!dy) continue;
      b.style.transition = 'none'; b.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; b.style.transform = ''; }));
    }
  },
};

const ECRAN_SITE = (contenu) => `<div class="d-ecran"><div class="d-entete"><span class="d-logo">Nelly</span><span class="d-menu"></span></div>${contenu}</div>`;
const DEMOS = {
  texte: {
    titre: 'Modifier un texte', resume: 'Toucher, écrire, valider',
    scene: ECRAN_SITE(`
      <div class="d-bloc"><span class="d-sur">Nos coiffures</span><p class="d-titre d-modifiable" data-d="titre">Des styles pour chaque personnalité</p><span class="d-ligne"></span><span class="d-ligne d-ligne--courte"></span></div>
      <div class="d-bloc d-bloc--photo"><span class="d-photo"></span></div>`)
      + '<div class="d-outils-texte" data-d="barre"><span>✦ Couleur</span><span>Annuler</span><b data-d="ok">✓ Terminé</b></div><div class="d-toast" data-d="toast">✓ Texte modifié</div>',
    etapes: [
      { legende: 'Les textes entourés de pointillés se modifient : touchez celui que vous voulez changer.', doigt: 'titre', toucher: true, action: () => { D.classe('titre', 'd-actif'); D.montrer('barre'); } },
      { legende: 'Écrivez votre nouveau texte, comme dans un message.', action: (j) => D.taper('titre', 'Offre spéciale de Noël', j) },
      { legende: 'Touchez « Terminé » pour valider.', doigt: 'ok', toucher: true, action: () => { D.classe('titre', 'd-actif', false); D.montrer('barre', false); D.montrer('toast'); } },
      { legende: 'C’est noté ! Il restera à appuyer sur « Publier » pour le mettre en ligne.', attente: 2600 },
    ],
  },
  deplacer: {
    titre: 'Déplacer une section', resume: 'Monter, descendre ou glisser',
    scene: ECRAN_SITE(`<div class="d-pile">
      <div class="d-bloc d-bloc--sombre" data-d="a"><span class="d-etiquette">Bienvenue</span></div>
      <div class="d-bloc" data-d="b"><span class="d-etiquette">Nos coiffures</span><span class="d-ligne"></span></div>
      <div class="d-bloc" data-d="c"><span class="d-etiquette">Avis de mes clientes</span><span class="d-ligne"></span></div>
      <div class="d-bloc" data-d="d"><span class="d-etiquette">Prendre rendez-vous</span><span class="d-ligne"></span></div></div>`)
      + '<div class="d-outils" data-d="outils"><span data-d="monter">↑ Monter</span><span>↓ Descendre</span><span data-d="glisser">⠿ Glisser</span><span>Masquer</span></div><div class="d-repere" data-d="repere"></div>',
    etapes: [
      { legende: 'Touchez le fond de la section à déplacer : elle s’entoure et une barre d’outils apparaît.', doigt: 'c', toucher: true, action: () => { D.classe('c', 'd-choisie'); D.montrer('outils'); } },
      { legende: 'Touchez « Monter » : la section passe au-dessus de la précédente.', doigt: 'monter', toucher: true, action: () => D.deplacer('c', 'b') },
      { legende: 'Pour aller plus loin, maintenez le doigt sur « Glisser »…', doigt: 'glisser', appui: true },
      { legende: '… faites glisser jusqu’à l’endroit voulu : un trait montre où elle sera posée…', doigtVers: 'd', decalage: 0.55, action: () => { D.montrer('outils', false); const r = D.el('d').getBoundingClientRect(); const z = $('#demo').getBoundingClientRect(); const rep = D.el('repere'); rep.style.top = `${r.bottom - z.top + 3}px`; D.montrer('repere'); } },
      { legende: '… et relâchez. C’est tout !', relacher: true, action: () => { D.montrer('repere', false); D.deplacer('c', 'd', true); } },
    ],
  },
  ajouter: {
    titre: 'Ajouter une section', resume: 'Choisir un modèle et l’écrire',
    scene: ECRAN_SITE(`<div class="d-pile" data-d="pile">
      <div class="d-bloc" data-d="b"><span class="d-etiquette">Nos coiffures</span><span class="d-ligne"></span></div>
      <div class="d-plus" data-d="plus">＋ Ajouter une section ici</div>
      <div class="d-bloc" data-d="c"><span class="d-etiquette">Avis de mes clientes</span><span class="d-ligne"></span></div></div>`)
      + `<div class="d-feuille" data-d="feuille"><p class="d-feuille__titre">Ajouter une section</p><div class="d-modeles">
        <span><i class="d-mini d-mini--photo"></i>Photo et texte</span><span data-d="seul"><i class="d-mini d-mini--texte"></i>Texte seul</span>
        <span><i class="d-mini d-mini--cartes"></i>Trois points forts</span><span><i class="d-mini d-mini--appel"></i>Bande « Réservez »</span></div></div>
      <div class="d-bloc d-bloc--nouveau" data-d="nouveau"><span class="d-sur">Information</span><p class="d-titre d-modifiable" data-d="ntitre">Votre titre ici</p><span class="d-ligne d-ligne--courte"></span></div>`,
    etapes: [
      { legende: 'Entre deux sections, touchez « ＋ Ajouter une section ici ».', doigt: 'plus', toucher: true, action: () => D.montrer('feuille') },
      { legende: 'Choisissez un modèle. Ici : « Texte seul », pour une information.', doigt: 'seul', toucher: true, cacherDoigt: true, action: () => { D.montrer('feuille', false); const n = D.el('nouveau'); D.el('plus').after(n); n.classList.add('d-visible'); } },
      { legende: 'La section apparaît avec un texte d’exemple : touchez-le…', doigt: 'ntitre', toucher: true, action: () => D.classe('ntitre', 'd-actif') },
      { legende: '… et écrivez le vôtre. La mise en page est déjà prête.', action: async (j) => { await D.taper('ntitre', 'Fermé le 25 décembre', j); D.classe('ntitre', 'd-actif', false); } },
      { legende: 'Tant qu’un texte d’exemple reste, l’application vous le rappelle avant de publier.', attente: 2600 },
    ],
  },
  photo: {
    titre: 'Changer une photo', resume: 'Remplacer et cadrer',
    scene: ECRAN_SITE(`<div class="d-bloc d-bloc--photo"><span class="d-photo" data-d="photo"></span><span class="d-ligne"></span></div><div class="d-bloc"><span class="d-ligne"></span><span class="d-ligne d-ligne--courte"></span></div>`)
      + `<div class="d-feuille" data-d="fiche"><p class="d-feuille__titre">Modifier la section</p><span class="d-cadre" data-d="cadre"><span class="d-cadre__img" data-d="cadreimg"></span></span>
        <div class="d-boutons"><span data-d="remplacer">Remplacer</span><span>＋</span><span>－</span></div><b class="d-valider" data-d="valider">Valider</b></div>
      <div class="d-galerie" data-d="galerie"><p>Vos photos</p><div><span class="d-vignette d-vignette--1"></span><span class="d-vignette d-vignette--2" data-d="choix"></span><span class="d-vignette d-vignette--3"></span></div></div>`,
    etapes: [
      { legende: 'Touchez la photo que vous voulez changer.', doigt: 'photo', toucher: true, action: () => D.montrer('fiche') },
      { legende: 'Touchez « Remplacer »…', doigt: 'remplacer', toucher: true, action: () => D.montrer('galerie') },
      { legende: '… et choisissez une photo de votre téléphone.', doigt: 'choix', toucher: true, cacherDoigt: true, action: () => { D.montrer('galerie', false); D.classe('cadreimg', 'd-nouvelle'); } },
      { legende: 'Faites glisser la photo avec le doigt pour bien la cadrer.', doigt: 'cadre', appui: true },
      { legende: 'Elle suit votre doigt : gardez le visage bien au centre.', doigtVers: 'cadre', decalageX: -0.28, action: () => D.classe('cadreimg', 'd-decalee') },
      { legende: 'Touchez « Valider » : la nouvelle photo est en place.', relacher: true, doigt: 'valider', toucher: true, cacherDoigt: true, action: () => { D.montrer('fiche', false); D.classe('photo', 'd-nouvelle'); } },
    ],
  },
  publier: {
    titre: 'Vérifier et publier', resume: 'Aperçu puis mise en ligne',
    scene: ECRAN_SITE(`<div class="d-bloc"><p class="d-titre">Offre spéciale de Noël</p><span class="d-ligne"></span></div><div class="d-bloc d-bloc--photo"><span class="d-photo"></span></div>`)
      + `<div class="d-publier"><span class="d-rond">↶</span><small>2 à publier</small><span data-d="apercu">Aperçu</span><b data-d="publier">Publier</b></div>
      <div class="d-apercu" data-d="vue"><p>Aperçu de vos modifications</p><span class="d-apercu__page"></span></div>
      <div class="d-feuille" data-d="confirmer"><p class="d-feuille__titre" data-d="ctitre">Publier sur le site ?</p><p class="d-liste" data-d="cliste">• Texte modifié<br>• Photo changée</p><b class="d-valider" data-d="go">Publier</b></div>`,
    etapes: [
      { legende: 'Vos changements restent en brouillon, en sécurité sur votre téléphone. Touchez « Aperçu » pour voir le résultat.', doigt: 'apercu', toucher: true, action: () => D.montrer('vue') },
      { legende: 'Vous voyez la page exactement comme vos clientes la verront.', attente: 2200, action: () => D.montrer('vue', false) },
      { legende: 'Tout est bon ? Touchez « Publier ».', doigt: 'publier', toucher: true, cacherDoigt: true, action: () => D.montrer('confirmer') },
      { legende: 'L’application résume ce qui change. Touchez « Publier » pour confirmer.', doigt: 'go', toucher: true, cacherDoigt: true, action: () => { D.el('ctitre').textContent = 'C’est envoyé ✓'; D.el('cliste').textContent = 'Votre site sera à jour dans une minute environ.'; D.montrer('go', false); D.classe('go', 'd-cache'); } },
      { legende: 'Une erreur ? Rien n’est perdu : l’onglet Historique permet de revenir en arrière.', attente: 2800 },
    ],
  },
};

function afficherListeDemos() {
  $('#demos-liste').innerHTML = Object.entries(DEMOS).map(([cle, d], i) => `
    <button type="button" class="demo-carte" data-demo="${cle}">
      <span class="demo-carte__num">${i + 1}</span>
      <span class="demo-carte__texte"><strong>${d.titre}</strong><small>${d.resume}</small></span>
      <span class="demo-carte__jouer" aria-hidden="true">▶</span>
    </button>`).join('');
}
afficherListeDemos();

function ouvrirAide() { $('#fiche-aide').showModal(); }
$('#accueil-demos').addEventListener('click', () => { $('#fiche-accueil').close(); ouvrirAide(); });
$('#ouvrir-demos').addEventListener('click', () => { $('#fiche-compte').close(); ouvrirAide(); });
$('#ouvrir-historique').addEventListener('click', () => { $('#fiche-compte').close(); ouvrirOnglet('historique'); });
$('#demos-liste').addEventListener('click', (e) => {
  const b = e.target.closest('[data-demo]');
  if (b) { $('#fiche-aide').close(); ouvrirDemo(b.dataset.demo); }
});
$('#aide-visite').addEventListener('click', () => { $('#fiche-aide').close(); lancerVisite(VISITE_EDITEUR); });

function arreterDemo() {
  demo.jeton++;
  demo.minuteries.forEach(clearTimeout);
  demo.minuteries = [];
}

function ouvrirDemo(cle) {
  demo.cle = cle;
  $('#demo-titre').textContent = DEMOS[cle].titre;
  if (!$('#fiche-demo').open) $('#fiche-demo').showModal();
  jouerDemo();
}

async function jouerDemo() {
  arreterDemo();
  const jeton = demo.jeton;
  const d = DEMOS[demo.cle];
  const zone = $('#demo');
  zone.innerHTML = `${d.scene}<span class="demo__doigt" id="demo-doigt"></span>`;
  $('#demo-points').innerHTML = d.etapes.map(() => '<i></i>').join('');
  const doigt = $('#demo-doigt');
  const viser = (nom, dx = 0.5, dy = 0.5) => {
    const el = D.el(nom); if (!el) return;
    const r = el.getBoundingClientRect(); const z = zone.getBoundingClientRect();
    doigt.style.left = `${r.left - z.left + r.width * dx}px`;
    doigt.style.top = `${r.top - z.top + r.height * dy}px`;
    doigt.classList.add('d-visible');
  };
  doigt.style.left = '78%'; doigt.style.top = '92%';
  await pauseDemo(500);
  for (const [i, e] of d.etapes.entries()) {
    if (jeton !== demo.jeton) return;
    $('#demo-num').textContent = `${i + 1}/${d.etapes.length}`;
    $('#demo-legende').textContent = e.legende;
    $$('#demo-points i').forEach((p, k) => p.classList.toggle('actif', k <= i));
    if (e.relacher) doigt.classList.remove('d-appui');
    if (e.doigt) { viser(e.doigt); await pauseDemo(950); }
    if (e.doigtVers) { viser(e.doigtVers, 0.5 + (e.decalageX || 0), e.decalage ?? 0.5); await pauseDemo(1100); }
    if (e.appui) { doigt.classList.add('d-appui'); await pauseDemo(500); }
    if (e.toucher) { doigt.classList.remove('d-tape'); void doigt.offsetWidth; doigt.classList.add('d-tape'); await pauseDemo(350); }
    if (jeton !== demo.jeton) return;
    if (e.action) await e.action(jeton);
    if (e.cacherDoigt || (!e.doigt && !e.doigtVers && !e.appui)) doigt.classList.remove('d-visible');
    // Temps de lecture : au moins 3 s, plus pour les phrases longues
    await pauseDemo(e.attente ?? Math.max(3000, e.legende.length * 38));
  }
  if (jeton === demo.jeton) $('#demo-revoir').focus({ preventScroll: true });
}

$('#demo-revoir').addEventListener('click', jouerDemo);
$('#demo-compris').addEventListener('click', () => $('#fiche-demo').close());
$('#demo-autres').addEventListener('click', () => { $('#fiche-demo').close(); ouvrirAide(); });
$('#fiche-demo').addEventListener('close', arreterDemo);

function proposerDemoPublier() {
  try { if (localStorage.getItem('nc_demo_publier')) return; localStorage.setItem('nc_demo_publier', '1'); } catch { return; }
  setTimeout(() => notifier('Première modification ! Elle reste en brouillon jusqu’à « Publier ».', { libelle: '▶ Voir comment', action: () => ouvrirDemo('publier') }), 3400);
}

// Raccourcis « Voir la démo » placés aux endroits où l'on en a besoin
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-voir-demo]');
  if (!b) return;
  e.preventDefault();
  ouvrirDemo(b.dataset.voirDemo);
});

// --- Statistiques de visite ----------------------------------------------------------
// Données anonymes envoyées par le site (js/main.js → api/stats), lues ici par l'API (action « stats »).

let joursStats = 7;
const fr = (n) => Number(n || 0).toLocaleString('fr-FR');
const NOMS_SOURCES = {
  google: 'Google', bing: 'Bing', 'autres-moteurs': 'Autres moteurs de recherche', instagram: 'Instagram', facebook: 'Facebook',
  tiktok: 'TikTok', snapchat: 'Snapchat', whatsapp: 'Lien WhatsApp', youtube: 'YouTube', 'google-maps': 'Google Maps',
  direct: 'Accès direct (adresse tapée, favori…)', 'autre-site': 'Un autre site',
};
const NOMS_ACTIONS = { whatsapp: 'WhatsApp ouvert', appel: 'Appel lancé', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', snapchat: 'Snapchat', youtube: 'YouTube', itineraire: 'Itinéraire' };
// Provenance en une phrase : « venu de Google », « venu d'Instagram », « arrivé directement »
const provenance = (src) => (src === 'direct' ? 'arrivé directement (adresse, favori…)' : src === 'autre-site' ? 'venu d’un autre site'
  : /^[aeiouyAEIOUY]/.test(NOMS_SOURCES[src] || '') ? `venu d’${NOMS_SOURCES[src]}` : `venu de ${NOMS_SOURCES[src] || src || '?'}`);
const NOMS_APPAREILS = { mobile: 'Téléphone', ordinateur: 'Ordinateur', tablette: 'Tablette' };
const duree = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s` : `${sec} s`);

async function chargerStats() {
  $$('[data-jours]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.jours) === joursStats)));
  const zone = $('#stats-contenu');
  if (!zone.dataset.charge) zone.innerHTML = '<p class="aide"><span class="chargement"></span> Chargement des statistiques…</p>';
  try {
    const d = await api('stats', { params: `&jours=${joursStats}` });
    zone.dataset.charge = '1';
    afficherStats(d);
  } catch (err) {
    zone.innerHTML = `<p class="message message--erreur">${echapper(err.message)}</p>`;
  }
}
$$('[data-jours]').forEach((b) => b.addEventListener('click', () => { joursStats = Number(b.dataset.jours); chargerStats(); }));

// --- En direct : toutes les 10 secondes pendant que l'onglet est ouvert -----------------------
// Requête légère (qui est sur le site, sur quelle page, chiffres du jour) ; le tableau complet
// n'est rechargé que si un chiffre du jour a bougé.
let dernierJour = null;
async function chargerDirect() {
  let d;
  try { d = await api('direct'); } catch { return; }
  if (!d.actif || etat.onglet !== 'stats') return;
  const nom = (p) => d.nomsPages[p] || (p === 'autre' ? 'Autre page' : p);
  $('#stats-live').hidden = false;
  $('#stats-live span').textContent = d.enLigne ? `${d.enLigne} personne${d.enLigne > 1 ? 's' : ''} sur le site en ce moment` : 'Personne sur le site en ce moment';
  $('#stats-live').classList.toggle('stats__live--actif', d.enLigne > 0);
  const a = d.aujourdhui;
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('#stats-direct').hidden = false;
  $('#stats-direct-pages').innerHTML = d.pagesEnLigne.length
    ? `En train de regarder : ${d.pagesEnLigne.map(([p, n]) => `<b>${echapper(nom(p))}</b>${n > 1 ? ` (${n})` : ''}`).join(', ')}` : '';
  $('#stats-direct-pages').hidden = !d.pagesEnLigne.length;
  $('#stats-direct-jour').innerHTML = `Aujourd’hui : <b>${a.visiteurs}</b> visiteur${a.visiteurs > 1 ? 's' : ''} · <b>${a.vues}</b> page${a.vues > 1 ? 's' : ''} vue${a.vues > 1 ? 's' : ''} · <b>${a.contacts}</b> WhatsApp ou appel${a.contacts > 1 ? 's' : ''} <small>· à jour à ${heure}</small>`;
  const cle = JSON.stringify(a);
  if (dernierJour && cle !== dernierJour && !$$('dialog[open]').length) chargerStats();
  dernierJour = cle;
}
setInterval(() => { if (document.visibilityState === 'visible' && etat.onglet === 'stats' && !$('#appli').hidden) chargerDirect(); }, 10000);

// Cet appareil est exclu des statistiques (les visites de Nelly ne comptent pas) : on peut le compter, pour essayer
const CLE_COMPTER = 'nc_stats_compter';
function afficherAppareil() {
  let compte = false;
  try { compte = localStorage.getItem(CLE_COMPTER) === '1'; } catch { /* sans effet */ }
  $('#stats-appareil').innerHTML = compte
    ? 'Vos visites depuis cet appareil <b>sont comptées</b> (mode essai). <button type="button" class="lien-demo">Ne plus les compter</button>'
    : 'Vos propres visites depuis cet appareil ne sont pas comptées. <button type="button" class="lien-demo">Les compter pour essayer</button>';
  $('#stats-appareil button').onclick = () => {
    try {
      if (compte) { localStorage.removeItem(CLE_COMPTER); localStorage.setItem('nc_stats_off', '1'); }
      else { localStorage.setItem(CLE_COMPTER, '1'); localStorage.removeItem('nc_stats_off'); }
    } catch { /* sans effet */ }
    afficherAppareil();
    notifier(compte ? 'Vos visites ne sont plus comptées.' : 'Ouvrez maintenant le site sur cet appareil : votre visite apparaîtra ici en quelques secondes.');
  };
}

function afficherStats(d) {
  const zone = $('#stats-contenu');
  $('#stats-live').hidden = true;
  if (!d.actif) {
    zone.innerHTML = `<div class="carte stats__vide"><h2>Les statistiques ne sont pas encore activées</h2>
      <p class="aide">Il manque la petite base de données gratuite qui garde les chiffres de visite. Elle s’active une seule fois, depuis le tableau de bord Vercel du site (voir le guide <strong>ESPACE-DE-GESTION.md</strong>). Ensuite, les visites s’affichent ici automatiquement.</p></div>`;
    return;
  }
  const nom = (p) => d.nomsPages[p] || (p === 'autre' ? 'Autre page' : p);
  const r = d.resume; const av = d.precedent;
  const evolution = (a, b, inverse = false) => {
    if (!b) return ''; // pas de période précédente à comparer
    const pct = Math.round(((a - b) / b) * 100);
    if (!pct) return '<span class="stats__evol stats__evol--neutre">stable</span>';
    const bon = inverse ? pct < 0 : pct > 0;
    return `<span class="stats__evol ${bon ? 'stats__evol--bon' : 'stats__evol--moins'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)} %</span>`;
  };
  const tauxContact = r.visites ? Math.round((100 * r.contacts) / r.visites) : 0;
  $('#stats-live').hidden = false;
  $('#stats-live span').textContent = d.enLigne ? `${d.enLigne} personne${d.enLigne > 1 ? 's' : ''} sur le site en ce moment` : 'Personne sur le site en ce moment';
  $('#stats-live').classList.toggle('stats__live--actif', d.enLigne > 0);

  if (!r.visites && !r.vues) {
    zone.innerHTML = `<div class="carte stats__vide"><h2>Pas encore de visite sur cette période</h2>
      <p class="aide">Les statistiques sont bien activées. Dès qu’une personne ouvre le site, elle apparaît ici, en quelques secondes. Vos propres visites, depuis cet appareil, ne sont pas comptées.</p></div>`;
    return;
  }

  const kpi = (titre, valeur, aide, evol) => `<div class="stats__kpi"><p>${titre}</p><strong>${valeur}</strong>${evol || ''}<small>${aide}</small></div>`;
  const barres = (liste, total, libelle, max = 8) => (liste.length ? `<ul class="stats__barres">${liste.slice(0, max).map(([c, v]) => {
    const pct = total ? Math.round((100 * v) / total) : 0;
    return `<li><span class="stats__barres-nom">${echapper(libelle(c))}</span><span class="stats__barres-val">${fr(v)}<small>${pct} %</small></span><i style="--p:${Math.max(2, pct)}%"></i></li>`;
  }).join('')}</ul>` : '<p class="aide">Pas encore de données.</p>');

  // Courbe des visites par jour (avec les contacts)
  const courbe = () => {
    const pts = d.courbe;
    if (pts.length < 2) return '';
    const max = Math.max(1, ...pts.map((p) => p.visites));
    const L = 640; const H = 170; const pas = L / (pts.length - 1);
    const y = (v) => H - 14 - ((H - 34) * v) / max;
    const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * pas).toFixed(1)} ${y(p.visites).toFixed(1)}`).join(' ');
    const aire = `${ligne} L${L} ${H - 14} L0 ${H - 14} Z`;
    const etiquettes = pts.map((p, i) => ((pts.length <= 8 || i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1)
      ? `<text x="${(i * pas).toFixed(1)}" y="${H}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${new Date(`${p.jour}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>` : '')).join('');
    const contacts = pts.map((p, i) => (p.contacts ? `<circle cx="${(i * pas).toFixed(1)}" cy="${y(p.visites).toFixed(1)}" r="5" class="stats__point-contact"><title>${p.contacts} WhatsApp ou appel${p.contacts > 1 ? 's' : ''}</title></circle>` : '')).join('');
    const points = pts.map((p, i) => `<circle cx="${(i * pas).toFixed(1)}" cy="${y(p.visites).toFixed(1)}" r="3" class="stats__point"><title>${new Date(`${p.jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${p.visites} visite${p.visites > 1 ? 's' : ''}, ${p.vues} page${p.vues > 1 ? 's' : ''} vue${p.vues > 1 ? 's' : ''}</title></circle>`).join('');
    return `<div class="carte"><h3 class="stats__titre">Visites par jour</h3>
      <svg class="stats__courbe" viewBox="-6 0 ${L + 12} ${H + 4}" role="img" aria-label="Courbe des visites par jour"><defs><linearGradient id="stats-degrade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B57A50" stop-opacity=".35"/><stop offset="1" stop-color="#B57A50" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${L}" y1="${H - 14}" y2="${H - 14}" class="stats__axe"/><path d="${aire}" fill="url(#stats-degrade)"/><path d="${ligne}" class="stats__ligne"/>${points}${contacts}${etiquettes}</svg>
      <p class="aide aide--petite"><span class="stats__legende-contact"></span> jours où WhatsApp a été ouvert ou un appel lancé</p></div>`;
  };

  // Heures d'affluence
  const heures = () => {
    const max = Math.max(1, ...d.heures);
    return `<div class="stats__heures">${d.heures.map((v, h) => `<span title="${h} h : ${v} visite${v > 1 ? 's' : ''}"><i style="--h:${Math.round((100 * v) / max)}%"></i>${h % 3 === 0 ? `<small>${h}h</small>` : ''}</span>`).join('')}</div>`;
  };

  // Dernières visites : le parcours de chaque personne
  const visite = (v) => {
    const etapes = v.etapes;
    const pages = [];
    for (const e of etapes) {
      if (e.type === 'v') pages.push({ page: e.page, t: e.t, contacts: [] });
      else if (e.type === 'f' && pages.length) { const p = [...pages].reverse().find((x) => x.page === e.page && x.duree === undefined); if (p) p.duree = e.duree; }
      else if (e.type === 'c' && pages.length) pages[pages.length - 1].contacts.push(e.contact);
    }
    const contact = etapes.some((e) => e.type === 'c' && ['whatsapp', 'appel'].includes(e.contact));
    const quand = new Date(v.debut).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<li class="stats__visite${contact ? ' stats__visite--contact' : ''}">
      <div class="stats__visite-haut"><strong>${quand}</strong>${contact ? '<span class="pastille pastille--vert">a ouvert WhatsApp ou appelé</span>' : ''}</div>
      <p class="stats__visite-infos">${echapper(NOMS_APPAREILS[v.app] || v.app || '')} · ${echapper(v.ville && v.ville !== 'inconnue' ? v.ville : 'ville inconnue')} · ${echapper(provenance(v.src))}</p>
      <ol class="stats__parcours">${pages.map((p) => `<li><span>${echapper(nom(p.page))}</span>${p.duree !== undefined ? `<small>${duree(p.duree)}</small>` : ''}${p.contacts.map((c) => `<em>${echapper(NOMS_ACTIONS[c] || c)}</em>`).join('')}</li>`).join('')}</ol>
    </li>`;
  };

  const totalPages = r.vues; const totalVisites = r.visites;
  zone.innerHTML = `
    <div class="stats__kpis">
      ${kpi('Visiteurs', fr(r.visiteurs), r.visiteurs > 1 ? 'personnes différentes' : 'personne', evolution(r.visiteurs, av.visiteurs))}
      ${kpi('Visites', fr(r.visites), `${fr(r.vues)} page${r.vues > 1 ? 's' : ''} vue${r.vues > 1 ? 's' : ''}`, evolution(r.visites, av.visites))}
      ${kpi('WhatsApp et appels', fr(r.contacts), `${tauxContact} % des visites`, evolution(r.contacts, av.contacts))}
      ${kpi('Temps moyen', duree(r.dureeMoyenne), 'passé sur une page', evolution(r.dureeMoyenne, av.dureeMoyenne))}
    </div>
    <p class="stats__phrase">${r.rebond > 0 ? `${r.rebond} % des visiteurs repartent après une seule page.` : 'Les visiteurs regardent plusieurs pages.'} En moyenne, ils lisent ${r.defilement} % de chaque page.</p>
    ${courbe()}
    <div class="stats__grille">
      <div class="carte"><h3 class="stats__titre">D’où viennent les visiteurs</h3>${barres(d.sources, totalVisites, (c) => NOMS_SOURCES[c] || c)}</div>
      <div class="carte"><h3 class="stats__titre">Pages les plus vues</h3>${barres(d.pages, totalPages, nom)}</div>
      <div class="carte"><h3 class="stats__titre">Ce qu’ils ont fait</h3>${barres(d.actions, d.actions.reduce((a, [, v]) => a + v, 0), (c) => NOMS_ACTIONS[c] || c)}
        ${d.contactsParPage.length ? `<p class="stats__sous-titre">Pages d’où WhatsApp s’ouvre ou l’appel part</p>${barres(d.contactsParPage, r.contacts, nom, 5)}` : ''}</div>
      <div class="carte"><h3 class="stats__titre">Appareils</h3>${barres(d.appareils, totalVisites, (c) => NOMS_APPAREILS[c] || c)}
        <p class="stats__sous-titre">Villes</p>${barres(d.villes, totalVisites, (c) => (c === 'inconnue' ? 'Inconnue' : c), 6)}</div>
    </div>
    <div class="carte"><h3 class="stats__titre">Heures d’affluence</h3>${heures()}</div>
    <h2 class="sous-titre">Parcours des visiteurs</h2>
    <div class="stats__grille">
      <div class="carte"><h3 class="stats__titre">Page d’arrivée</h3>${barres(d.entrees, totalVisites, nom, 6)}</div>
      <div class="carte"><h3 class="stats__titre">Page de départ</h3>${barres(d.sorties, d.sorties.reduce((a, [, v]) => a + v, 0), nom, 6)}</div>
      <div class="carte stats__large"><h3 class="stats__titre">Chemins les plus fréquents</h3>
        ${d.chemins.length ? `<ul class="stats__chemins">${d.chemins.slice(0, 8).map(([c, v]) => `<li><span>${c.split(' → ').map((p) => `<b>${echapper(nom(p))}</b>`).join('<i>→</i>')}</span><strong>${fr(v)}</strong></li>`).join('')}</ul>` : '<p class="aide">Pas encore de données.</p>'}</div>
    </div>
    <h2 class="sous-titre">Dernières visites</h2>
    <p class="aide">Chaque visite, page par page, avec le temps passé. Les personnes restent anonymes.</p>
    <ul class="stats__visites">${d.visites.slice(0, 20).map(visite).join('')}</ul>
    <p class="aide aide--petite stats__note">« WhatsApp et appels » compte les fois où WhatsApp ou le téléphone s’ouvre depuis le site. WhatsApp ne dit à personne si le message est vraiment envoyé : les messages reçus se voient dans le WhatsApp de Nelly. Mesure anonyme, sans cookie : une personne qui revient un autre jour compte à nouveau comme visiteur. Vos propres visites depuis cet appareil ne sont pas comptées.</p>`;
}

// --- Actualisation automatique ---------------------------------------------------------
// Toutes les minutes (et dès qu'on revient sur l'application) : nouvelle version de l'application,
// contenu publié depuis un autre appareil, chiffres des statistiques. Rien n'est actualisé
// tant qu'une modification n'est pas publiée ou qu'une fenêtre est ouverte.
const CLE_RETOUR = 'nc_retour_maj';
const FICHIERS_APPLI = ['/admin/', '/admin/admin.js', '/admin/admin.css'];
let empreinteAppli = null;
let derniereAction = Date.now();
let majSignalee = false;
let dernierControleContenu = 0;
['pointerdown', 'keydown', 'input', 'scroll'].forEach((t) => document.addEventListener(t, () => { derniereAction = Date.now(); }, { capture: true, passive: true }));

const connecte = () => !$('#appli').hidden && etat.contenu;
const auCalme = (retour) => connecte() && !modifie() && !$$('dialog[open]').length && !document.querySelector('[contenteditable="true"]')
  && (retour || (Date.now() - derniereAction > 20000 && etat.onglet !== 'pages'));

async function lireEmpreinteAppli() {
  try {
    const r = await Promise.all(FICHIERS_APPLI.map((f) => fetch(f, { method: 'HEAD', cache: 'no-store' })));
    const e = r.map((x) => x.headers.get('etag') || x.headers.get('last-modified') || '').join('|');
    return e.replace(/\|/g, '') ? e : null;
  } catch { return null; }
}

async function controlerAppli(retour) {
  const e = await lireEmpreinteAppli();
  if (!e) return;
  if (!empreinteAppli) { empreinteAppli = e; return; }
  if (e === empreinteAppli) return;
  if (auCalme(retour)) {
    try { sessionStorage.setItem(CLE_RETOUR, etat.onglet); } catch { /* sans effet */ }
    navigator.serviceWorker?.getRegistration('/admin/').then((r) => r?.update()).catch(() => {});
    location.reload();
  } else if (!majSignalee && connecte()) {
    majSignalee = true;
    if (modifie()) notifier('Une nouvelle version de l’application est prête : elle s’installera après votre publication.');
    else notifier('Une nouvelle version de l’application est prête.', { libelle: 'Actualiser', action: () => controlerAppli(true) });
  }
}

async function controlerContenu(retour) {
  if (!connecte() || Date.now() - dernierControleContenu < (retour ? 15000 : 110000)) return;
  dernierControleContenu = Date.now();
  let r;
  try { r = await api('contenu'); } catch { return; }
  if (!r.version || r.version === etat.version || !auCalme(retour)) return;
  normaliser(r.contenu);
  etat.base = r.contenu;
  etat.version = r.version;
  etat.contenu = structuredClone(r.contenu);
  etat.defaire = [];
  etat.refaire = [];
  toutAfficher();
  notifier('Contenu actualisé : les dernières modifications publiées sont affichées.');
}

function actualiser(retour = false) {
  if (document.visibilityState !== 'visible') return;
  controlerAppli(retour);
  controlerContenu(retour);
  if (connecte() && etat.onglet === 'stats' && !$$('dialog[open]').length) chargerStats();
}
setInterval(() => actualiser(false), 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') actualiser(true); });
window.addEventListener('online', () => actualiser(true));

// Après une mise à jour automatique : on revient là où on était
function reprendreApresMaj() {
  let onglet = null;
  try { onglet = sessionStorage.getItem(CLE_RETOUR); sessionStorage.removeItem(CLE_RETOUR); } catch { /* sans effet */ }
  if (!onglet || !TITRES[onglet] || !connecte()) return;
  $$('dialog[open]').forEach((d) => d.close());
  ouvrirOnglet(onglet);
  notifier('Application mise à jour.');
}

// Prévenir avant de quitter avec des images non publiées (elles ne sont pas gardées sur l'appareil)
window.addEventListener('beforeunload', (e) => { if (modifie() && [...etat.nouvelles.values()].some((p) => p.grand)) { e.preventDefault(); e.returnValue = ''; } });

// Application installable (Android) et ouverture sans réseau de l'écran de démarrage
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});

demarrer().then(reprendreApresMaj).catch(() => afficherConnexion());
lireEmpreinteAppli().then((e) => { empreinteAppli = empreinteAppli || e; });
