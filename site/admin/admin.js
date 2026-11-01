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

$('#form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bouton = $('#form-connexion button');
  const erreur = $('#erreur-connexion');
  erreur.hidden = true;
  bouton.disabled = true;
  try {
    await api('connexion', { methode: 'POST', corps: { motDePasse: $('#mdp').value } });
    $('#mdp').value = '';
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
  toutAfficher();
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
  $('#publier').disabled = !modifie();
  $('#ouvrir-apercu').disabled = !modifie();
  $('#defaire').disabled = !etat.defaire.length;
  $('#refaire').disabled = !etat.refaire.length;
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

const TITRES = { pages: 'Pages du site', annonces: 'Annonces', coiffures: 'Coiffures et prix', photos: 'Photos', infos: 'Infos et liens', historique: 'Historique' };
$$('.onglets button').forEach((b) => b.addEventListener('click', () => ouvrirOnglet(b.dataset.cible)));

function ouvrirOnglet(nom) {
  etat.onglet = nom;
  $$('.onglet').forEach((s) => { s.hidden = s.dataset.onglet !== nom; });
  $$('.onglets button').forEach((b) => (b.dataset.cible === nom ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $('#titre-onglet').textContent = TITRES[nom];
  if (nom === 'historique') afficherHistorique();
  if (nom === 'pages') chargerSections();
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

async function chargerSections() {
  const msg = $('#page-message');
  msg.className = 'message'; msg.hidden = false;
  msg.innerHTML = '<span class="chargement"></span> Chargement de la page…';
  try {
    const { sections: liste } = await api('apercu', { methode: 'POST', corps: { contenu: etat.contenu, page: pageEnCours() } });
    sections = liste;
    msg.hidden = true;
    afficherSections();
  } catch (err) {
    msg.className = 'message message--erreur';
    msg.textContent = err.message;
  }
}

function afficherSections() {
  const ul = $('#liste-sections');
  ul.innerHTML = sections.map((s, i) => {
    const img = s.images[0];
    const vignette = img ? `<img class="liste__image" src="${srcPage(img.src)}" alt="">` : '<span class="liste__icone" aria-hidden="true">¶</span>';
    const details = [s.textes.length && `${s.textes.length} texte${s.textes.length > 1 ? 's' : ''}`, s.images.length && `${s.images.length} image${s.images.length > 1 ? 's' : ''}`, s.boutons.length && `${s.boutons.length} bouton${s.boutons.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    return `
      <li class="${s.masquee ? 'est-masque' : ''}">
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

$('#page-choix').addEventListener('change', chargerSections);
$('#ajouter-section').addEventListener('click', () => ouvrirAnnonce(-1, { page: pageEnCours() }));
$('#page-apercu').addEventListener('click', async () => {
  $('#apercu-page').value = pageEnCours();
  $('#fiche-apercu').showModal();
  await chargerApercu();
});

$('#liste-sections').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.section !== undefined) {
    const s = sections[Number(b.dataset.section)];
    if (s.ajout) return ouvrirAnnonce(etat.contenu.annonces.findIndex((a) => a.id === s.ajout));
    return ouvrirSection(Number(b.dataset.section));
  }
  const p = modifsPage();
  if (b.dataset.masquer !== undefined) {
    const s = sections[Number(b.dataset.masquer)];
    const m = new Set(p.masquees || []);
    if (s.masquee) m.delete(s.id); else m.add(s.id);
    p.masquees = [...m];
    s.masquee = !s.masquee;
  } else {
    const i = Number(b.dataset.sMonter ?? b.dataset.sDescendre);
    const j = b.dataset.sMonter !== undefined ? i - 1 : i + 1;
    [sections[i], sections[j]] = [sections[j], sections[i]];
    p.ordre = sections.filter((s) => !s.premiere).map((s) => s.id);
  }
  nettoyerPage();
  afficherSections();
  changement();
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
    images && `<p class="etiquette">Images</p>${images}`,
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
    // Les images pas encore publiées sont affichées depuis l'appareil
    let page = html.replace('<head>', '<head><base href="/" target="_blank">');
    for (const [img, p] of etat.nouvelles) if (p.apercu) page = page.split(`${img}-sm.jpg`).join(p.apercu).split(`${img}.jpg`).join(p.apercu).split(`${img}-clair.png`).join(p.apercuClair || p.apercu).split(`${img}.png`).join(p.apercu);
    cadre.srcdoc = page;
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

// Prévenir avant de quitter avec des images non publiées (elles ne sont pas gardées sur l'appareil)
window.addEventListener('beforeunload', (e) => { if (modifie() && [...etat.nouvelles.values()].some((p) => p.grand)) { e.preventDefault(); e.returnValue = ''; } });

// Application installable (Android) et ouverture sans réseau de l'écran de démarrage
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});

demarrer().catch(() => afficherConnexion());
