import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, 'src');
const FILE_EXTENSIONS = ['.ts', '.html', '.css', '.scss', '.js', '.json', '.md'];
const IMAGE_REGEX = /\.(png|jpg|jpeg)(?=["']|[\s)]|$)/gi;

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function updateFileReferences(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!FILE_EXTENSIONS.includes(ext)) return false;

  const content = await fs.readFile(filePath, 'utf-8');
  if (!IMAGE_REGEX.test(content)) return false;

  const newContent = content.replace(IMAGE_REGEX, '.webp');
  await fs.writeFile(filePath, newContent, 'utf-8');
  return true;
}

async function main() {
  console.log('--- Iniciando Actualización de Referencias ---');
  const allFiles = await getFiles(SRC_DIR);
  // Also include index.html which is in the root of src
  const filesToProcess = allFiles.filter(f => FILE_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  // Add index.html if not already there
  const indexHtml = path.join(__dirname, 'src', 'index.html');
  if (!filesToProcess.includes(indexHtml)) filesToProcess.push(indexHtml);

  let updatedCount = 0;
  for (const file of filesToProcess) {
    const updated = await updateFileReferences(file);
    if (updated) {
      console.log(`Updated: ${path.relative(__dirname, file)}`);
      updatedCount++;
    }
  }

  console.log(`\nReferencias actualizadas en ${updatedCount} archivos.`);
}

main().catch(console.error);
