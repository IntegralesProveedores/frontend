import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, 'src', 'assets', 'images');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(__dirname, 'src');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif', '.ico'];
const FILE_EXTENSIONS = ['.ts', '.html', '.css', '.scss', '.js', '.json', '.md'];

async function getFiles(dir, filterExts) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res, filterExts) : res;
  }));
  const flattened = Array.prototype.concat(...files);
  if (filterExts) {
    return flattened.filter(f => filterExts.includes(path.extname(f).toLowerCase()));
  }
  return flattened;
}

// Pre-fetched DB images
const dbImages = [
  "assets/images/producto-maceta-biodegradable-semillera-00.webp",
  "assets/images/producto-maceta-biodegradable-amaciguera-00.webp",
  "assets/images/producto-maceta-biodegradable-olivo-00.webp",
  "assets/images/producto-maceta-biodegradable-floral-00.webp",
  "assets/images/producto-maceta-biodegradable-floral11-00.webp"
];

async function analyze() {
  const imageFiles = await getFiles(ASSETS_DIR, IMAGE_EXTENSIONS);
  const srcFiles = await getFiles(SRC_DIR, FILE_EXTENSIONS);
  
  // Read all src files content once
  const srcFileContents = await Promise.all(srcFiles.map(async f => ({
    path: f,
    content: await fs.readFile(f, 'utf-8')
  })));

  const report = [];

  for (const filePath of imageFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const fileNameNoExt = path.basename(filePath, ext);
    
    // Calculate path relative to 'src' to match DB and codebase references
    const pathFromSrc = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');

    let resolution = 'N/A';
    if (['.svg', '.ico'].indexOf(ext) === -1) {
      try {
        const metadata = await sharp(filePath).metadata();
        resolution = `${metadata.width}x${metadata.height}`;
      } catch (e) {
        resolution = 'Error';
      }
    }

    let usage = [];
    
    // Check in DB
    if (dbImages.includes(pathFromSrc) || dbImages.includes(`assets/images/${pathFromSrc}`)) {
      usage.push('Database');
    }

    // Check in src files
    const usedInCode = srcFileContents.some(f => f.content.includes(fileName));
    if (usedInCode) {
      usage.push('Codebase');
    } else {
        // Check if used without extension or with webp extension (if current is jpg/png)
        if (ext === '.jpg' || ext === '.png' || ext === '.jpeg') {
            const usedAsWebp = srcFileContents.some(f => f.content.includes(fileNameNoExt + '.webp'));
            if (usedAsWebp) {
                usage.push('Codebase (as .webp)');
            }
        }
    }

    report.push({
      path: path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/'),
      pathFromSrc,
      format: ext.substring(1),
      size: stats.size,
      resolution,
      usage: usage.join(', ') || 'Unused'
    });
  }

  // Print Markdown Table
  console.log('| Ruta completa | Formato | Tamaño (bytes) | Resolución | Uso detectado |');
  console.log('| --- | --- | --- | --- | --- |');
  report.forEach(r => {
    console.log(`| ${r.path} | ${r.format} | ${r.size} | ${r.resolution} | ${r.usage} |`);
  });

  await fs.writeFile('image-analysis.json', JSON.stringify(report, null, 2));
}

analyze().catch(console.error);
