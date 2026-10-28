import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFile } from 'node:fs/promises';

const IN = 'C:/Users/PC/Desktop/nelly_coiffe/image et video/WhatsApp Image 2026-10-27 at 09.58.53 (1).jpeg';
const OUT = 'C:/Users/PC/Desktop/nelly_coiffe/photos_traitees/test/box_braids_rouges_v2.jpg';

const buf = await readFile(IN);
const blob = await removeBackground(new Blob([buf], { type: 'image/jpeg' }), { model: 'medium', output: { format: 'image/png' } });
const png = Buffer.from(await blob.arrayBuffer());
const { width, height } = await sharp(png).metadata();

// Durcit le masque : supprime les zones semi-transparentes (fantômes) puis adoucit légèrement le bord
const alpha = await sharp(png).extractChannel('alpha').threshold(170).blur(1.2).toBuffer();
const rgb = await sharp(buf).rotate().resize(width, height, { fit: 'fill' }).removeAlpha().toBuffer();
const subject = await sharp(rgb).joinChannel(alpha).png().toBuffer();

const bg = await sharp({ create: { width, height, channels: 3, background: { r: 245, g: 236, b: 222 } } }).png().toBuffer();
await sharp(bg)
  .composite([{ input: subject }])
  .extract({ left: Math.round(width * 0.25), top: Math.round(height * 0.22), width: Math.round(width * 0.55), height: Math.round(height * 0.62) })
  .jpeg({ quality: 90 })
  .toFile(OUT);
console.log('ok');
