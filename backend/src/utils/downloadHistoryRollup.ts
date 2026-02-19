export type DownloadHistoryRollupCategory = 'audio' | 'video' | 'karaoke';

const AUDIO_EXTENSIONS = [
  '.mp3',
  '.aac',
  '.m4a',
  '.flac',
  '.ogg',
  '.aiff',
  '.alac',
];

const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.wmv',
  '.webm',
  '.m4v',
];

export const normalizeDownloadHistoryFileName = (
  rawFileName: string,
): string | null => {
  const candidate = `${rawFileName ?? ''}`.trim();
  if (!candidate) return null;
  const normalized = candidate.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized) return null;
  return normalized;
};

export const toUtcDay = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

export const inferDownloadHistoryRollupCategories = (
  rawFileName: string,
): DownloadHistoryRollupCategory[] => {
  const normalized = normalizeDownloadHistoryFileName(rawFileName);
  if (!normalized) return [];

  const normalizedLower = normalized.toLowerCase();
  const isAudio = AUDIO_EXTENSIONS.some((ext) => normalizedLower.endsWith(ext));
  const isVideo = VIDEO_EXTENSIONS.some((ext) => normalizedLower.endsWith(ext));
  if (!isAudio && !isVideo) return [];

  const isKaraoke =
    normalizedLower.includes('/karaoke/') ||
    normalizedLower.includes('/karaokes/') ||
    normalizedLower.startsWith('karaoke/') ||
    normalizedLower.startsWith('karaokes/');

  const categories: DownloadHistoryRollupCategory[] = [];
  if (isAudio) categories.push('audio');
  if (isVideo) categories.push('video');
  if (isKaraoke) categories.push('karaoke');
  return categories;
};
