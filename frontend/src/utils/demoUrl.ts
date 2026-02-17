const normalizeSegment = (segment: string): string => {
  if (!segment) return segment;
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
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

export const buildDemoPlaybackUrl = (demoPath: string, baseUrl: string): string => {
  const normalizedPath = `${demoPath ?? ''}`.trim();
  if (!normalizedPath) {
    return new URL(baseUrl).toString();
  }

  const encodedPath = encodePathBySegment(normalizedPath);
  const absolutePath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`;
  return new URL(absolutePath, baseUrl).toString();
};
