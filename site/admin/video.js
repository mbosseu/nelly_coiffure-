// Préparation d'une vidéo dans le navigateur, partagée par l'espace de gestion et la page d'envoi de l'assistant :
// la vidéo du téléphone (souvent très lourde) devient un MP4 H.264 en 1080p au plus, lisible partout et léger,
// avec une image de couverture nette. Puis elle est envoyée par morceaux (limite de 4,5 Mo par requête).

export const DUREE_MAX = 60; // secondes gardées
const DEBIT_MAX = 4_500_000; // images nettes en 1080p, environ 35 Mo la minute
const MAX_OCTETS = 45 * 1024 * 1024;
const MORCEAU = 2_700_000; // multiple de 3 : se réunit sans marge d'erreur en base64

const paire = (n) => Math.max(2, Math.round(n / 2) * 2);

export const dimensionsCibles = (largeur, hauteur) => {
  const e = Math.min(1, 1920 / Math.max(largeur, hauteur), 1080 / Math.min(largeur, hauteur));
  return { largeur: paire(largeur * e), hauteur: paire(hauteur * e) };
};

/**
 * Convertit la vidéo choisie. surProgres reçoit un nombre entre 0 et 1.
 * Renvoie { blob, largeur, hauteur, duree, coupee } ; lève une erreur au message compréhensible sinon.
 */
export async function convertirVideo(fichier, surProgres = () => {}) {
  if (!/^video\//.test(fichier.type) && !/\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(fichier.name)) throw new Error('Ce fichier n’est pas une vidéo. Choisissez une vidéo de votre téléphone.');
  const M = await import('/admin/vendor/mediabunny.min.mjs');
  const entree = new M.Input({ source: new M.BlobSource(fichier), formats: M.ALL_FORMATS });
  let piste = null; let duree = 0;
  try {
    piste = await entree.getPrimaryVideoTrack();
    duree = await entree.computeDuration();
  } catch { /* message ci-dessous */ }
  if (!piste) throw new Error('Cette vidéo n’est pas lisible ici. Essayez avec une autre vidéo.');
  const { largeur, hauteur } = dimensionsCibles(piste.displayWidth, piste.displayHeight);
  const coupee = duree > DUREE_MAX + 0.5;
  const garder = Math.min(duree, DUREE_MAX);

  // Navigateur incapable de convertir : la vidéo d'origine convient si elle est déjà au bon format et assez légère
  const telleQuelle = async () => {
    const convient = piste.codec === 'avc' && (await entree.getFormat()) === M.MP4 && !coupee && fichier.size <= MAX_OCTETS
      && Math.max(piste.displayWidth, piste.displayHeight) <= 1920;
    if (!convient) throw new Error('Votre navigateur ne peut pas préparer cette vidéo. Mettez à jour votre téléphone, ou ouvrez l’application avec Chrome ou Safari récent.');
    surProgres(1);
    return { blob: fichier, largeur: piste.displayWidth, hauteur: piste.displayHeight, duree: garder, coupee: false };
  };
  if (typeof VideoEncoder === 'undefined') return telleQuelle();

  const pixels = (largeur * hauteur) / (1080 * 1920);
  const sortie = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
  let conversion;
  try {
    conversion = await M.Conversion.init({
      input: entree,
      output: sortie,
      tracks: 'primary',
      showWarnings: false,
      trim: { start: 0, end: garder },
      video: { width: largeur, height: hauteur, fit: 'fill', codec: 'avc', bitrate: Math.round(Math.max(1_500_000, DEBIT_MAX * pixels)), frameRate: 30, keyFrameInterval: 2, forceTranscode: true, allowTransformationMetadata: false },
      audio: { codec: 'aac', bitrate: 128_000 },
    });
  } catch { return telleQuelle(); }
  if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.isVideoTrack?.() ?? d.track.type === 'video')) return telleQuelle();
  conversion.onProgress = (p) => surProgres(p);
  try {
    await conversion.execute();
  } catch (e) {
    console.error('Conversion vidéo', e);
    return telleQuelle();
  }
  const blob = new Blob([sortie.target.buffer], { type: 'video/mp4' });
  if (blob.size > MAX_OCTETS) throw new Error('Cette vidéo reste trop lourde. Choisissez-en une plus courte.');
  surProgres(1);
  return { blob, largeur, hauteur, duree: Math.round(garder * 10) / 10, coupee };
}

/** Charge une vidéo (Blob) dans un élément <video> et attend qu'elle soit affichable */
export function chargerDansElement(video, blob) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(blob);
    const pret = () => { nettoyer(); ok(url); };
    const rate = () => { nettoyer(); ko(new Error('Cette vidéo n’est pas lisible sur cet appareil.')); };
    const nettoyer = () => { video.removeEventListener('loadeddata', pret); video.removeEventListener('error', rate); };
    video.addEventListener('loadeddata', pret);
    video.addEventListener('error', rate);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    video.load();
  });
}

/** Se place à un moment précis de la vidéo */
export function allerA(video, secondes) {
  return new Promise((ok) => {
    const t = Math.min(Math.max(0, secondes), Math.max(0, (video.duration || 0) - 0.05));
    if (Math.abs(video.currentTime - t) < 0.01) return ok();
    const fini = () => { video.removeEventListener('seeked', fini); ok(); };
    video.addEventListener('seeked', fini);
    video.currentTime = t;
  });
}

const dessinerImage = (video, l, h, cx, cy, qualite) => {
  const vl = video.videoWidth; const vh = video.videoHeight;
  let sl = vl; let sh = vh;
  const ratio = l / h;
  if (vl / vh > ratio) sl = vh * ratio; else sh = vl / ratio;
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, ((vl - sl) * cx) / 100, ((vh - sh) * cy) / 100, sl, sh, 0, 0, l, h);
  return c.toDataURL('image/jpeg', qualite);
};

/**
 * Image de couverture : l'image affichée par la vidéo à cet instant.
 * Avec recadrer : format portrait 4:5 des réalisations, centré sur le point (x, y en %). Sinon : image entière.
 */
export function imageCouverture(video, { recadrer = true, x = 50, y = 50 } = {}) {
  const vl = video.videoWidth; const vh = video.videoHeight;
  let tailles;
  if (recadrer) tailles = [[1000, 1250], [500, 625]];
  else {
    const e = (max) => Math.min(1, max / Math.max(vl, vh));
    tailles = [[paire(vl * e(1600)), paire(vh * e(1600))], [paire(vl * e(800)), paire(vh * e(800))]];
  }
  const grand = dessinerImage(video, tailles[0][0], tailles[0][1], x, y, 0.85);
  const petit = dessinerImage(video, tailles[1][0], tailles[1][1], x, y, 0.82);
  return { grand: grand.split(',')[1], petit: petit.split(',')[1], apercu: petit, largeur: tailles[0][0], hauteur: tailles[0][1] };
}

const versBase64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = () => ko(new Error('Lecture de la vidéo impossible.'));
  r.readAsDataURL(blob);
});

/**
 * Envoie un fichier par morceaux. envoyerMorceau(base64) doit renvoyer l'empreinte du morceau.
 * Une coupure de réseau est retentée trois fois. Renvoie la liste des empreintes.
 */
export async function envoyerParMorceaux(blob, envoyerMorceau, surProgres = () => {}) {
  const morceaux = [];
  const total = Math.ceil(blob.size / MORCEAU);
  for (let i = 0; i < total; i++) {
    const b64 = await versBase64(blob.slice(i * MORCEAU, (i + 1) * MORCEAU));
    for (let essai = 1; ; essai++) {
      try {
        morceaux.push(await envoyerMorceau(b64));
        break;
      } catch (e) {
        if (essai >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * essai));
      }
    }
    surProgres((i + 1) / total);
  }
  return morceaux;
}
