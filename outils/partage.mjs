import sharp from 'sharp';
// Image d'aperçu (1200 x 630) affichée quand le lien du site est partagé sur WhatsApp, Facebook…
const W = 1200, H = 630, OUT = '../site/img/marque/partage.jpg';
const photo = await sharp('../site/img/maquette/hero.webp').resize(560, H, { fit: 'cover', position: 'top' }).toBuffer();
const arch = Buffer.from(`<svg width="560" height="${H}"><path d="M0 ${H} V230 A280 230 0 0 1 560 230 V${H} Z" fill="#fff"/></svg>`);
const photoArch = await sharp(photo).composite([{ input: arch, blend: 'dest-in' }]).png().toBuffer();
const logo = await sharp('../site/img/marque/logo-clair.webp').resize({ width: 360 }).toBuffer();
const deco = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8A522F"/><stop offset=".5" stop-color="#F2C9A2"/><stop offset="1" stop-color="#B9784B"/></linearGradient></defs>
  <circle cx="-60" cy="680" r="300" fill="none" stroke="#DDAE86" stroke-opacity=".22" stroke-width="1.5"/>
  <path d="M640 ${H} V256 A262 216 0 0 1 1164 256 V${H}" fill="none" stroke="url(#g)" stroke-width="2"/>
  <line x1="150" y1="430" x2="460" y2="430" stroke="url(#g)" stroke-width="1"/>
  <text x="305" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#FBF3EA">Tresses africaines à Marseille</text>
  <text x="305" y="522" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" letter-spacing="4" fill="#DDAE86">CHEZ MOI OU À DOMICILE</text>
</svg>`);
await sharp({ create: { width: W, height: H, channels: 3, background: '#1A0D06' } })
  .composite([
    { input: photoArch, left: 620, top: 26 },
    { input: deco, left: 0, top: 0 },
    { input: logo, left: 125, top: 140 },
  ])
  .jpeg({ quality: 84, mozjpeg: true }).toFile(OUT);
console.log('ok');
