const normalizeBaseUrl = (value: string | undefined): string | null => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

export const getMediaCdnBaseUrl = (): string | null =>
  normalizeBaseUrl(process.env.MEDIA_CDN_BASE_URL);

export const isMediaCdnEnabled = (): boolean => Boolean(getMediaCdnBaseUrl());

export const buildDemoPublicUrl = (encodedDemoFileName: string): string => {
  const normalizedName = `${encodedDemoFileName ?? ''}`.trim().replace(/^\/+/, '');
  const relativePath = `/demos/${normalizedName}`;
  const cdnBaseUrl = getMediaCdnBaseUrl();

  if (!cdnBaseUrl) {
    return relativePath;
  }

  try {
    return new URL(relativePath, `${cdnBaseUrl}/`).toString();
  } catch {
    return relativePath;
  }
};
