import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { fileService } from '../../ftp';
import path from 'path';

const VIDEO_EXT = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.m4v', '.flv']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma']);

interface CatalogStats {
  genres: string[];
  totalFiles: number;
  totalGB: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
}

async function walkDir(
  basePath: string,
  relativePath: string,
  stats: { totalFiles: number; totalBytes: number; videos: number; audios: number; karaokes: number; other: number }
): Promise<void> {
  const fullPath = basePath + (relativePath ? `${relativePath}/` : '');
  let entries: { name: string; type: string; size: number }[];
  try {
    entries = await fileService.list(fullPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const lowerRel = rel.toLowerCase();
    const isKaraokePath = lowerRel.includes('karaoke');

    if (entry.type === 'd') {
      await walkDir(basePath, rel, stats);
    } else {
      stats.totalFiles += 1;
      stats.totalBytes += entry.size || 0;
      const ext = path.extname(entry.name).toLowerCase();

      if (VIDEO_EXT.has(ext)) stats.videos += 1;
      else if (AUDIO_EXT.has(ext)) stats.audios += 1;
      else stats.other += 1;
      if (isKaraokePath) stats.karaokes += 1;
    }
  }
}

const emptyResponse = {
  error: '',
  genres: [] as string[],
  totalFiles: 0,
  totalGB: 0,
  videos: 0,
  audios: 0,
  karaokes: 0,
  other: 0,
};

export const catalogStats = shieldedProcedure.query(async () => {
  try {
    const songsPath = process.env.SONGS_PATH;
    if (!songsPath) {
      return { ...emptyResponse, error: 'SONGS_PATH no configurado' };
    }

    const basePath = songsPath.endsWith('/') ? songsPath : `${songsPath}/`;
    let rootEntries: { name: string; type: string }[];
    try {
      rootEntries = await fileService.list(basePath);
    } catch {
      return { ...emptyResponse, error: 'No se pudo leer el catálogo' };
    }

    const genres = rootEntries
      .filter((e) => e.type === 'd' && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    const stats = { totalFiles: 0, totalBytes: 0, videos: 0, audios: 0, karaokes: 0, other: 0 };
    await walkDir(basePath, '', stats);

    const totalGB = stats.totalBytes / (1024 ** 3);

    return {
      genres,
      totalFiles: stats.totalFiles,
      totalGB: Math.round(totalGB * 100) / 100,
      videos: stats.videos,
      audios: stats.audios,
      karaokes: stats.karaokes,
      other: stats.other,
    };
  } catch {
    return { ...emptyResponse, error: 'Error al calcular. El resto de la web sigue funcionando.' };
  }
});
