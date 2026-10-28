import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SRC = 'C:/Users/PC/Desktop/nelly_coiffe/image et video';
const OUT = 'C:/Users/PC/Desktop/nelly_coiffe/photos_traitees/test';
const CREAM = { r: 245, g: 236, b: 222 };
await mkdir(OUT, { recursive: true });

const name = (f) => `WhatsApp Image 2026-10-27 at ${f}.jpeg`;

async function cutout(file, slug) {
  const buf = await readFile(path.join(SRC, name(file)));
  const blob = await removeBackground(new Blob([buf], { type: 'image/jpeg' }), {
    model: 'medium',
    output: { format: 'image/png' },
  });
  const png = Buffer.from(await blob.arrayBuffer());
  await writeFile(path.join(OUT, `${slug}_detoure.png`), png);
  const { width, height } = await sharp(png).metadata();
  await sharp({ create: { width, height, channels: 3, background: CREAM } })
    .composite([{ input: png }])
    .modulate({ brightness: 1.03, saturation: 1.05 })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, `${slug}_fond_creme.jpg`));
  console.log('cutout ok', slug);
}

function upscale(file, slug) {
  const exe = 'C:/Users/PC/Desktop/nelly_coiffe/outils/realesrgan/realesrgan-ncnn-vulkan.exe';
  execFileSync(exe, ['-i', path.join(SRC, name(file)), '-o', path.join(OUT, `${slug}_x4.png`), '-n', 'realesrgan-x4plus'], { stdio: 'inherit' });
  console.log('upscale ok', slug);
}

await cutout('09.58.53 (1)', 'box_braids_rouges');
await cutout('09.58.49 (3)', 'test2');
upscale('09.58.50 (6)', 'basse_def');
