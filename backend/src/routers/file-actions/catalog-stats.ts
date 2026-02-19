import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { fileService } from '../../ftp';
import path from 'path';
import { promises as fs } from 'fs';

const VIDEO_EXT = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.m4v', '.flv']);
const AUDIO_EXT = new Set(['.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wma']);

export interface GenreStats {
  name: string;
  files: number;
  gb: number;
}

export interface CatalogStatsResult {
  error?: string;
  totalFiles: number;
  totalGB: number;
  /** Cantidad de archivos por tipo */
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
  /** GB por tipo (video, audio, karaoke) */
  gbVideos: number;
  gbAudios: number;
  gbKaraokes: number;
  /** Total de géneros únicos (carpeta que contiene archivos, ej. Bachata) */
  totalGenres: number;
  /** Por cada género: total archivos y total GB */
  genresDetail: GenreStats[];
}

const emptyResponse: CatalogStatsResult = {
  error: '',
  totalFiles: 0,
  totalGB: 0,
  videos: 0,
  audios: 0,
  karaokes: 0,
  other: 0,
  gbVideos: 0,
  gbAudios: 0,
  gbKaraokes: 0,
  totalGenres: 0,
  genresDetail: [],
};

interface WalkStats {
  totalFiles: number;
  totalBytes: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
  bytesVideos: number;
  bytesAudios: number;
  bytesKaraokes: number;
  byGenre: Record<string, { files: number; bytes: number }>;
}

function genreFromRelativePath(relativePath: string): string {
  if (!relativePath) return '(raíz)';
  const segments = relativePath.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1]! : '(raíz)';
}

type ListEntry = { name: string; type: 'd' | '-'; size: number };

const isLocalFileService = (): boolean => (process.env.FILE_SERVICE ?? 'local') === 'local';

async function listDirLocal(fullPath: string): Promise<ListEntry[]> {
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const results: ListEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      results.push({ name: entry.name, type: 'd', size: 0 });
      continue;
    }

    if (entry.isFile()) {
      const stat = await fs.stat(path.join(fullPath, entry.name));
      results.push({ name: entry.name, type: '-', size: stat.size });
    }
  }

  return results;
}

async function listDirFtp(fullPath: string): Promise<ListEntry[]> {
  const entries = await fileService.list(fullPath);
  return entries
    .filter((entry) => entry && typeof entry.name === 'string')
    .map((entry) => ({
      name: entry.name,
      type: entry.type === 'd' ? 'd' : '-',
      size: entry.size || 0,
    }));
}

async function walkDir(basePath: string, relativePath: string, stats: WalkStats): Promise<void> {
  const fullPath = relativePath ? path.join(basePath, relativePath) : basePath;
  let entries: ListEntry[];
  try {
    entries = isLocalFileService() ? await listDirLocal(fullPath) : await listDirFtp(fullPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const lowerRel = rel.toLowerCase();
    const isKaraokePath = lowerRel.includes('karaoke');

    if (entry.type === 'd') {
      await walkDir(basePath, rel, stats);
    } else {
      const size = entry.size || 0;
      const genre = genreFromRelativePath(relativePath);

      stats.totalFiles += 1;
      stats.totalBytes += size;

      if (!stats.byGenre[genre]) stats.byGenre[genre] = { files: 0, bytes: 0 };
      stats.byGenre[genre].files += 1;
      stats.byGenre[genre].bytes += size;

      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXT.has(ext)) {
        stats.videos += 1;
        stats.bytesVideos += size;
      } else if (AUDIO_EXT.has(ext)) {
        stats.audios += 1;
        stats.bytesAudios += size;
      } else {
        stats.other += 1;
      }
      if (isKaraokePath) {
        stats.karaokes += 1;
        stats.bytesKaraokes += size;
      }
    }
  }
}

/** Lógica compartida: se usa desde tRPC y desde el endpoint REST /api/catalog-stats */
export async function getCatalogStats(): Promise<CatalogStatsResult> {
  try {
    const songsPath = process.env.SONGS_PATH;
    if (!songsPath) {
      return { ...emptyResponse, error: 'SONGS_PATH no configurado' };
    }

    const basePath = songsPath.endsWith('/') ? songsPath : `${songsPath}/`;

    const stats: WalkStats = {
      totalFiles: 0,
      totalBytes: 0,
      videos: 0,
      audios: 0,
      karaokes: 0,
      other: 0,
      bytesVideos: 0,
      bytesAudios: 0,
      bytesKaraokes: 0,
      byGenre: {},
    };
    await walkDir(basePath, '', stats);

    const totalGB = stats.totalBytes / (1024 ** 3);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const genresDetail: GenreStats[] = Object.entries(stats.byGenre)
      .map(([name, { files, bytes }]) => ({
        name,
        files,
        gb: round2(bytes / (1024 ** 3)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalFiles: stats.totalFiles,
      totalGB: round2(totalGB),
      videos: stats.videos,
      audios: stats.audios,
      karaokes: stats.karaokes,
      other: stats.other,
      gbVideos: round2(stats.bytesVideos / (1024 ** 3)),
      gbAudios: round2(stats.bytesAudios / (1024 ** 3)),
      gbKaraokes: round2(stats.bytesKaraokes / (1024 ** 3)),
      totalGenres: genresDetail.length,
      genresDetail,
    };
  } catch {
    return { ...emptyResponse, error: 'Error al calcular. El resto de la web sigue funcionando.' };
  }
}

export const catalogStats = shieldedProcedure.query(() => getCatalogStats());
