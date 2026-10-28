import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

// Usage : node capture.mjs [page.html] [largeur] [hauteur]
const [page = 'index.html', width = '1440', height = '3900'] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/PC/Desktop/nelly_coiffe/outils/captures';
mkdirSync(OUT, { recursive: true });
const file = `${OUT}/${page.replace('.html', '')}-${width}.png`;

execFileSync(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${width},${height}`,
  '--virtual-time-budget=9000', `--screenshot=${file}`, `http://localhost:5173/${page}?capture=${Date.now()}`,
], { stdio: 'ignore' });

// Découpe en tranches lisibles
const { height: h } = await sharp(file).metadata();
const slice = Math.round(Number(width) * 0.7);
for (let i = 0, y = 0; y < h; i++, y += slice) {
  await sharp(file).extract({ left: 0, top: y, width: Number(width), height: Math.min(slice, h - y) })
    .resize({ width: 1400 }).png().toFile(`${OUT}/${page.replace('.html', '')}-${width}-${i + 1}.png`);
}
console.log(file, h);
