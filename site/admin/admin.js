// Espace de gestion de Nelly Coiffure.
// Les modifications restent sur l'appareil (brouillon) jusqu'à « Publier » : l'API régénère alors le site
// et Vercel le remet en ligne en une minute environ. « Aperçu » montre la page générée sans rien publier.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DOSSIER = 'img/realisations/catalogue';
const MAX_ENVOI = 3.6 * 1024 * 1024; // marge sous la limite de 4,5 Mo d'une requête Vercel
const CLE_BROUILLON = 'nc_brouillon';
const TEL = /^0[1-9](?:[ .]?\d{2}){4}$/;
const RESEAUX = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', snapchat: 'Snapchat' };
const PAGES = [
  ['index.html', 'Accueil'], ['coiffures.html', 'Coiffures et tarifs'], ['realisations.html', 'Réalisations'],
  ['a-propos.html', 'À propos'], ['contact.html', 'Contact'], ['knotless-braids-marseille.html', 'Knotless braids'],
  ['locks-marseille.html', 'Locks'], ['tresses-enfant-marseille.html', 'Tresses enfant'],
  ['coiffure-afro-domicile-marseille.html', 'Coiffure à domicile'], ['conseils-tresses-africaines.html', 'Conseils tresses'],
];
const FORMATS = { section: 'Grande section', carte: 'Carte', encadre: 'Encadré', bandeau: 'Bandeau' };

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
  const { contenu, version } = await api('contenu');
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
  return c;
}

function retirerImagesPerdues() {
  const connues = new Set(imagesUtilisees(etat.base));
  const perdues = imagesUtilisees(etat.contenu).filter((img) => !connues.has(img) && !etat.nouvelles.has(img));
  if (!perdues.length) return false;
  etat.contenu.photos = etat.contenu.photos.filter((p) => !perdues.includes(p.image));
  etat.contenu.services = etat.contenu.services.filter((s) => !perdues.includes(s.photo));
  etat.contenu.annonces.forEach((a) => { if (a.image && perdues.includes(a.image.src)) a.image = null; });
  Object.values(etat.contenu.pages).forEach((p) => Object.keys(p.images || {}).forEach((id) => { if (perdues.includes(p.images[id].src)) delete p.images[id]; }));
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
    if (!avant) lignes.push(`Nouvelle annonce : ${x.titre || x.texte}`);
    else if (JSON.stringify(avant) !== JSON.stringify(x)) lignes.push(`Annonce modifiée : ${x.titre || x.texte}`);
  }
  for (const x of a.annonces) if (!b.annonces.some((y) => y.id === x.id)) lignes.push(`Annonce supprimée : ${x.titre || x.texte}`);
  if (JSON.stringify(a.horaires) !== JSON.stringify(b.horaires)) lignes.push('Horaires');
  if (JSON.stringify(a.telephones) !== JSON.stringify(b.telephones)) lignes.push('Téléphones');
  for (const [cle, nom] of Object.entries(RESEAUX)) if (a.reseaux[cle] !== b.reseaux[cle]) lignes.push(`Lien ${nom}`);
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
const imagesUtilisees = (c) => [...new Set([...c.services.map((s) => s.photo), ...c.photos.map((p) => p.image), ...(c.annonces || []).map((a) => a.image?.src).filter(Boolean), ...Object.values(c.pages || {}).flatMap((p) => Object.values(p.images || {}).map((im) => im.src))])];
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
  if (!liste.length) {
    ul.innerHTML = '<li class="vide">Aucune annonce pour le moment. Créez-en une pour mettre en avant une offre ou une information.</li>';
    return;
  }
  ul.innerHTML = liste.map((a, i) => {
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
          <button type="button" data-a-monter="${i}" aria-label="Monter l’annonce" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-a-descendre="${i}" aria-label="Descendre l’annonce" ${i === liste.length - 1 ? 'disabled' : ''}>▼</button>
        </span>
      </li>`;
  }).join('');
}

$('#liste-annonces').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const l = etat.contenu.annonces;
  if (b.dataset.annonce !== undefined) return ouvrirAnnonce(Number(b.dataset.annonce));
  const i = Number(b.dataset.aMonter ?? b.dataset.aDescendre);
  const j = b.dataset.aMonter !== undefined ? i - 1 : i + 1;
  [l[i], l[j]] = [l[j], l[i]];
  afficherAnnonces();
  changement();
});

$('#ajouter-annonce').addEventListener('click', () => ouvrirAnnonce(-1));

$('#a-bouton-page').innerHTML = PAGES.map(([f, n]) => `<option value="${f}">${n}</option>`).join('');
$('#a-pages').innerHTML = PAGES.map(([f, n]) => `<label class="case"><input type="checkbox" value="${f}"><span>${n}</span></label>`).join('');

let ficheAnnonce = null; // { index, a }

function ouvrirAnnonce(index) {
  const a = index >= 0 ? structuredClone(etat.contenu.annonces[index]) : {
    id: `annonce-${Date.now().toString(36)}`, active: true, format: 'section', etiquette: '', titre: '', texte: '',
    image: null, bouton: { texte: '', type: 'whatsapp', valeur: '' }, pages: ['index.html'], debut: '', fin: '',
  };
  a.bouton = a.bouton || { texte: '', type: 'whatsapp', valeur: '' };
  ficheAnnonce = { index, a };
  $('#annonce-titre-fiche').textContent = index >= 0 ? 'Modifier l’annonce' : 'Nouvelle annonce';
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
  majFicheAnnonce();
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
  a.pages = $('#a-toutes').checked ? ['toutes'] : $$('#a-pages input:checked').map((c) => c.value);
  a.debut = $('#a-debut').value;
  a.fin = $('#a-fin').value;
  a.active = $('#a-active').checked;
  if (a.format === 'encadre' || a.format === 'bandeau') a.image = null;
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
});

function verifierAnnonce(a) {
  if (a.format === 'bandeau' ? !a.texte : !a.titre) return a.format === 'bandeau' ? 'Écrivez le message du bandeau.' : 'Donnez un titre à l’annonce.';
  if ((a.format === 'section') && !a.image) return 'La grande section a besoin d’une image. Ajoutez-en une, ou choisissez « Encadré ».';
  if (a.bouton.texte) {
    if (a.bouton.type === 'externe' && !urlValide(a.bouton.valeur)) return 'L’adresse du bouton doit être complète et commencer par https:// (copiez-la depuis votre navigateur).';
    if (a.bouton.type === 'telephone' && !TEL.test(a.bouton.valeur)) return 'Le numéro du bouton doit ressembler à 06 12 34 56 78.';
  }
  if (!a.pages.length) return 'Choisissez au moins une page où afficher l’annonce.';
  if (a.debut && a.fin && a.fin < a.debut) return 'La date de fin est avant la date de début.';
  if (a.fin && a.fin < aujourdhui()) return 'La date de fin est déjà passée : l’annonce ne serait pas affichée.';
  return '';
}

$('#a-supprimer').addEventListener('click', () => {
  const a = etat.contenu.annonces[ficheAnnonce.index];
  if (!confirm(`Supprimer l’annonce « ${a.titre || a.texte} » ?\n\nAstuce : pour la retirer temporairement, décochez plutôt « Annonce active ».`)) return;
  etat.contenu.annonces.splice(ficheAnnonce.index, 1);
  $('#fiche-annonce').close();
  afficherAnnonces();
  changement();
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

// --- Infos : horaires, téléphones, réseaux ----------------------------------------

function afficherInfos() {
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
      <input id="r-${cle}" type="url" inputmode="url" data-reseau="${cle}" value="${echapper(etat.contenu.reseaux[cle])}">
      <a class="bouton bouton--discret" href="${echapper(etat.contenu.reseaux[cle])}" target="_blank" rel="noopener" data-tester="${cle}">Tester</a>
    </div>
    <p class="message message--erreur" id="erreur-r-${cle}" hidden>Adresse incomplète : elle doit commencer par https://</p>`).join('');
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
  $(`#erreur-r-${cle}`).hidden = ok;
  $(`[data-tester="${cle}"]`).href = ok ? e.target.value.trim() : '#';
  changement({ regrouper: true });
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
  for (const k of ['ordre', 'masquees']) if (p[k] && !p[k].length) delete p[k];
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
          <strong>${echapper(s.titre)}${s.masquee ? '<span class="badge">masquée</span>' : ''}</strong>
          <small>${details || 'Section décorative'}</small>
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
$('#page-apercu').addEventListener('click', async () => {
  $('#apercu-page').value = pageEnCours();
  $('#fiche-apercu').showModal();
  await chargerApercu();
});

$('#liste-sections').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.section !== undefined) return ouvrirSection(Number(b.dataset.section));
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
  $('#section-champs').innerHTML = [
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
    for (const [img, p] of etat.nouvelles) if (p.apercu) page = page.split(`${img}-sm.jpg`).join(p.apercu).split(`${img}.jpg`).join(p.apercu);
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
  for (const [cle, nom] of Object.entries(RESEAUX)) if (!urlValide(etat.contenu.reseaux[cle])) problemes.push(`Lien ${nom} incomplet (onglet Infos).`);
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
    .flatMap(([img, p]) => [{ chemin: `${img}.jpg`, base64: p.grand }, { chemin: `${img}-sm.jpg`, base64: p.petit }]);
  try {
    const r = await api('publier', { methode: 'POST', corps: { contenu: etat.contenu, photos, version: etat.version, resume: resumeModifications().join(', ') } });
    etat.base = normaliser(r.contenu || structuredClone(etat.contenu));
    etat.contenu = structuredClone(etat.base);
    etat.version = r.version;
    // Les images envoyées restent affichées depuis l'appareil le temps que le site se mette à jour (sans être renvoyées)
    for (const [avant, apres] of Object.entries(r.renommees || {})) {
      if (etat.nouvelles.has(avant)) { etat.nouvelles.set(apres, etat.nouvelles.get(avant)); etat.nouvelles.delete(avant); }
    }
    for (const [img, p] of etat.nouvelles) etat.nouvelles.set(img, { apercu: p.apercu });
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
