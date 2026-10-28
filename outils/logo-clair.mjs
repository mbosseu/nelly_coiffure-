import sharp from 'sharp';
// Version du logo pour fond sombre : les parties brun foncé (COIFFURE, devise) passent en crème, le cuivre est conservé
const SRC = '../site/img/marque/logo.png';
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const cream = [246, 230, 212];
for (let i = 0; i < data.length; i += 4) {
  if (!data[i + 3]) continue;
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const t = Math.max(0, Math.min(1, (120 - lum) / 70));
  if (t > 0) for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - t) + cream[c] * t);
}
const img = sharp(data, { raw: info });
await img.clone().webp({ quality: 90 }).toFile('../site/img/marque/logo-clair.webp');
await sharp({ create: { width: info.width + 80, height: info.height + 80, channels: 3, background: '#1A0D06' } })
  .composite([{ input: await img.clone().png().toBuffer(), left: 40, top: 40 }]).png().toFile('captures/logo-clair-test.png');
console.log(info.width, info.height);
