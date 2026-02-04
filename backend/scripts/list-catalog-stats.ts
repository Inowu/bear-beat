/**
 * Script de solo lectura: lista géneros, totales de archivos, GB y conteo por tipo.
 * No modifica nada. Ejecutar desde la raíz del backend con:
 *   npx ts-node scripts/list-catalog-stats.ts
 * Requiere que .env tenga SONGS_PATH apuntando al catálogo (ej. en el servidor).
 */
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

const VIDEO_EXT = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.m4v', '.flv']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma']);

interface Stats {
  totalFiles: number;
  totalBytes: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
}

function walkDir(
  dirPath: string,
  basePath: string,
  stats: Stats,
  relativePath: string = ''
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`[list-catalog-stats] No se pudo leer directorio: ${dirPath}`, err);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const lowerRel = relPath.toLowerCase();
    const isKaraokePath = lowerRel.includes('karaoke') || lowerRel.includes('karaokes');

    if (entry.isDirectory()) {
      walkDir(fullPath, basePath, stats, relPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch (_) {}
      stats.totalFiles += 1;
      stats.totalBytes += size;

      if (VIDEO_EXT.has(ext)) stats.videos += 1;
      else if (AUDIO_EXT.has(ext)) stats.audios += 1;
      else stats.other += 1;
      if (isKaraokePath) stats.karaokes += 1;
    }
  }
}

function main(): void {
  const songsPath = process.env.SONGS_PATH;
  if (!songsPath || !fs.existsSync(songsPath)) {
    console.error('[list-catalog-stats] SONGS_PATH no está definido o la ruta no existe.');
    console.error('  Define SONGS_PATH en .env (ej. donde está el catálogo en el servidor).');
    process.exit(1);
  }

  const stats: Stats = {
    totalFiles: 0,
    totalBytes: 0,
    videos: 0,
    audios: 0,
    karaokes: 0,
    other: 0,
  };

  // Géneros = carpetas en la raíz del catálogo
  const genres: string[] = [];
  const rootEntries = fs.readdirSync(songsPath, { withFileTypes: true });
  for (const e of rootEntries) {
    if (e.isDirectory() && !e.name.startsWith('.')) genres.push(e.name);
  }
  genres.sort((a, b) => a.localeCompare(b));

  console.log('--- Catálogo Bear Beat (solo lectura) ---\n');
  console.log('GÉNEROS (carpetas en la raíz):');
  console.log(`  Total: ${genres.length}`);
  genres.forEach((g, i) => console.log(`  ${i + 1}. ${g}`));

  walkDir(songsPath, songsPath, stats);

  const totalGB = stats.totalBytes / (1024 ** 3);
  console.log('\n--- Totales ---');
  console.log(`  Archivos totales: ${stats.totalFiles.toLocaleString()}`);
  console.log(`  GB totales:       ${totalGB.toFixed(2)}`);
  console.log('\n--- Por tipo ---');
  console.log(`  Videos:   ${stats.videos.toLocaleString()} (extensiones: mp4, mkv, avi, mov, wmv, webm, m4v, flv)`);
  console.log(`  Audios:   ${stats.audios.toLocaleString()} (extensiones: mp3, wav, flac, aac, m4a, ogg, wma)`);
  console.log(`  Karaokes: ${stats.karaokes.toLocaleString()} (archivos en ruta que contiene "karaoke")`);
  console.log(`  Otros:    ${stats.other.toLocaleString()}`);
  console.log('\n--- Fin ---');
}

main();
