// Espace de gestion de Nelly Coiffure.
// Les modifications restent sur le téléphone (brouillon) jusqu'à « Publier » : l'API régénère alors le site
// et Vercel le remet en ligne en une minute environ.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DOSSIER = 'img/realisations/catalogue';
const MAX_ENVOI = 3.6 * 1024 * 1024; // marge sous la limite de 4,5 Mo d'une requête Vercel
const CLE_BROUILLON = 'nc_brouillon';

const etat = {
  base: null, // contenu publié (dernière version chargée)
  contenu: null, // contenu en cours de modification
  version: null, // empreinte du contenu publié, pour éviter d'écraser une publication faite ailleurs
  nouvelles: new Map(), // image → { grand, petit (base64), apercu (URL) } pour les photos pas encore publiées
  onglet: 'annonce',
};

// --- API -------------------------------------------------------------------------

async function api(action, { methode = 'GET', corps, params = '' } = {}) {
  const r = await fetch(`/api/admin?action=${action}${params}`, {
    method: methode,
    credentials: 'same-origin',
    headers: corps ? { 'Content-Type': 'application/json', 'X-Nelly-Admin': '1' } : { 'X-Nelly-Admin': '1' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const donnees = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== 'connexion') { afficherConnexion(); throw new Error(donnees.erreur || 'Session expirée.'); }
  if (!r.ok) throw new Error(donnees.erreur || `Erreur ${r.status}`);
  return donnees;
}

// --- Démarrage et connexion -------------------------------------------------------

function afficherConnexion() {
  $('#appli').hidden = true;
  $('#connexion').hidden = false;
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

$('#deconnexion').addEventListener('click', async () => {
  if (modifie() && !confirm('Des modifications ne sont pas publiées. Elles resteront sur ce téléphone. Se déconnecter ?')) return;
  await api('deconnexion', { methode: 'POST', corps: {} }).catch(() => {});
  afficherConnexion();
});

async function demarrer() {
  const { contenu, version } = await api('contenu');
  etat.base = contenu;
  etat.version = version;
  etat.contenu = structuredClone(contenu);
  // Brouillon non publié gardé sur ce téléphone (les nouvelles photos, elles, ne survivent pas à la fermeture)
  try {
    const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) || 'null');
    if (b && b.version === version && JSON.stringify(b.contenu) !== JSON.stringify(contenu)) {
      etat.contenu = b.contenu;
      const perdues = imagesUtilisees(etat.contenu).filter((img) => !imagesUtilisees(etat.base).includes(img));
      if (perdues.length) {
        etat.contenu.photos = etat.contenu.photos.filter((p) => !perdues.includes(p.image));
        etat.contenu.services = etat.contenu.services.filter((s) => !perdues.includes(s.photo));
        setTimeout(() => alert('Certaines photos ajoutées avant la fermeture de l’application n’avaient pas été publiées. Ajoutez-les de nouveau.'), 300);
      }
    }
  } catch { /* stockage indisponible : on repart du contenu publié */ }
  $('#connexion').hidden = true;
  $('#appli').hidden = false;
  toutAfficher();
}

// --- Brouillon et barre de publication --------------------------------------------

const modifie = () => etat.contenu && JSON.stringify(etat.contenu) !== JSON.stringify(etat.base);

function changement() {
  try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ version: etat.version, contenu: etat.contenu })); } catch { /* sans effet */ }
  const n = resumeModifications().length;
  $('#barre-publier').hidden = !modifie();
  $('#nb-modifs').textContent = `${n || 1} modification${n > 1 ? 's' : ''}`;
}

function resumeModifications() {
  const a = etat.base;
  const b = etat.contenu;
  const lignes = [];
  if (JSON.stringify(a.annonce) !== JSON.stringify(b.annonce)) lignes.push(b.annonce.active && b.annonce.texte.trim() ? 'Annonce mise à jour' : 'Annonce retirée');
  if (JSON.stringify(a.horaires) !== JSON.stringify(b.horaires)) lignes.push('Horaires');
  if (JSON.stringify(a.telephones) !== JSON.stringify(b.telephones)) lignes.push('Téléphones');
  for (const s of b.services) {
    const avant = a.services.find((x) => x.cle === s.cle);
    if (!avant) lignes.push(`Nouvelle coiffure : ${s.nom}`);
    else if (JSON.stringify(avant) !== JSON.stringify(s)) lignes.push(avant.prix !== s.prix ? `${s.nom} : ${avant.prix} € → ${s.prix} €` : `${s.nom} modifiée`);
  }
  for (const s of a.services) if (!b.services.some((x) => x.cle === s.cle)) lignes.push(`Coiffure supprimée : ${s.nom}`);
  if (a.services.map((s) => s.cle).join() !== b.services.map((s) => s.cle).join() && lignes.length === 0) lignes.push('Ordre des coiffures');
  const ajoutees = b.photos.filter((p) => !a.photos.some((x) => x.image === p.image)).length;
  const retirees = a.photos.filter((p) => !b.photos.some((x) => x.image === p.image)).length;
  if (ajoutees) lignes.push(`${ajoutees} photo${ajoutees > 1 ? 's' : ''} ajoutée${ajoutees > 1 ? 's' : ''}`);
  if (retirees) lignes.push(`${retirees} photo${retirees > 1 ? 's' : ''} retirée${retirees > 1 ? 's' : ''}`);
  if (!ajoutees && !retirees && JSON.stringify(a.photos) !== JSON.stringify(b.photos)) lignes.push('Photos réorganisées');
  return lignes;
}

$('#annuler-tout').addEventListener('click', () => {
  if (!confirm('Annuler toutes les modifications non publiées ?')) return;
  etat.contenu = structuredClone(etat.base);
  etat.nouvelles.clear();
  try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans effet */ }
  toutAfficher();
});

// --- Onglets ---------------------------------------------------------------------

const TITRES = { annonce: 'Annonce', coiffures: 'Coiffures et prix', photos: 'Photos', horaires: 'Horaires', historique: 'Historique' };
$$('.onglets button').forEach((b) => b.addEventListener('click', () => ouvrirOnglet(b.dataset.cible)));

function ouvrirOnglet(nom) {
  etat.onglet = nom;
  $$('.onglet').forEach((s) => { s.hidden = s.dataset.onglet !== nom; });
  $$('.onglets button').forEach((b) => (b.dataset.cible === nom ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $('#titre-onglet').textContent = TITRES[nom];
  if (nom === 'historique') afficherHistorique();
  window.scrollTo(0, 0);
}

function toutAfficher() {
  afficherAnnonce();
  afficherCoiffures();
  afficherPhotos();
  afficherHoraires();
  ouvrirOnglet(etat.onglet);
  changement();
}

// --- Outils ----------------------------------------------------------------------

const urlImage = (img, petit = true) => etat.nouvelles.get(img)?.apercu || `/${img}${petit ? '-sm' : ''}.jpg`;
const imagesUtilisees = (c) => [...new Set([...c.services.map((s) => s.photo), ...c.photos.map((p) => p.image)])];
const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const versCle = (nom) => nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'coiffure';

// Photo du téléphone → deux JPEG recadrés en 4:5 (1000×1250 et 500×625), comme les photos du site
async function preparerPhoto(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const rendre = (l, h, qualite) => {
      const c = document.createElement('canvas');
      c.width = l; c.height = h;
      const ratio = l / h;
      let sl = img.naturalWidth; let sh = img.naturalHeight;
      if (sl / sh > ratio) sl = sh * ratio; else sh = sl / ratio;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.naturalWidth - sl) / 2, (img.naturalHeight - sh) / 2, sl, sh, 0, 0, l, h);
      return c.toDataURL('image/jpeg', qualite);
    };
    const grand = rendre(1000, 1250, 0.82);
    const petit = rendre(500, 625, 0.8);
    return { grand: grand.split(',')[1], petit: petit.split(',')[1], apercu: petit };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Nom jamais utilisé pour une nouvelle photo : les navigateurs gardent les images en cache 30 jours,
// une photo ne doit donc jamais reprendre l'adresse d'une ancienne (le serveur vérifie aussi)
let sequence = 0;
const nouveauNom = (style) => `${DOSSIER}/${style}-${Date.now()}${String(sequence++ % 100).padStart(2, '0')}`;

const tailleEnvoi = () => [...etat.nouvelles.entries()].filter(([img, p]) => p.grand && imagesUtilisees(etat.contenu).includes(img)).reduce((t, [, p]) => t + p.grand.length + p.petit.length, 0);

// --- Annonce ---------------------------------------------------------------------

function afficherAnnonce() {
  const a = etat.contenu.annonce;
  $('#annonce-active').checked = !!a.active;
  $('#annonce-texte').value = a.texte || '';
  majApercuAnnonce();
}
function majApercuAnnonce() {
  const a = etat.contenu.annonce;
  $('#annonce-compte').textContent = (a.texte || '').length;
  $('#annonce-apercu').textContent = a.active && a.texte.trim() ? `✦ ${a.texte.trim()}` : '';
}
$('#annonce-active').addEventListener('change', (e) => { etat.contenu.annonce.active = e.target.checked; majApercuAnnonce(); changement(); });
$('#annonce-texte').addEventListener('input', (e) => {
  etat.contenu.annonce.texte = e.target.value;
  if (e.target.value.trim() && !etat.contenu.annonce.active) { etat.contenu.annonce.active = true; $('#annonce-active').checked = true; }
  majApercuAnnonce();
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

let fiche = null; // { index, brouillon, photoNouvelle }

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
    ? choix.map((img) => `<button type="button" data-photo="${img}" aria-pressed="${img === s.photo}"><img src="${urlImage(img)}" alt=""></button>`).join('')
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
  const nom = $('#c-nom').value.trim();
  const style = fiche.brouillon.cle || versCle(nom);
  const img = nouveauNom(style);
  etat.nouvelles.set(img, await preparerPhoto(f));
  fiche.brouillon.photo = img;
  afficherChoixPhoto();
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
      const img = nouveauNom(cle);
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
    return `<button type="button" data-photo="${i}"><img src="${urlImage(p.image)}" alt="" loading="lazy">${etat.nouvelles.get(p.image)?.grand ? '<span class="badge">nouvelle</span>' : ''}<small>${echapper(s ? s.nom : p.style)}</small></button>`;
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
  for (const f of fichiers) {
    try {
      const img = nouveauNom(style);
      const photo = await preparerPhoto(f);
      if (tailleEnvoi() + photo.grand.length + photo.petit.length > MAX_ENVOI) {
        msg.className = 'message message--erreur';
        msg.textContent = `${ajoutees} photo(s) ajoutée(s). Publiez d’abord celles-ci, puis ajoutez les suivantes (limite d’envoi atteinte).`;
        break;
      }
      etat.nouvelles.set(img, photo);
      etat.contenu.photos.unshift({ style, image: img });
      ajoutees += 1;
    } catch {
      msg.className = 'message message--erreur';
      msg.textContent = 'Une photo n’a pas pu être lue. Essayez avec une autre photo.';
    }
  }
  if (ajoutees && !msg.classList.contains('message--erreur')) {
    msg.className = 'message message--ok';
    msg.textContent = `${ajoutees} photo${ajoutees > 1 ? 's' : ''} prête${ajoutees > 1 ? 's' : ''}. Appuyez sur « Publier » pour les mettre en ligne.`;
  }
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
  etat.nouvelles.delete(p.image);
  $('#fiche-photo').close();
  afficherPhotos();
  changement();
});

// --- Horaires et téléphones -------------------------------------------------------

function afficherHoraires() {
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
}

$('#liste-horaires').addEventListener('change', (e) => {
  const el = e.target.closest('[data-jour]');
  if (!el) return;
  const j = etat.contenu.horaires[Number(el.dataset.jour)];
  j[el.dataset.champ] = el.value;
  if (el.dataset.champ === 'etat') {
    if (j.etat === 'ouvert' && !j.debut) { j.debut = '09:00'; j.fin = '19:00'; }
    if (j.etat !== 'ouvert') { j.debut = ''; j.fin = ''; }
    afficherHoraires();
  }
  changement();
});
['principal', 'secondaire'].forEach((cle) => $(`#tel-${cle}`).addEventListener('input', (e) => {
  etat.contenu.telephones[cle] = e.target.value;
  changement();
}));

// --- Historique ------------------------------------------------------------------

async function afficherHistorique() {
  const ul = $('#liste-historique');
  ul.innerHTML = '<li><span class="chargement"></span> Chargement…</li>';
  try {
    const { versions } = await api('historique');
    ul.innerHTML = versions.map((v, i) => `
      <li>
        <span class="liste__texte"><strong>${new Date(v.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</strong><small>${echapper(v.message.replace(/^Espace Nelly : /, ''))}</small></span>
        ${i === 0 ? '<span class="badge">en ligne</span>' : `<button type="button" class="bouton bouton--contour" data-version="${v.sha}">Revenir</button>`}
      </li>`).join('');
  } catch (err) {
    ul.innerHTML = `<li class="message message--erreur">${echapper(err.message)}</li>`;
  }
}

$('#liste-historique').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-version]');
  if (!b) return;
  if (!confirm('Revenir à cette version ? Elle sera chargée ici : vérifiez-la puis appuyez sur « Publier » pour la remettre en ligne.')) return;
  b.disabled = true;
  try {
    const { contenu } = await api('version', { params: `&sha=${b.dataset.version}` });
    etat.contenu = contenu;
    toutAfficher();
    ouvrirOnglet('coiffures');
  } catch (err) {
    alert(err.message);
    b.disabled = false;
  }
});

// --- Publication -----------------------------------------------------------------

$('#publier').addEventListener('click', () => {
  const lignes = resumeModifications();
  $('#publier-contenu').innerHTML = `
    <h2>Publier sur le site ?</h2>
    <ul class="etapes">${(lignes.length ? lignes : ['Modifications diverses']).map((l) => `<li>• ${echapper(l)}</li>`).join('')}</ul>
    <p class="aide">Le site sera mis à jour dans environ une minute.</p>
    <p class="message message--erreur" id="publier-erreur" hidden></p>
    <div class="fiche__actions"><span></span>
      <button class="bouton bouton--discret" type="button" data-fermer>Pas maintenant</button>
      <button class="bouton bouton--plein" type="button" id="confirmer-publier">Publier</button>
    </div>`;
  $('#fiche-publier').showModal();
});

$('#fiche-publier').addEventListener('click', async (e) => {
  if (e.target.closest('[data-fermer]')) return $('#fiche-publier').close();
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
    etat.base = r.contenu || structuredClone(etat.contenu);
    etat.contenu = structuredClone(etat.base);
    etat.version = r.version;
    // Les photos envoyées restent affichées depuis le téléphone le temps que le site se mette à jour (sans être renvoyées)
    for (const [avant, apres] of Object.entries(r.renommees || {})) {
      if (etat.nouvelles.has(avant)) { etat.nouvelles.set(apres, etat.nouvelles.get(avant)); etat.nouvelles.delete(avant); }
    }
    for (const [img, p] of etat.nouvelles) etat.nouvelles.set(img, { apercu: p.apercu });
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* sans effet */ }
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

// Fermer une fiche en touchant le fond
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// Prévenir avant de quitter avec des modifications non publiées
window.addEventListener('beforeunload', (e) => { if (modifie() && etat.nouvelles.size) { e.preventDefault(); e.returnValue = ''; } });

// Application installable (Android) et utilisable hors ligne pour l'écran de démarrage
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});

demarrer().catch(() => afficherConnexion());
