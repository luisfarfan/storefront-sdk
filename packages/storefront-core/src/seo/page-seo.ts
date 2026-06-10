import type { PageSeoMeta, PageSeoWebsiteMeta } from '../types/seo.js';

/**
 * Build fully resolved SEO metadata for a page.
 *
 * Data priority:
 *   1. Admin-set `PageSEO` fields in `composition.seo` (explicit overrides)
 *   2. Entity-derived data in `composition.seo.entity_name` / `entity_image` (auto-populated by API)
 *   3. Website-level defaults (`website.og_image_url`, etc.)
 *   4. Hard fallbacks (empty strings)
 *
 * @param seoData   The `seo` object from `ProximaCompositionResponse` (may be null)
 * @param website   Website-level SEO fields
 * @param locale    Locale code for resolving localized strings (e.g. "es")
 * @param currentUrl  Absolute URL of the current page — used as canonical fallback
 *
 * @example
 * const seo = buildPageSeo(composition.seo, website, website.locale, canonicalUrl);
 * // → pass to <SiteLayout seo={seo} />
 */
export function buildPageSeo(
  seoData: Record<string, any> | null | undefined,
  website: PageSeoWebsiteMeta,
  locale: string,
  currentUrl: string
): PageSeoMeta {
  /** Resolve a value that may be a localized dict `{ es: "...", en: "..." }` or a plain string */
  function resolveLocalized(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value || null;
    if (typeof value === "object") {
      const map = value as Record<string, string>;
      return map[locale] ?? map["es"] ?? Object.values(map).find(Boolean) ?? null;
    }
    return null;
  }

  const entityName = (seoData?.entity_name as string | null | undefined) ?? null;
  const entityImage = (seoData?.entity_image as string | null | undefined) ?? null;

  // Title: admin-set > entity name + site name > site name
  const adminTitle = resolveLocalized(seoData?.meta_title);
  const title = adminTitle ?? (entityName ? `${entityName} | ${website.name}` : website.name);

  // Description: admin-set > entity-based fallback > site name
  const adminDescription = resolveLocalized(seoData?.meta_description);
  const description =
    adminDescription ??
    (entityName ? `${entityName} en ${website.name}` : website.name);

  // OG image: admin-set > entity image > website og_image_url
  const ogImage =
    (seoData?.og_image as string | null | undefined) ??
    entityImage ??
    (website.og_image_url ?? null);

  const ogType = (seoData?.og_type as string | null | undefined) ?? "website";
  const canonicalUrl = (seoData?.canonical_url as string | null | undefined) ?? currentUrl;
  const robots =
    (seoData?.robots as string | null | undefined) === "noindex"
      ? "noindex, nofollow"
      : "index, follow";

  const rawHandle = website.twitter_handle ?? null;
  const twitterSite = rawHandle ? `@${rawHandle.replace(/^@/, "")}` : null;

  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogType,
    ogSiteName: website.name,
    canonicalUrl,
    robots,
    twitterCard: "summary_large_image",
    twitterSite,
    twitterImage: ogImage,
    faviconUrl: website.favicon_url ?? null,
  };
}