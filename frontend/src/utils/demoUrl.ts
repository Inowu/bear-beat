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

const isAbsoluteHttpUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value);

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
