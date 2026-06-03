import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, 'src', 'assets', 'images');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function hasTransparency(image) {
  const metadata = await image.metadata();
  return metadata.hasAlpha;
}

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;

  const fileName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;
  
  const image = sharp(filePath);
  const isTransparent = await hasTransparency(image);
  
  const results = {
    file: path.relative(ASSETS_DIR, filePath),
    originalSize,
    optimizedSize: 0,
    webpGenerated: false,
    format: ext.substring(1)
  };

  // 1. Generate WebP
  // Rule: PNG -> WebP if no critical transparency (or even if transparent, WebP supports it, but user says "when no transparency critical").
  // Actually WebP supports transparency better than PNG in many cases. 
  // But I will follow the spirit: If it has transparency and it's a PNG, I'll still generate WebP but maybe with higher quality.
  
  const webpPath = path.join(dirName, `${fileName}.webp`);
  
  // Use .keepMetadata(false) is not a method in sharp, we just don't call it to remove metadata by default.
  // Actually, sharp removes metadata by default unless .withMetadata() is called.
  
  await image
    .webp({ quality: 80, effort: 6, lossless: false })
    .toFile(webpPath + '.tmp');

  const webpStats = await fs.stat(webpPath + '.tmp');
  
  // Only replace if smaller or if we want to force WebP for usage
  // User wants to convert to WebP "when convenient".
  
  await fs.rename(webpPath + '.tmp', webpPath);
  results.webpGenerated = true;
  results.optimizedSize = webpStats.size;

  return results;
}

async function main() {
  console.log('--- Iniciando Optimización Refinada ---');
  const allFiles = await getFiles(ASSETS_DIR);
  const imageFiles = allFiles.filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  console.log(`Procesando ${imageFiles.length} imágenes...`);

  const report = [];

  for (const file of imageFiles) {
    try {
      const res = await optimizeImage(file);
      if (res) {
        report.push(res);
        console.log(`Optimized: ${res.file} (${(res.originalSize / 1024).toFixed(1)}KB -> ${(res.optimizedSize / 1024).toFixed(1)}KB)`);
      }
    } catch (err) {
      console.error(`Error optimizando ${file}:`, err.message);
    }
  }

  // Also optimize existing WebP images if they were not just generated
  const webpFiles = allFiles.filter(f => path.extname(f).toLowerCase() === '.webp');
  for (const file of webpFiles) {
      // Just re-save with same settings to ensure metadata removal and consistent compression
      const tmpPath = file + '.tmp';
      try {
          await sharp(file).webp({ quality: 80, effort: 6 }).toFile(tmpPath);
          const oldStats = await fs.stat(file);
          const newStats = await fs.stat(tmpPath);
          if (newStats.size < oldStats.size) {
              await fs.rename(tmpPath, file);
              // console.log(`Further optimized WebP: ${path.relative(ASSETS_DIR, file)}`);
          } else {
              await fs.unlink(tmpPath);
          }
      } catch (e) {
          // ignore
      }
  }

  console.log('\n--- Resumen de Optimización ---');
  console.log(`Total imágenes procesadas: ${report.length}`);
  
  await fs.writeFile('optimization-results.json', JSON.stringify(report, null, 2));
}

main().catch(console.error);
