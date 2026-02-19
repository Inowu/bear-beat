/**
 * SEO por ruta: actualiza <title>, description, canonical, OG y Twitter al navegar (SPA).
 * La fuente de verdad vive en src/seo/routes.json.
 */

import {
  SEO_DEFAULT_META,
  findSeoRoute,
  normalizeSeoPath,
  resolveSeoUrl,
} from "../seo";
import { getAdminNavigationItem } from "../constants/adminNavigation";

type RouteSeo = {
  title: string;
  description: string;
  indexable: boolean;
  canonical?: string;
  canonicalPath?: string;
  ogImage?: string;
  twitterImage?: string;
};

const ensureMetaTag = (selector: string, attributes: Record<string, string>): HTMLMetaElement => {
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => {
      element!.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }
  return element;
};

const ensureCanonicalLink = (): HTMLLinkElement => {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  return element;
};

export function applyRouteSeo(pathname: string): void {
  const normalizedPath = normalizeSeoPath(pathname);
  const routeSeo = findSeoRoute(normalizedPath) as RouteSeo | null;

  const defaultTitle = routeSeo?.title ?? SEO_DEFAULT_META.title;
  const adminNavigationItem = normalizedPath.startsWith("/admin")
    ? getAdminNavigationItem(normalizedPath)
    : null;
  const title = adminNavigationItem
    ? `${adminNavigationItem.label} | Admin | Bear Beat`
    : defaultTitle;
  const description = routeSeo?.description ?? SEO_DEFAULT_META.description;
  // Unknown routes must be noindex/nofollow by default.
  const indexable = routeSeo ? routeSeo.indexable === true : false;
  const canonicalUrl = resolveSeoUrl(
    routeSeo?.canonical ?? routeSeo?.canonicalPath ?? normalizedPath,
  );
  const ogImage = routeSeo?.ogImage ?? SEO_DEFAULT_META.ogImage;
  const twitterImage = routeSeo?.twitterImage ?? ogImage;
  const robotsContent = indexable ? "index, follow" : "noindex, nofollow";

  document.title = title;

  ensureMetaTag('meta[name="description"]', { name: "description" }).setAttribute(
    "content",
    description,
  );
  ensureMetaTag('meta[name="robots"]', { name: "robots" }).setAttribute(
    "content",
    robotsContent,
  );
  ensureMetaTag('meta[name="googlebot"]', { name: "googlebot" }).setAttribute(
    "content",
    robotsContent,
  );

  ensureMetaTag('meta[property="og:title"]', { property: "og:title" }).setAttribute(
    "content",
    title,
  );
  ensureMetaTag('meta[property="og:description"]', { property: "og:description" }).setAttribute(
    "content",
    description,
  );
  ensureMetaTag('meta[property="og:url"]', { property: "og:url" }).setAttribute(
    "content",
    canonicalUrl,
  );
  ensureMetaTag('meta[property="og:image"]', { property: "og:image" }).setAttribute(
    "content",
    ogImage,
  );

  ensureMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }).setAttribute(
    "content",
    title,
  );
  ensureMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }).setAttribute(
    "content",
    description,
  );
  ensureMetaTag('meta[name="twitter:url"]', { name: "twitter:url" }).setAttribute(
    "content",
    canonicalUrl,
  );
  ensureMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }).setAttribute(
    "content",
    twitterImage,
  );

  ensureCanonicalLink().setAttribute("href", canonicalUrl);
}
