import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

async function main() {
  console.log('--- Iniciando Limpieza de Imágenes ---');
  
  const analysisPath = path.join(__dirname, 'image-analysis.json');
  const analysis = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));

  let deletedCount = 0;
  let freedSpace = 0;

  for (const item of analysis) {
    if (item.usage === 'Unused') {
      const filePath = path.join(PROJECT_ROOT, item.path);
      try {
        await fs.unlink(filePath);
        deletedCount++;
        freedSpace += item.size;
        console.log(`Deleted: ${item.path}`);
      } catch (err) {
        console.error(`Error deleting ${item.path}:`, err.message);
      }
    }
  }

  console.log('\n--- Resumen de Limpieza ---');
  console.log(`Archivos eliminados: ${deletedCount}`);
  console.log(`Espacio liberado: ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
