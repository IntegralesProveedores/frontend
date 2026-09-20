// Optimiza las imágenes que la app realmente sirve (lista TARGETS) y genera las
// miniaturas -thumb.webp de la galería. Idempotente: guarda el hash de cada
// salida en scripts/.image-manifest.json y no re-comprime lo ya optimizado.
// Uso: npm run images        (para una imagen nueva, agregarla a TARGETS)
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const images = path.join(root, 'src/assets/images');
const icons = path.join(root, 'src/assets/icon');
const manifestPath = path.join(root, 'scripts/.image-manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};

const productWebp = (name, max = 1280) => ({ file: `${name}.webp`, max, webp: 70, thumb: true, md: true });
// La base de datos apuntaba a estos .jpg; se convierten a .webp (el .jpg original se conserva hasta borrarlo a mano).
const productFromJpg = (name) => ({ file: `${name}.jpg`, to: `${name}.webp`, max: 1280, webp: 70, thumb: true, md: true });

const TARGETS = [
  // Productos (URLs guardadas en la base de datos: se mantiene nombre y formato)
  ...['semillera-00', 'semillera-01', 'semillera-02', 'semillera-03', 'amaciguera-00', 'amaciguera-04',
    'olivo-00', 'olivo-01', 'olivo-02', 'olivo-03', 'olivo-04', 'floral-00', 'floral11-00']
    .map((n) => productWebp(`producto-maceta-biodegradable-${n}`)),
  productWebp('producto-maceta-biodegradable-amaciguera-03', 1600),
  productFromJpg('producto-maceta-biodegradable-floral-01'),
  productFromJpg('producto-maceta-biodegradable-floral11-01'),
  // Fondos y otras imágenes de la home
  { file: 'background-01.jpg', to: 'background-01.webp', max: 1920, webp: 72 },
  { file: 'producto-maceta-biodegradable-todos-06.webp', max: 1600, webp: 62 },
  { file: 'maceta-olivo.webp', max: 600, webp: 78 },
  { file: 'preview.webp', max: 1200, webp: 80 },
  // Logos e íconos PNG
  { file: 'brotalia.png', png: true },
  { file: 'brotalia-iso-00.png', png: true },
  { dir: icons, file: 'mercado-pago-horizontal.png', max: 400, png: true },
  { dir: icons, file: 'mercado-libre.png', png: true },
  { dir: icons, file: 'correo-argentino.png', png: true },
];


async function variants(t, dir, srcBuf) {
  const base = (t.to ?? t.file).replace(/\.(webp|jpe?g|png)$/i, '');
  const make = async (suffix, size, opts, fit) => {
    const file = path.join(dir, `${base}-${suffix}.webp`);
    if (existsSync(file) && !t.to) return;
    const buf = await sharp(srcBuf).rotate().resize(size, size, { fit, withoutEnlargement: true }).webp(opts).toBuffer();
    await writeFile(file, buf);
    after += buf.length;
    console.log('  ' + rel(file).padEnd(78), '      variante', (buf.length / 1024).toFixed(1), 'KB');
  };
  if (t.thumb) await make('thumb', 200, { quality: 72, effort: 6 }, 'cover');
  if (t.md) await make('md', 640, { quality: 68, effort: 6 }, 'inside');
}

const sha = (buf) => createHash('sha1').update(buf).digest('hex');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
let before = 0;
let after = 0;

for (const t of TARGETS) {
  const dir = t.dir ?? images;
  const src = path.join(dir, t.file);
  const out = path.join(dir, t.to ?? t.file);
  if (!existsSync(src)) { console.log('  ! no existe', rel(src)); continue; }
  const srcBuf = await readFile(src);
  if (manifest[rel(out)] === sha(srcBuf) && !t.to) { await variants(t, dir, srcBuf); continue; }

  let img = sharp(srcBuf).rotate();
  if (t.max) img = img.resize({ width: t.max, height: t.max, fit: 'inside', withoutEnlargement: true });
  let buf;
  if (t.webp) buf = await img.webp({ quality: t.webp, effort: 6, smartSubsample: true }).toBuffer();
  else if (t.jpg) buf = await img.jpeg({ quality: t.jpg, mozjpeg: true }).toBuffer();
  else buf = await img.png({ palette: true, quality: 85, effort: 10, compressionLevel: 9 }).toBuffer();

  const prev = t.to && existsSync(out) ? (await stat(out)).size : srcBuf.length;
  if (buf.length < prev || t.to) {
    await writeFile(out, buf);
    manifest[rel(out)] = sha(buf);
    before += srcBuf.length; after += buf.length;
    console.log('  ' + rel(out).padEnd(78), (srcBuf.length / 1024).toFixed(0).padStart(5), 'KB ->', (buf.length / 1024).toFixed(0).padStart(4), 'KB');
  } else {
    manifest[rel(out)] = sha(srcBuf);
    console.log('  = ya optimizada', rel(out));
  }

  await variants(t, dir, srcBuf);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nTotal: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (incluye miniaturas)`);
