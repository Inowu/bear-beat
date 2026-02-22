const normalizeSegment = (segment: string): string => {
  if (!segment) return segment;
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
};

const decodeSegment = (segment: string): string => {
  if (!segment) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const encodePathBySegment = (rawPath: string): string =>
  rawPath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment, index) => {
      if (segment === '' && index === 0) return '';
      return normalizeSegment(segment);
    })
    .join('/');

const isAbsoluteHttpUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value);

const normalizeCatalogPath = (rawPath: string): string =>
  `${rawPath ?? ''}`
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => decodeSegment(segment))
    .join('/');

export const buildDemoPlaybackUrl = (demoPath: string, baseUrl: string): string => {
  const normalizedPath = `${demoPath ?? ''}`.trim();
  if (!normalizedPath) {
    return new URL(baseUrl).toString();
  }

  if (isAbsoluteHttpUrl(normalizedPath)) {
    try {
      // `#` is a valid file-name char in our catalog but URL parsers treat it as a fragment.
      // Pre-encode it so it remains part of the path.
      const absoluteUrl = new URL(normalizedPath.replace(/#/g, '%23'));
      absoluteUrl.pathname = encodePathBySegment(absoluteUrl.pathname);
      return absoluteUrl.toString();
    } catch {
      // Fall back to relative URL normalization.
    }
  }

  const encodedPath = encodePathBySegment(normalizedPath);
  const absolutePath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`;
  return new URL(absolutePath, baseUrl).toString();
};

export const buildMemberPlaybackUrl = (
  catalogPath: string,
  token: string,
  baseUrl: string,
): string => {
  const normalizedPath = normalizeCatalogPath(catalogPath);
  const authToken = `${token ?? ''}`.trim();
  if (!normalizedPath || !authToken) {
    return new URL(baseUrl).toString();
  }

  const streamUrl = new URL('/stream', baseUrl);
  streamUrl.searchParams.set('path', normalizedPath);
  streamUrl.searchParams.set('token', authToken);
  return streamUrl.toString();
};
