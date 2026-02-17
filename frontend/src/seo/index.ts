import rawSeoRoutes from "./routes.json";

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  indexable: boolean;
  inSitemap: boolean;
  prerender: boolean;
  canonicalPath?: string;
  ogImage?: string;
  twitterImage?: string;
  changefreq?: string;
  priority?: string;
};

type SeoConfig = {
  baseUrl: string;
  defaultMeta: {
    title: string;
    description: string;
    ogImage: string;
    twitterImage: string;
  };
  routes: SeoRoute[];
};

const seoConfig = rawSeoRoutes as SeoConfig;

export const SEO_BASE_URL = seoConfig.baseUrl;
export const SEO_DEFAULT_META = seoConfig.defaultMeta;
export const SEO_ROUTES = seoConfig.routes;

export const normalizeSeoPath = (pathname: string): string => {
  const base = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (!base || base === "/") return "/";
  const withSlash = base.startsWith("/") ? base : `/${base}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
};

const isWildcardRoute = (path: string): boolean => path.endsWith("/*");

const matchesWildcardPath = (pattern: string, pathname: string): boolean => {
  const prefix = pattern.slice(0, -2);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

export const findSeoRoute = (pathname: string): SeoRoute | null => {
  const normalizedPath = normalizeSeoPath(pathname);

  const exact = SEO_ROUTES.find(
    (route) => !isWildcardRoute(route.path) && normalizeSeoPath(route.path) === normalizedPath,
  );
  if (exact) return exact;

  const wildcardRoutes = SEO_ROUTES
    .filter((route) => isWildcardRoute(route.path))
    .sort((a, b) => b.path.length - a.path.length);

  for (const wildcardRoute of wildcardRoutes) {
    if (matchesWildcardPath(normalizeSeoPath(wildcardRoute.path), normalizedPath)) {
      return wildcardRoute;
    }
  }

  return null;
};

export const resolveSeoUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = normalizeSeoPath(pathOrUrl);
  return normalizedPath === "/"
    ? `${SEO_BASE_URL}/`
    : `${SEO_BASE_URL}${normalizedPath}`;
};
