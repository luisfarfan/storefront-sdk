// ---------------------------------------------------------------------------
// Proxima Storefront Core SDK
// ---------------------------------------------------------------------------
// Single-file client for the Proxima API.  Import what you need:
//   import { loginBuyer, fetchRegistrationForm, addToWishlist } from '@proxima-io/storefront-core';
// ---------------------------------------------------------------------------

export interface ProximaApiConfig {
  baseUrl: string;
  domain: string;
  path: string;
  websiteId?: string;
  businessId?: string;
  serviceKey?: string;
  /** UUID of a content variant — when set, composition returns the variant snapshot instead of live content. */
  variantId?: string;
  /** Preview token obtained from the rotate endpoint. Required when variantId is set. */
  previewToken?: string;
}

export interface ProximaPageSummary {
  name: string;
  path: string;
  resolver_kind: string;
  is_active: boolean;
}

export interface ProximaWebsiteResponse {
  id: string;
  business_id: string;
  name: string;
  domain: string;
  subdomain_slug?: string | null;
  custom_domain?: string | null;
  publication_status?: string;
  published_at?: string | null;
  delivery_mode: string;
  data_mode?: string | null;
  website_kind: string;
  template_key?: string | null;
  code_profile?: string | null;
  locale: string;
  currency: string;
  og_image_url?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  twitter_handle?: string | null;
  capabilities: Record<string, any>;
  theme_tokens: Record<string, any>;
  animation_config: Record<string, any>;
  pages: ProximaPageSummary[];
  shell_sections?: Record<
    string,
    {
      section_id: number;
      section_type: string;
      section_name: string;
      attributes: Record<string, any>;
    }
  >;
}

export interface ProximaCompositionResponse {
  page_id: number;
  website_id: string;
  path: string;
  path_template: string;
  name: string;
  entity_type?: string | null;
  resolver_kind?: string | null;
  route_params: Record<string, string>;
  resolved_data?: Record<string, any> | null;
  sections: Array<{
    id: number;
    name: string;
    type: string;
    order: number;
    attributes: Record<string, any>;
    attributes_meta?: Record<string, any>;
  }>;
  seo?: Record<string, any> | null;
}

export interface ProximaProductListResponse {
  items: any[];
  total: number;
  page: number;
  size: number;
}

// ---------------------------------------------------------------------------
// SEO utilities
// ---------------------------------------------------------------------------

/**
 * Fully resolved SEO metadata for a single page.
 * Produced by `buildPageSeo()` — pass directly to `SiteLayout.astro`.
 */
export interface PageSeoMeta {
  /** `<title>` tag content */
  title: string;
  /** `meta[name="description"]` */
  description: string;
  /** og:title */
  ogTitle: string;
  /** og:description */
  ogDescription: string;
  /** og:image and twitter:image — null when no image is available */
  ogImage: string | null;
  /** og:type — "website" | "product" */
  ogType: string;
  /** og:site_name */
  ogSiteName: string;
  /** og:url and link[rel="canonical"] */
  canonicalUrl: string;
  /** meta[name="robots"] — "index, follow" | "noindex, nofollow" */
  robots: string;
  /** twitter:card */
  twitterCard: string;
  /** twitter:site — "@handle" or null */
  twitterSite: string | null;
  /** twitter:image — mirrors ogImage */
  twitterImage: string | null;
  /** link[rel="icon"] — null when not set */
  faviconUrl: string | null;
}

/**
 * Minimal website surface required by `buildPageSeo()`.
 * Both `ProximaWebsiteResponse` and the storefront's `ResolvedWebsite` satisfy this.
 */
export interface PageSeoWebsiteMeta {
  name: string;
  og_image_url?: string | null;
  favicon_url?: string | null;
  twitter_handle?: string | null;
}

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

// ---------------------------------------------------------------------------
// JSON-LD builders — schema.org structured data
// ---------------------------------------------------------------------------

/**
 * Minimal website surface required by the JSON-LD builders.
 * Both `ProximaWebsiteResponse` and the storefront's `ResolvedWebsite` satisfy this.
 */
export interface JsonLdWebsiteMeta {
  name: string;
  domain: string;
  logo_url?: string | null;
  twitter_handle?: string | null;
}

/**
 * Minimal product surface required by `buildProductJsonLd()`.
 */
export interface JsonLdProductMeta {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  images?: (string | null | undefined)[] | null;
  sku?: string | null;
  brand?: string | null;
  productId?: number | string | null;
  priceRaw: number;
  compareAtPrice?: number | null;
  inStock?: boolean | null;
}

/**
 * A single breadcrumb item.
 */
export interface BreadcrumbItem {
  label: string;
  /** Relative or absolute href — omit for the last (current) item */
  href?: string;
}

/**
 * Build a `WebSite` JSON-LD object.
 * Enables Google's Search Action box in SERPs.
 *
 * @example
 * <script type="application/ld+json" set:html={JSON.stringify(buildWebSiteJsonLd(website))} />
 */
export function buildWebSiteJsonLd(website: JsonLdWebsiteMeta): Record<string, any> {
  const siteUrl = `https://${website.domain}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": website.name,
    "url": `${siteUrl}/`,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/buscar?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Build an `Organization` JSON-LD object.
 * Returns `null` when `website.logo_url` is absent (Google ignores logo-less org markup).
 *
 * @example
 * {orgJsonLd && <script type="application/ld+json" set:html={JSON.stringify(orgJsonLd)} />}
 */
export function buildOrganizationJsonLd(
  website: JsonLdWebsiteMeta
): Record<string, any> | null {
  if (!website.logo_url) return null;
  const siteUrl = `https://${website.domain}`;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": website.name,
    "url": `${siteUrl}/`,
    "logo": { "@type": "ImageObject", "url": website.logo_url },
  };
}

/**
 * Build a `Product` JSON-LD object for a product detail page.
 * Includes `Offer` with pricing, currency, and availability.
 *
 * @example
 * <script type="application/ld+json" set:html={JSON.stringify(buildProductJsonLd(product, website))} />
 */
export function buildProductJsonLd(
  product: JsonLdProductMeta,
  website: { domain: string; currency: string }
): Record<string, any> {
  const siteUrl = `https://${website.domain}`;
  const productUrl = `${siteUrl}/producto/${product.slug}`;

  // Deduplicated image list: primary first, then extras
  const images = [
    product.image,
    ...(product.images?.filter((img) => img && img !== product.image) ?? []),
  ].filter(Boolean) as string[];

  const result: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": images.length === 1 ? images[0] : images,
    "offers": {
      "@type": "Offer",
      "url": productUrl,
      "price": product.priceRaw,
      "priceCurrency": website.currency,
      "availability":
        product.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
  };

  if (product.description) result["description"] = product.description;
  if (product.sku) result["sku"] = product.sku;
  if (product.productId != null) result["identifier"] = String(product.productId);
  if (product.brand) result["brand"] = { "@type": "Brand", "name": product.brand };

  // Strikethrough price — only when compare-at is higher than current
  if (product.compareAtPrice && product.compareAtPrice > product.priceRaw) {
    result["offers"]["priceSpecification"] = {
      "@type": "PriceSpecification",
      "price": product.compareAtPrice,
      "priceCurrency": website.currency,
    };
  }

  return result;
}

/**
 * Build a `BreadcrumbList` JSON-LD object.
 *
 * @param items  Array of breadcrumb steps.  The last item typically has no `href`.
 * @param siteUrl  Absolute site URL, e.g. `https://example.com`
 *
 * @example
 * const crumbs = buildBreadcrumbJsonLd(
 *   [{ label: "Inicio", href: "/" }, { label: "Zapatos", href: "/categoria/zapatos" }, { label: "Nike Air Max" }],
 *   `https://${website.domain}`
 * );
 * <script type="application/ld+json" set:html={JSON.stringify(crumbs)} />
 */
export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  siteUrl: string
): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.label,
      ...(item.href
        ? { "item": item.href.startsWith("http") ? item.href : `${siteUrl}${item.href}` }
        : {}),
    })),
  };
}

/**
 * Minimal surface for a LocalBusiness JSON-LD block (typically emitted by the Footer).
 * All fields are optional — only the ones present will appear in the output.
 */
export interface JsonLdLocalBusinessMeta {
  name: string;
  url: string;
  image?: string | null;
  telephone?: string | null;
  street_address?: string | null;
  address_locality?: string | null;
  address_region?: string | null;
  postal_code?: string | null;
  address_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_hours?: string[] | null;
  opens?: string | null;
  closes?: string | null;
  social_links?: string[] | null;
}

/**
 * Build a `LocalBusiness` JSON-LD object for brick-and-mortar stores.
 * Returns `null` when `seo` is falsy so callers can gate rendering easily.
 *
 * @example
 * const schema = buildLocalBusinessJsonLd(seo);
 * {schema && <script type="application/ld+json" set:html={JSON.stringify(schema)} />}
 */
export function buildLocalBusinessJsonLd(
  seo: JsonLdLocalBusinessMeta | null | undefined
): Record<string, unknown> | null {
  if (!seo) return null;

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": seo.name,
    "url": seo.url,
    "@id": `${seo.url}#localbusiness`,
  };

  if (seo.image) result["image"] = seo.image;
  if (seo.telephone) result["telephone"] = seo.telephone;

  const hasAddress = seo.street_address || seo.address_locality || seo.address_country;
  if (hasAddress) {
    const address: Record<string, unknown> = { "@type": "PostalAddress" };
    if (seo.street_address) address["streetAddress"] = seo.street_address;
    if (seo.address_locality) address["addressLocality"] = seo.address_locality;
    if (seo.address_region) address["addressRegion"] = seo.address_region;
    if (seo.postal_code) address["postalCode"] = seo.postal_code;
    if (seo.address_country) address["addressCountry"] = seo.address_country;
    result["address"] = address;
  }

  if (seo.latitude != null && seo.longitude != null) {
    result["geo"] = {
      "@type": "GeoCoordinates",
      "latitude": seo.latitude,
      "longitude": seo.longitude,
    };
  }

  if (seo.opening_hours?.length || seo.opens || seo.closes) {
    result["openingHoursSpecification"] = [{
      "@type": "OpeningHoursSpecification",
      ...(seo.opening_hours?.length ? { "dayOfWeek": seo.opening_hours } : {}),
      ...(seo.opens ? { "opens": seo.opens } : {}),
      ...(seo.closes ? { "closes": seo.closes } : {}),
    }];
  }

  if (seo.social_links?.length) result["sameAs"] = seo.social_links;

  return result;
}

// ---------------------------------------------------------------------------
// Sitemap + robots.txt generators
// ---------------------------------------------------------------------------

/** Minimal website surface needed by the sitemap / robots generators */
export interface SitemapWebsiteMeta {
  domain: string;
  pages?: Array<{
    resolver_kind: string;
    path?: string | null;
  }> | null;
}

/** Private resolver kinds that must never appear in a sitemap */
const SITEMAP_PRIVATE_KINDS = new Set([
  "cart",
  "checkout",
  "buyer_login",
  "buyer_account",
  "buyer_register",
  "buyer_password_reset",
  "order_list",
  "order_detail",
  "product_compare",
]);

function _xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function _urlEntry(
  loc: string,
  priority = "0.7",
  changefreq = "weekly",
  lastmod?: string
): string {
  const lines = [
    `  <url>`,
    `    <loc>${_xmlEscape(loc)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(`  </url>`);
  return lines.join("\n");
}

/**
 * Generate a complete `sitemap.xml` for a storefront.
 *
 * Includes:
 *  1. Content pages from the website manifest (priority 1.0 for home, 0.8 for others)
 *  2. Category pages from the recursive nav tree (priority 0.8)
 *  3. Brand pages from the brands directory (priority 0.7)
 *  4. Product pages — paginated up to `maxProducts` (priority 0.9)
 *
 * All entries use today's date as `lastmod`.
 *
 * @param website  Resolved website object (domain + pages array)
 * @param apiUrl   Base URL of the Proxima API (e.g. `http://localhost:8000`)
 * @param options  Optional overrides: pageSize (default 60), maxProducts (default 3000)
 *
 * @example
 * // apps/{slug}/src/pages/sitemap.xml.ts
 * import type { APIRoute } from "astro";
 * import { resolveWebsiteOnly } from "@/lib/resolver";
 * import { generateSitemapXml } from "@proxima-io/storefront-core";
 *
 * export const GET: APIRoute = async () => {
 *   const website = await resolveWebsiteOnly();
 *   const xml = await generateSitemapXml(website, import.meta.env.PROXIMA_API_URL ?? "http://localhost:8000");
 *   return new Response(xml, {
 *     headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
 *   });
 * };
 */
export async function generateSitemapXml(
  website: SitemapWebsiteMeta,
  apiUrl: string,
  options: { pageSize?: number; maxProducts?: number } = {}
): Promise<string> {
  const PAGE_SIZE = Math.min(60, options.pageSize ?? 60);
  const MAX_PRODUCTS = options.maxProducts ?? 3000;
  const MAX_PAGES = Math.ceil(MAX_PRODUCTS / PAGE_SIZE);
  const TODAY = new Date().toISOString().split("T")[0];
  const siteUrl = `https://${website.domain}`;
  const entries: string[] = [];

  // 1. Content pages from the website manifest
  for (const page of website.pages ?? []) {
    if (SITEMAP_PRIVATE_KINDS.has(page.resolver_kind)) continue;
    if (page.resolver_kind === "content_page" && page.path) {
      const priority = page.path === "/" ? "1.0" : "0.8";
      const changefreq = page.path === "/" ? "daily" : "weekly";
      entries.push(_urlEntry(`${siteUrl}${page.path}`, priority, changefreq, TODAY));
    }
  }

  // 2. Category pages (recursive nav tree)
  try {
    // Lazy import to avoid circular dependency — fetchCategoryNavTree is defined below
    const tree = await fetchCategoryNavTree({ baseUrl: apiUrl }, website as any);
    function collectHrefs(nodes: typeof tree.nodes) {
      for (const node of nodes) {
        entries.push(_urlEntry(`${siteUrl}${node.href}`, "0.8", "daily", TODAY));
        if (node.children.length > 0) collectHrefs(node.children);
      }
    }
    collectHrefs(tree.nodes);
  } catch {
    /* API offline — skip category URLs */
  }

  // 3. Brand pages
  try {
    const brandsResult = await fetchBrandsDirectory({ baseUrl: apiUrl }, website as any);
    for (const brand of brandsResult.items) {
      entries.push(_urlEntry(`${siteUrl}${brand.href}`, "0.7", "weekly", TODAY));
    }
  } catch {
    /* API offline — skip brand URLs */
  }

  // 4. Product pages (paginated)
  try {
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages && currentPage <= MAX_PAGES) {
      const result = await fetchStorefrontProducts({ baseUrl: apiUrl }, website as any, {
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      for (const product of result.items) {
        entries.push(_urlEntry(`${siteUrl}/producto/${product.slug}`, "0.9", "weekly", TODAY));
      }
      totalPages = result.pagination.total_pages;
      currentPage++;
    }
  } catch {
    /* API offline — skip product URLs */
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("\n");
}

/**
 * Generate a `robots.txt` for a storefront.
 *
 * Blocks all private buyer routes and API paths.
 * Adds a `Sitemap:` directive pointing to `{siteUrl}/sitemap.xml`.
 *
 * @example
 * // apps/{slug}/src/pages/robots.txt.ts
 * import type { APIRoute } from "astro";
 * import { resolveWebsiteOnly } from "@/lib/resolver";
 * import { generateRobotsTxt } from "@proxima-io/storefront-core";
 *
 * export const GET: APIRoute = async () => {
 *   const website = await resolveWebsiteOnly();
 *   return new Response(generateRobotsTxt(website), {
 *     headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
 *   });
 * };
 */
export function generateRobotsTxt(website: { domain: string }): string {
  const siteUrl = `https://${website.domain}`;
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /cuenta",
    "Disallow: /carrito",
    "Disallow: /checkout",
    "Disallow: /api/",
    "Disallow: /dev/",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// IndexNow — real-time URL change notifications
// ---------------------------------------------------------------------------

/**
 * Submit a list of changed URLs to the IndexNow API.
 *
 * IndexNow notifies Bing, Yandex, and (increasingly) Google about new or
 * updated pages so they are re-crawled within seconds instead of waiting for
 * the next sitemap crawl.
 *
 * **Setup (one-time per storefront):**
 * 1. Generate or reuse the key from `PROXIMA_INDEXNOW_KEY` env var.
 * 2. Serve `GET /{key}.txt` returning the key as plain text — see the scaffold
 *    template at `src/pages/[indexnow_key].txt.ts`.
 * 3. That's it — IndexNow verifies the key automatically on first submission.
 *
 * @param apiKey   Your IndexNow key (platform-level; served at `/{apiKey}.txt`)
 * @param siteUrl  Absolute origin of the site, e.g. `https://example.com`
 * @param urls     Absolute URLs that changed (max 10 000 per call)
 *
 * @example
 * await notifyIndexNow("my-secret-key", "https://214store.com", [
 *   "https://214store.com/producto/laptop-gamer",
 * ]);
 */
export async function notifyIndexNow(
  apiKey: string,
  siteUrl: string,
  urls: string[]
): Promise<void> {
  if (!apiKey || urls.length === 0) return;

  const host = new URL(siteUrl).hostname;
  const payload = {
    host,
    key: apiKey,
    keyLocation: `${siteUrl}/${apiKey}.txt`,
    urlList: urls,
  };

  try {
    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok && resp.status !== 202) {
      console.warn(`[IndexNow] Submission returned ${resp.status} for ${host}`);
    }
  } catch (err) {
    console.warn(`[IndexNow] Submission failed for ${host}:`, err);
  }
}

/**
 * Public business profile — tenant-wide data the merchant edits once via
 * PUT /admin/store/presence and that ALL of their websites render (footer,
 * contact widgets, JSON-LD).
 *
 * Replaces the per-website hardcoded values (social links, legal URLs,
 * showroom address, etc.) that used to live in each storefront's footer.
 */
export interface StorefrontBusinessProfile {
  business_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tagline: string | null;
  currency_code: string;
  timezone: string;
  contact: {
    email: string | null;
    support_email: string | null;
    support_phone: string | null;
    whatsapp: string | null;
    /** Pre-built `https://wa.me/{digits}` link derived from `whatsapp`. */
    whatsapp_url: string | null;
  };
  social: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    youtube: string | null;
    twitter: string | null;
    linkedin: string | null;
  };
  legal: {
    terms_url: string | null;
    privacy_url: string | null;
    /** Peru-specific "Libro de Reclamaciones" URL. */
    complaints_book_url: string | null;
  };
  presence_mode: "physical" | "virtual" | "both";
  primary_location: StorefrontBusinessLocation | null;
  locations: StorefrontBusinessLocation[];
}

export interface StorefrontBusinessLocation {
  id: string | null;
  kind: "store" | "pickup_point" | "showroom";
  label: string;
  is_primary: boolean;
  address_line: string;
  ubigeo_code: string | null;
  reference: string | null;
  phone: string | null;
  hours_text: string | null;
  show_on_website: boolean;
  is_active: boolean;
  sort_order: number;
  warehouse_id: number | null;
  ubigeo: {
    code: string;
    department: string;
    province: string;
    district: string;
    full_name: string;
  } | null;
}

/**
 * Fetch the public business profile for a tenant. Call this once per request
 * and cache the result on `Astro.locals` so the footer (and any other
 * profile-aware component) reads from memory, not over the wire.
 *
 * @example
 * const profile = await fetchBusinessProfile(
 *   { baseUrl: env.apiUrl, serviceKey: env.serviceKey },
 *   website.business_id
 * );
 */
export async function fetchBusinessProfile(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontBusinessProfile> {
  const url = new URL("/api/v1/storefront/business/profile", config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Business profile fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Active promotional campaign — the single source of truth for "when does
 * this sale end" + the display knobs (badge text, theme color, hero copy).
 *
 * When a campaign is linked to a SmartCollection (via `smart_collection_id`),
 * the storefront's composition endpoint also reflects the campaign's
 * `active_until` in `schedule.countdown_target_at`, so existing countdown
 * components keep working transparently. Sections that want richer display
 * (badge, themed CTA, multi-locale copy) read the full campaign payload here.
 */
export interface StorefrontCampaign {
  id: number;
  slug: string | null;
  name: Record<string, string>;
  description: Record<string, string> | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  target_type: "product" | "category" | "brand" | "global";
  target_ids: number[];
  active_from: string | null;
  active_until: string | null;
  smart_collection_id: number | null;
  display_config: {
    badge_text?: string | null;
    hero_copy?: Record<string, string> | null;
    theme_color?: string | null;
    show_countdown?: boolean | null;
  } | null;
}

/**
 * Fetch all active campaigns for a tenant. An "active" campaign is
 * `is_active=true` AND (active_until is null OR active_until > now).
 * Scheduled-but-not-yet-started campaigns are included so the storefront
 * can render teasers ("Empieza en X días"); filter by `active_from` if
 * you only want strictly-live ones.
 */
export async function fetchCampaigns(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontCampaign[]> {
  const url = new URL("/api/v1/storefront/campaigns", config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Campaigns fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Fetch a single campaign by slug. Returns null if the campaign doesn't
 * exist or is no longer active — sections pinned to a specific campaign
 * (e.g. a hero hardcoded to 'black-week-2026') use this to detect when
 * to fall back to their generic copy.
 */
export async function fetchCampaignBySlug(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
  slug: string,
): Promise<StorefrontCampaign | null> {
  const url = new URL(`/api/v1/storefront/campaigns/${encodeURIComponent(slug)}`, config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Campaign fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Payment method enabled by the merchant for their storefront. The shape mirrors
 * the API's `StorefrontPaymentMethodInstruction` but keeps only the fields the
 * storefront footer / "we accept" badges need. Checkout flows that also need
 * wallet phones, bank accounts, QR codes can extend this type or fetch the
 * full instructions endpoint separately.
 */
export interface StorefrontPaymentMethod {
  code: string;
  name_es: string;
  description_es: string | null;
  category: string;
  kind: "offline" | "online" | "hybrid";
  /** Platform-managed icon URL. May be null if the platform catalog hasn't seeded one — the storefront should fall back to a locally styled badge keyed off `code`. */
  icon_url: string | null;
}

/**
 * Fetch the merchant's enabled payment methods. Tenant-wide — call once per
 * request and cache on `Astro.locals` so the footer reads from memory.
 *
 * Backed by `GET /store/commerce/payment-instructions` (public storefront
 * endpoint — same surface used by the checkout flow).
 *
 * @example
 * const methods = await fetchPaymentMethods(
 *   { baseUrl: env.apiUrl, serviceKey: env.serviceKey },
 *   website.business_id,
 * );
 */
export async function fetchPaymentMethods(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontPaymentMethod[]> {
  const url = new URL("/api/v1/store/commerce/payment-instructions", config.baseUrl);
  const headers: Record<string, string> = {
    "X-Business-ID": businessId,
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Payment methods fetch failed: ${response.status}`);
  const data = await response.json() as { items?: StorefrontPaymentMethod[] };
  return data.items ?? [];
}

/** List all websites for a service-key authenticated caller. Useful for build-time scripts. */
export async function fetchProximaWebsiteList(config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">): Promise<ProximaWebsiteResponse[]> {
  const url = new URL("/api/v1/storefront/cms/websites", config.baseUrl);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Website list failed: ${response.status}`);
  return response.json();
}

/**
 * Resolve a website by domain/host. Call this once per request and cache the result.
 * Pass `host` if the incoming request host differs from `config.domain` (e.g. in middleware).
 *
 * @example
 * const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: Astro.url.hostname });
 */
export async function fetchProximaWebsite(
  config: Pick<ProximaApiConfig, "baseUrl" | "domain" | "serviceKey"> & { host?: string }
): Promise<ProximaWebsiteResponse> {
  const url = new URL("/api/v1/storefront/cms/websites/resolve", config.baseUrl);
  url.searchParams.set("host", config.host || config.domain);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Website resolve failed: ${response.status}`);
  return response.json();
}

/**
 * Build a synthetic `ProximaWebsiteResponse` for the visual builder preview.
 * Use this when the builder passes `websiteId` and `businessId` via query params
 * instead of resolving by domain.
 */
export function makeBuilderPreviewWebsite(
  config: Pick<ProximaApiConfig, "websiteId" | "businessId" | "domain">
): ProximaWebsiteResponse {
  if (!config.websiteId || !config.businessId) {
    throw new Error("Builder preview requires websiteId and businessId");
  }
  return {
    id: config.websiteId,
    business_id: config.businessId,
    name: "Builder preview",
    domain: config.domain,
    delivery_mode: "custom_managed",
    website_kind: "ecommerce",
    template_key: null,
    code_profile: null,
    locale: "es",
    currency: "PEN",
    capabilities: {},
    theme_tokens: {},
    animation_config: {},
    pages: [],
  };
}

/**
 * Fetch the fully resolved page composition for the given path.
 * This is the main data-fetching call for every SSR page render.
 * The response embeds all section data (via smart collections) and, for detail pages,
 * the primary entity in `resolved_data` (product, category, brand, blog post).
 * No additional catalog API calls are needed for the initial render.
 *
 * @example
 * // src/pages/[...path].astro
 * const composition = await fetchProximaComposition(
 *   { ...config, path: Astro.url.pathname },
 *   website
 * );
 */
export async function fetchProximaComposition(
  config: ProximaApiConfig,
  website: ProximaWebsiteResponse,
): Promise<ProximaCompositionResponse> {
  const locale = website.locale ?? "es";
  const currency = website.currency ?? "PEN";
  const url = new URL(`/api/v1/storefront/cms/websites/${website.id}/pages/composition`, config.baseUrl);
  url.searchParams.set("path", config.path);
  url.searchParams.set("locale", locale);
  url.searchParams.set("business_id", website.business_id);
  if (config.variantId)   url.searchParams.set("variant_id", config.variantId);
  if (config.previewToken) url.searchParams.set("preview_token", config.previewToken);
  const headers: Record<string, string> = {
    "X-Business-ID": website.business_id,
    "Accept-Language": locale,
    "X-Currency": currency,
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Composition failed: ${response.status}`);
  return response.json();
}

/**
 * @deprecated Use `fetchStorefrontProducts` instead. This function calls the raw
 * catalog endpoint (`/api/v1/products`) which is not enriched for storefront use
 * (no price_formatted, no badge, no default_variant_id). It will be removed in a future version.
 */
export async function fetchProximaProducts(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  website: ProximaWebsiteResponse,
): Promise<ProximaProductListResponse> {
  const url = new URL("/api/v1/products", config.baseUrl);
  url.searchParams.set("size", "12");
  const headers: Record<string, string> = {
    "X-Business-ID": website.business_id,
    "Accept-Language": website.locale ?? "es",
    "X-Currency": website.currency ?? "PEN",
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Products failed: ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Error constants
// ---------------------------------------------------------------------------

/** Well-known error detail strings returned by the API. Use these for comparison
 *  instead of hardcoding strings in your storefront.
 *
 * @example
 * try { await resetPassword(...) } catch (e: any) {
 *   if (e.data?.detail === BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID) { ... }
 * }
 */
export const BUYER_AUTH_ERRORS = {
  RESET_TOKEN_INVALID:    "RESET_TOKEN_INVALID",
  VERIFY_TOKEN_INVALID:   "VERIFY_TOKEN_INVALID",
  EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
  EMAIL_TAKEN:            "Email already registered in this store",
  MISSING_REQUIRED_FIELDS: "MISSING_REQUIRED_FIELDS",
} as const;

// ---------------------------------------------------------------------------
// Buyer Auth types
// ---------------------------------------------------------------------------

/** Token pair returned by /store/auth/register, /store/auth/login, /store/auth/refresh */
export interface BuyerSession {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
}

/** Full customer profile from GET /store/me */
export interface BuyerProfile {
  id: number;
  email: string;
  business_id: string;
  full_name: string | null;
  phone: string | null;
  doc_type: number | null;          // 1=DNI 2=CE 3=Pasaporte 6=RUC
  doc_number: string | null;
  birth_date: string | null;        // "YYYY-MM-DD"
  newsletter_subscribed: boolean;
  avatar_url: string | null;
  metadata: Record<string, any>;    // custom fields configured per merchant
  registration_source: string;      // "organic" | "google_ads" | ...
  last_login_at: string | null;     // ISO datetime
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Registration Form types
// ---------------------------------------------------------------------------

/** A single resolved field in the storefront registration form. */
export interface RegistrationFormField {
  name: string;
  label: string;
  /** "text" | "password" | "phone" | "date" | "select" | "boolean" | "image" | "address" | "custom" */
  type: string;
  /** "text_input" | "phone_input" | "date_picker" | "select" | "checkbox" | "toggle"
   *  | "image_upload" | "ubigeo_selector" | "google_maps_picker" | "manual" */
  widget: string;
  widget_config: Record<string, any>;
  required: boolean;
  order: number;
  options: string[] | null;
}

/** A single step in the form (always at least one). */
export interface RegistrationFormStep {
  id: string;
  label: string;
  order: number;
  skippable: boolean;
  fields: RegistrationFormField[];
}

/** Full resolved form schema from GET /store/auth/registration-form.
 *  `email` and `password` are always present in steps[0].fields — no need to add them. */
export interface RegistrationForm {
  mode: "single_step" | "multi_step";
  steps: RegistrationFormStep[];
}

// ---------------------------------------------------------------------------
// Registration params & errors
// ---------------------------------------------------------------------------

/** Address submitted during customer registration. */
export interface AddressInRegistration {
  line1: string;
  line2?: string | null;
  reference?: string | null;
  /** 6-digit Peruvian ubigeo code, e.g. "150101" */
  ubigeo_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** "google_maps" | "ubigeo_centroid" | "manual" */
  geocoding_source?: string | null;
}

/** All accepted fields for POST /store/auth/register.
 *  Which fields are required depends on the merchant's registration form configuration.
 *  Use fetchRegistrationForm() to know which fields to show and which are required. */
export interface BuyerRegisterParams {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  /** Default "organic". */
  registrationSource?: string;
  /** Custom fields configured by the merchant — keyed by field name. */
  metadata?: Record<string, any>;
  address?: AddressInRegistration | null;
  /** Cloudflare Turnstile token from the widget — required when API has TURNSTILE_ENABLED=true */
  captchaToken?: string | null;
}

/** A single field that was missing in the registration request. */
export interface MissingField {
  field: string;
  msg: string; // always "FIELD_REQUIRED"
}

/**
 * Thrown when the API returns 422 MISSING_REQUIRED_FIELDS.
 * Use `error.missingFields` to mark exactly which fields are invalid in the UI.
 *
 * @example
 * try {
 *   await registerBuyer(config, website, params);
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     for (const { field } of e.missingFields) markFieldError(field);
 *   }
 * }
 */
export class MissingFieldsError extends Error {
  status = 422 as const;
  missingFields: MissingField[];
  constructor(missingFields: MissingField[]) {
    super("MISSING_REQUIRED_FIELDS");
    this.name = "MissingFieldsError";
    this.missingFields = missingFields;
  }
}

// ---------------------------------------------------------------------------
// Profile update params
// ---------------------------------------------------------------------------

/** Fields the customer can update via PATCH /store/me/profile. All optional. */
export interface BuyerProfileUpdateParams {
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  avatarUrl?: string | null;
  /** If provided, changes the customer's password. */
  password?: string;
}

// ---------------------------------------------------------------------------
// Storefront catalog types
// ---------------------------------------------------------------------------

/** Lightweight product representation used in listings, search results, and smart collections. */
export interface StorefrontProductSummary {
  id: number;
  name: string;
  slug: string;
  price: number;
  price_formatted?: string | null;
  image_url: string;
  brand_name?: string | null;
  category_name?: string | null;
  /** Promotional badge text, e.g. "OFERTA", "NUEVO" */
  badge?: string | null;
  rating: number;
  currency?: string | null;
  /** First variant id — use this when calling addToCart from a listing card */
  default_variant_id?: number | null;
}

/** Pagination metadata returned by listing endpoints. */
export interface StorefrontPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface StorefrontSortOption {
  value: string;
  label: string;
}

export interface StorefrontFacetOption {
  value: string;
  label: string;
  count: number;
}

/** Response from GET /storefront/search */
export interface StorefrontSearchResponse {
  query: string;
  hits: StorefrontProductSummary[];
  total: number;
}

/** Response from GET /storefront/products (all-products listing with facets) */
export interface StorefrontProductListingResponse {
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategorySummary {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
}

export interface StorefrontBrandSummary {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

/** Response from GET /storefront/categories/{slug}/products */
export interface StorefrontCategoryListingResponse {
  category: StorefrontCategorySummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
}

/** Response from GET /storefront/brands/{slug}/products */
export interface StorefrontBrandListingResponse {
  brand: StorefrontBrandSummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategoryDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  image_url?: string | null;
  description?: string | null;
  product_count: number;
}

export interface StorefrontBrandDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  logo_url?: string | null;
  product_count: number;
}

export interface StorefrontCategoryDirectoryResponse {
  items: StorefrontCategoryDirectoryItem[];
  total: number;
}

export interface StorefrontBrandDirectoryResponse {
  items: StorefrontBrandDirectoryItem[];
  total: number;
}

/** Shared params for product listing endpoints — sort, pagination, filters. */
export interface StorefrontListingParams {
  /** Page number, starting at 1 */
  page?: number;
  /** Items per page (1–60). Default: 24 */
  pageSize?: number;
  /** "newest" | "price_asc" | "price_desc" | "popular". Default: "newest" */
  sort?: string;
  /** Locale for translated names, e.g. "es", "en" */
  locale?: string;
  /** ISO currency code, e.g. "PEN", "USD" */
  currency?: string;
}

/** Coupon validation result from GET /commerce/coupons/validate */
export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  /** Amount to deduct from the order total */
  discount_amount?: number;
  /** "percentage" | "fixed" */
  discount_type?: string;
  discount_value?: number;
  /** Error message when valid=false */
  error?: string;
}

// ---------------------------------------------------------------------------
// Cart types
// ---------------------------------------------------------------------------

/** A line item inside a Cart. */
export interface CartItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  metadata?: {
    name?: string | null;
    slug?: string | null;
    brand?: string | null;
    image?: string | null;
    unit_price?: number | null;
    unit_price_string?: string | null;
  } | null;
}

export interface CartTotals {
  subtotal: number;
  formatted_subtotal: string;
  currency: string;
}

/** Shopping cart for a guest session or authenticated customer. */
export interface Cart {
  id: string;
  session_id?: string | null;
  customer_id?: number | null;
  items: CartItem[];
  totals: CartTotals;
}

/** Customer and shipping details submitted at checkout. */
export interface CheckoutRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  customer_doc_type?: number | null;
  customer_doc_number?: string | null;
  address_id?: number | null;
}

// ---------------------------------------------------------------------------
// Address types
// ---------------------------------------------------------------------------

export interface UbigeoResult {
  code: string;
  department: string;
  province: string;
  district: string;
  full_name: string;
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  business_id: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  ubigeo?: UbigeoResult | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default?: boolean;
}

// ---------------------------------------------------------------------------
// Order types
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: number;
  product_variant_id?: number | null;
  product_id?: number | null;
  product_slug?: string | null;
  product_image?: string | null;
  product_name?: string | null;
  brand_name?: string | null;
  category_name?: string | null;
  sku?: string | null;
  quantity: number;
  price_at_purchase?: number | null;
  /** @deprecated use price_at_purchase */
  unit_price?: number | null;
  /** @deprecated use product_name */
  name?: string | null;
}

/** An order placed by a customer. */
export interface Order {
  id: string;
  order_number?: string | null;
  status: string;
  total_amount?: number | null;
  currency?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: string | null;
  created_at: string;
  items?: OrderItem[];
  /** @deprecated use total_amount */
  total?: number;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Wishlist types
// ---------------------------------------------------------------------------

/** A single item in the customer's wishlist. */
export interface WishlistItem {
  id: number;
  customer_id: number;
  business_id: string;
  product_id: string;       // UUID — references catalog, no FK enforced
  variant_id: string | null;
  notes: string | null;
  added_at: string;         // ISO datetime
}

// ---------------------------------------------------------------------------
// Server-side env
// ---------------------------------------------------------------------------

/**
 * Environment variables needed by server-side `process*` helpers.
 * Typically populated from `import.meta.env` in an Astro API route.
 */
export interface BuyerServerEnv {
  apiUrl: string;
  domain: string;
  serviceKey?: string;
}

/** Recommended options for the buyer session cookie. Apply to both `buyer_token` and `buyer_refresh_token`. */
export const BUYER_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
} as const;

export const BUYER_COOKIE_NAME = "buyer_token";
export const BUYER_REFRESH_COOKIE_NAME = "buyer_refresh_token";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function apiError(status: number, data: unknown): Error {
  return Object.assign(new Error(`Request failed: ${status}`), { status, data });
}

function authHeaders(
  businessId: string,
  token?: string | null
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ---------------------------------------------------------------------------
// Registration Form
// ---------------------------------------------------------------------------

/**
 * Fetch the merchant-configured registration form schema.
 * Call this server-side in your /register page to know which fields to render
 * and which are required. `email` and `password` are always prepended by the API.
 *
 * @example
 * // src/pages/register.astro
 * const form = await fetchRegistrationForm({ baseUrl: env.apiUrl }, website);
 * // Pass `form` as a prop to a client component that renders the dynamic form
 */
export async function fetchRegistrationForm(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">
): Promise<RegistrationForm> {
  const url = new URL("/api/v1/store/auth/registration-form", config.baseUrl);
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) {
    throw apiError(res.status, await res.json().catch(() => ({})));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Buyer Auth — client-side functions
// ---------------------------------------------------------------------------

/**
 * Register a new customer. The merchant decides which fields are required —
 * call fetchRegistrationForm() first to know what to collect.
 *
 * Throws MissingFieldsError when the merchant marked fields as required but
 * they were omitted, so you can mark exactly which inputs are invalid.
 *
 * @example
 * try {
 *   const session = await registerBuyer(config, website, { email, password, fullName });
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     e.missingFields.forEach(({ field }) => markError(field));
 *   }
 * }
 */
export async function registerBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: BuyerRegisterParams
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/register", config.baseUrl);
  const body: Record<string, any> = {
    email: params.email,
    password: params.password,
  };
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.registrationSource !== undefined)  body.registration_source = params.registrationSource;
  if (params.metadata !== undefined)            body.metadata = params.metadata;
  if (params.address !== undefined)             body.address = params.address;
  if (params.captchaToken)                      body.captcha_token = params.captchaToken;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Parse MISSING_REQUIRED_FIELDS into structured MissingFieldsError
    if (res.status === 422 && typeof data.detail === "string" && data.detail.startsWith("MISSING_REQUIRED_FIELDS:")) {
      try {
        const raw = data.detail.replace("MISSING_REQUIRED_FIELDS:", "").trim();
        // API returns Python repr: [{'field': 'phone', 'msg': 'FIELD_REQUIRED'}, ...]
        // Safe to JSON.parse after normalizing Python single-quotes
        const normalized = raw.replace(/'/g, '"');
        const missingFields: MissingField[] = JSON.parse(normalized);
        throw new MissingFieldsError(missingFields);
      } catch (e) {
        if (e instanceof MissingFieldsError) throw e;
        // If parsing failed, fall through to generic error
      }
    }
    throw apiError(res.status, data);
  }
  return res.json();
}

/**
 * Authenticate a customer with email and password.
 * Returns a BuyerSession with access_token and refresh_token.
 * Throws { status: 401 } on wrong credentials.
 */
export async function loginBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; password: string; captchaToken?: string | null }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/login", config.baseUrl);
  const body: Record<string, any> = { email: params.email, password: params.password };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Invalidate the current session server-side. Best-effort — always clear the cookie too. */
export async function logoutBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/logout", config.baseUrl);
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
}

/**
 * Exchange a refresh token for a new access token.
 * Call this when you get a 401 on any authenticated request.
 * Throws { status: 401 } if the refresh token is expired or revoked.
 *
 * @example
 * // In Astro middleware:
 * try {
 *   const session = await refreshBuyerToken(config, website, { refreshToken });
 *   // Set new access_token cookie
 * } catch {
 *   // Clear both cookies, redirect to login
 * }
 */
export async function refreshBuyerToken(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { refreshToken: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/refresh", config.baseUrl);
  url.searchParams.set("refresh_token", params.refreshToken);
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's full profile. */
export async function fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Update the authenticated customer's profile. Only the fields you include
 * in `params` are changed — it's a partial update.
 */
export async function updateBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string } & BuyerProfileUpdateParams
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me/profile", config.baseUrl);
  const body: Record<string, any> = {};
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.avatarUrl !== undefined)           body.avatar_url = params.avatarUrl;
  if (params.password !== undefined)            body.password = params.password;

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Password recovery & email verification
// ---------------------------------------------------------------------------

/**
 * Send a password reset email. Always resolves — even if the email doesn't exist.
 * Always show: "Si el email existe, recibirás un enlace para restablecer tu contraseña."
 */
export async function forgotPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; captchaToken?: string | null }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/forgot-password", config.baseUrl);
  const body: Record<string, any> = { email: params.email };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });
}

/**
 * Reset the customer's password using the token from the reset email link.
 * The token is the `?token=` query param in the reset URL.
 * On success, all active sessions are revoked — redirect to login.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function resetPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string; newPassword: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/reset-password", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token, new_password: params.newPassword }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Verify the customer's email using the token from the verification email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function verifyEmail(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/verify-email", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Re-send the email verification link. Requires the customer to be authenticated.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED } if already verified.
 */
export async function resendVerification(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/resend-verification", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

// ---------------------------------------------------------------------------
// Storefront catalog — search & listings (client-side interactions)
// ---------------------------------------------------------------------------

// Internal helper: builds the Accept-Language + X-Currency + X-Business-ID headers
function storefrontHeaders(
  businessId: string,
  locale?: string,
  currency?: string,
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (locale)   h["Accept-Language"] = locale;
  if (currency) h["X-Currency"] = currency;
  return h;
}

/**
 * Search products by query string. Use this for the search bar, autocomplete,
 * and search results pages — `resolved_data` for a `search` page is intentionally
 * null; query results must be fetched directly.
 *
 * @example
 * const results = await searchStorefront(config, website, { q: 'zapatillas', limit: 10 });
 */
export async function searchStorefront(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: { q: string; limit?: number; locale?: string; currency?: string }
): Promise<StorefrontSearchResponse> {
  const url = new URL("/api/v1/storefront/search", config.baseUrl);
  url.searchParams.set("q", params.q);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the general product listing with optional filters and pagination.
 * Use this for client-side filter/sort/paginate interactions on the all-products page.
 * The initial page render is handled by the composition — call this for subsequent
 * filter changes and page turns.
 */
export async function fetchStorefrontProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    brand?: string;
    category?: string;
    q?: string;
  } = {}
): Promise<StorefrontProductListingResponse> {
  const url = new URL("/api/v1/storefront/products", config.baseUrl);
  if (params.page)             url.searchParams.set("page", String(params.page));
  if (params.pageSize)         url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)             url.searchParams.set("sort", params.sort);
  if (params.brand)            url.searchParams.set("brand", params.brand);
  if (params.category)         url.searchParams.set("category", params.category);
  if (params.q)                url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch paginated + filtered products for a category page (CLP).
 * Use this for client-side filter/sort/paginate after the initial SSR render
 * (which arrives in `resolved_data` from `fetchProximaComposition`).
 */
export async function fetchCategoryProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    /** Category slug, from the URL path */
    slug: string;
    brand?: string;
    q?: string;
  }
): Promise<StorefrontCategoryListingResponse> {
  const url = new URL(`/api/v1/storefront/categories/${encodeURIComponent(params.slug)}/products`, config.baseUrl);
  if (params.page)     url.searchParams.set("page", String(params.page));
  if (params.pageSize) url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)     url.searchParams.set("sort", params.sort);
  if (params.brand)    url.searchParams.set("brand", params.brand);
  if (params.q)        url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch paginated + filtered products for a brand page (BLP).
 * Use this for client-side filter/sort/paginate after the initial SSR render
 * (which arrives in `resolved_data` from `fetchProximaComposition`).
 */
export async function fetchBrandProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    /** Brand slug, from the URL path */
    slug: string;
    category?: string;
    q?: string;
  }
): Promise<StorefrontBrandListingResponse> {
  const url = new URL(`/api/v1/storefront/brands/${encodeURIComponent(params.slug)}/products`, config.baseUrl);
  if (params.page)     url.searchParams.set("page", String(params.page));
  if (params.pageSize) url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)     url.searchParams.set("sort", params.sort);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.q)        url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the full category directory (all categories with product counts).
 * Useful for navigation menus and sitemap generation.
 * For section-level category carousels, use smart collections via composition instead.
 */
export async function fetchCategoriesDirectory(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale">,
  params: { locale?: string } = {}
): Promise<StorefrontCategoryDirectoryResponse> {
  const url = new URL("/api/v1/storefront/categories", config.baseUrl);
  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, params.locale ?? website.locale),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * A single node in the category navigation tree.
 * `children` contains nodes at the next depth level (up to `max_depth`).
 */
export interface CategoryNavNode {
  id: number;
  slug: string;
  name: string;
  /** Storefront href — always `/categoria/{slug}` */
  href: string;
  image_url?: string | null;
  product_count: number;
  children: CategoryNavNode[];
}

export interface CategoryNavTreeResponse {
  nodes: CategoryNavNode[];
  total: number;
}

/**
 * Fetch the full category hierarchy as a recursive tree.
 * Use this for data-driven mega menus — it returns nested `children[]`
 * with `/categoria/{slug}` hrefs ready to render.
 *
 * @param maxDepth - Maximum tree depth (1–5, default 3)
 */
export async function fetchCategoryNavTree(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale">,
  params: { maxDepth?: number; locale?: string } = {}
): Promise<CategoryNavTreeResponse> {
  const url = new URL("/api/v1/storefront/categories/tree", config.baseUrl);
  if (params.maxDepth !== undefined) url.searchParams.set("max_depth", String(params.maxDepth));
  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, params.locale ?? website.locale),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the full brand directory (all brands with product counts).
 * Useful for navigation menus and sitemap generation.
 */
export async function fetchBrandsDirectory(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale">,
  params: { locale?: string } = {}
): Promise<StorefrontBrandDirectoryResponse> {
  const url = new URL("/api/v1/storefront/brands", config.baseUrl);
  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, params.locale ?? website.locale),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

function cartHeaders(businessId: string, token?: string | null, sessionId?: string | null): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (sessionId && !token) h["X-Session-ID"] = sessionId;
  return h;
}

/** Fetch the current cart. Works for both guest sessions and authenticated customers. */
export async function fetchCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null }
): Promise<Cart> {
  const url = new URL("/api/v1/cart", config.baseUrl);
  const res = await fetch(url, { headers: cartHeaders(website.business_id, params.token, params.sessionId) });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product variant to the cart. Use `StorefrontProductSummary.default_variant_id`
 * as `variantId` when adding from a listing card.
 */
export async function addToCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/items", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token, params.sessionId) },
    body: JSON.stringify({ product_variant_id: params.variantId, quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Update the quantity of an existing cart item. Set `quantity` to 0 to remove it. */
export async function updateCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token, params.sessionId) },
    body: JSON.stringify({ quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Remove a product variant from the cart entirely. */
export async function removeCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: cartHeaders(website.business_id, params.token, params.sessionId),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Merge a guest cart (identified by session ID) into the authenticated customer's cart.
 * Call this immediately after a successful login if there is an active guest session.
 *
 * @example
 * const sessionId = localStorage.getItem('proxima_session_id');
 * if (sessionId) await mergeGuestCart(config, website, { token, sessionId });
 */
export async function mergeGuestCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; sessionId: string }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/merge", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Business-ID": website.business_id,
      "X-Session-ID": params.sessionId,
      "Authorization": `Bearer ${params.token}`,
    },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Validate a coupon code before checkout. Always resolves — check `result.valid`.
 * Use the `discount_amount` from the result to preview the discount in the UI.
 *
 * @example
 * const result = await validateCoupon(config, website, { code: 'PROMO10', amount: 150.00 });
 * if (result.valid) showDiscount(result.discount_amount);
 * else showError(result.error);
 */
export async function validateCoupon(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { code: string; amount: number }
): Promise<CouponValidationResult> {
  const url = new URL("/api/v1/commerce/coupons/validate", config.baseUrl);
  url.searchParams.set("code", params.code);
  url.searchParams.set("amount", String(params.amount));
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Submit the current cart as an order (checkout). The cart must be non-empty.
 * On success the cart is cleared. Throws 400 on validation errors (e.g. out of stock).
 */
export async function createOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; checkout: CheckoutRequest }
): Promise<Order> {
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.checkout),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's order history, paginated. */
export async function fetchOrders(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; page?: number; size?: number }
): Promise<OrderListResponse> {
  const url = new URL("/api/v1/store/me/orders", config.baseUrl);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.size) url.searchParams.set("size", String(params.size));
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch a single order by ID. Works for authenticated customers and guests with the receipt token. */
export async function fetchOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; orderId: string }
): Promise<Order> {
  const url = new URL(`/api/v1/orders/${params.orderId}`, config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Address Book
// ---------------------------------------------------------------------------

/** Fetch all saved addresses for the authenticated customer. */
export async function fetchCustomerAddresses(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<CustomerAddress[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`fetchCustomerAddresses failed: ${res.status}`);
  return res.json();
}

/** Save a new address to the customer's address book. */
export async function createCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; address: AddressInput }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("createCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Partially update a saved address. Only the fields included in `address` are changed. */
export async function updateCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number; address: Partial<AddressInput> }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("updateCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Delete a saved address. Throws if the address does not exist. */
export async function deleteCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`deleteCustomerAddress failed: ${res.status}`);
}

/** Mark an address as the customer's default. The previous default is unset automatically. */
export async function setDefaultAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}/default`, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`setDefaultAddress failed: ${res.status}`);
  return res.json();
}

/**
 * Search Peruvian ubigeo codes (department/province/district) by name.
 * Use this to power the address form's location selector.
 * Returns an empty array on error instead of throwing.
 */
export async function searchUbigeo(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { q: string }
): Promise<UbigeoResult[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/catalog/locations/ubigeos?q=${encodeURIComponent(params.q)}`);
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

/**
 * Fetch all wishlist items for the authenticated customer.
 * Returns an empty array if the wishlist is empty.
 */
export async function fetchWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<WishlistItem[]> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product to the wishlist. Idempotent — if the product is already
 * in the wishlist, returns the existing item without creating a duplicate.
 */
export async function addToWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: {
    token: string;
    productId: string;
    variantId?: string | null;
    notes?: string | null;
  }
): Promise<WishlistItem> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify({
      product_id: params.productId,
      variant_id: params.variantId ?? null,
      notes: params.notes ?? null,
    }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Remove a product from the wishlist.
 * Throws { status: 404 } if the product was not in the wishlist.
 */
export async function removeFromWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; productId: string }
): Promise<void> {
  const url = new URL(`/api/v1/store/me/wishlist/${params.productId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

// ---------------------------------------------------------------------------
// Server-side Handler Helpers (for Astro API routes)
//
// These orchestrators combine fetchProximaWebsite + SDK calls so that Astro
// API routes become thin wrappers (~10 lines) that only deal with cookies
// and redirects. Use them in `src/pages/api/buyer/**` files.
// ---------------------------------------------------------------------------

/**
 * Resolve the website then call loginBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 */
export async function processBuyerLogin(
  env: BuyerServerEnv,
  params: { email: string; password: string; next?: string; captchaToken?: string | null }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await loginBuyer({ baseUrl: env.apiUrl }, website, { email: params.email, password: params.password, captchaToken: params.captchaToken });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: params.next || "/" };
}

/**
 * Resolve the website then call registerBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 * Propagates MissingFieldsError so the API route can return structured 422 errors.
 */
export async function processBuyerRegister(
  env: BuyerServerEnv,
  params: BuyerRegisterParams & { next?: string }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const { next, ...registerParams } = params;
  const session = await registerBuyer({ baseUrl: env.apiUrl }, website, registerParams);
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: next || "/" };
}

/**
 * Call logoutBuyer (best-effort — never throws).
 * Always clear the session cookie regardless of the result.
 */
export async function processBuyerLogout(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await logoutBuyer({ baseUrl: env.apiUrl }, website, { token: params.token });
  } catch {
    // Best-effort — caller must always clear the cookie regardless
  }
}

/**
 * Resolve the website then exchange a refresh token for a new access token.
 * Use this in Astro middleware to silently refresh expired sessions.
 * Throws { status: 401 } if the refresh token is expired — clear cookies and redirect to login.
 */
export async function processRefreshToken(
  env: BuyerServerEnv,
  params: { refreshToken: string }
): Promise<{ access_token: string; refresh_token: string | null }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await refreshBuyerToken({ baseUrl: env.apiUrl }, website, { refreshToken: params.refreshToken });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null };
}

/**
 * Resolve the website then send a password reset email.
 * Never throws — always show a generic confirmation message.
 */
export async function processForgotPassword(
  env: BuyerServerEnv,
  params: { email: string; captchaToken?: string | null }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await forgotPassword({ baseUrl: env.apiUrl }, website, { email: params.email, captchaToken: params.captchaToken });
  } catch {
    // Never expose whether the email exists
  }
}

/**
 * Reset the customer's password with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function processResetPassword(
  env: BuyerServerEnv,
  params: { token: string; newPassword: string }
): Promise<void> {
  await resetPassword({ baseUrl: env.apiUrl }, params);
}

/**
 * Verify the customer's email with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function processVerifyEmail(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  await verifyEmail({ baseUrl: env.apiUrl }, params);
}

/**
 * Resolve the website then add a variant to the cart.
 * Token is optional (guest cart supported).
 */
export async function processAddToCart(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return addToCart({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId, quantity: params.quantity });
}

/**
 * Resolve the website then remove a variant from the cart.
 * Token is optional (guest cart supported).
 */
export async function processRemoveCartItem(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return removeCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId });
}

/**
 * Resolve the website then update the quantity of a variant in the cart.
 * Token is optional (guest cart supported).
 */
export async function processUpdateCartItem(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return updateCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId, quantity: params.quantity });
}

/**
 * Resolve the website then fetch the current cart.
 * Token is optional (guest cart supported).
 */
export async function processGetCart(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return fetchCart({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId });
}

/**
 * Resolve the website then call POST /checkout.
 * Returns { orderId } on success, throws on failure.
 */
export async function processBuyerCheckout(
  env: BuyerServerEnv,
  params: { token: string; checkout: CheckoutRequest }
): Promise<{ orderId: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const order = await createOrder({ baseUrl: env.apiUrl }, website, { token: params.token, checkout: params.checkout });
  return { orderId: order.id };
}

/** Resolve website then set the customer's default address. */
export async function processSetDefaultAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return setDefaultAddress({ baseUrl: env.apiUrl }, website, params);
}

/** Resolve website then delete a saved address. */
export async function processDeleteAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<void> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return deleteCustomerAddress({ baseUrl: env.apiUrl }, website, params);
}

// ---------------------------------------------------------------------------
// Product Listing (filters, sorting, pagination)
// ---------------------------------------------------------------------------

export interface ProductListingFilters {
  brand?: string | null;
  category?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  in_stock?: boolean | null;
}

export type ProductListingSortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

/** @deprecated Use StorefrontFacetOption from the main listing types */
export type ProductFacet = StorefrontFacetOption;

/** @deprecated Use StorefrontProductListingResponse */
export type ProductListingResult = StorefrontProductListingResponse;

/**
 * Fetch a filtered, sorted, paginated product listing.
 * Extends fetchStorefrontProducts with price range and stock filters.
 */
export async function fetchProductListing(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: {
    filters?: ProductListingFilters;
    sort?: ProductListingSortOption;
    page?: number;
    page_size?: number;
  } = {}
): Promise<StorefrontProductListingResponse> {
  const url = new URL("/api/v1/storefront/products", config.baseUrl);
  if (params.filters?.brand) url.searchParams.set("brand", params.filters.brand);
  if (params.filters?.category) url.searchParams.set("category", params.filters.category);
  if (params.filters?.price_min != null) url.searchParams.set("price_min", String(params.filters.price_min));
  if (params.filters?.price_max != null) url.searchParams.set("price_max", String(params.filters.price_max));
  if (params.filters?.in_stock) url.searchParams.set("in_stock", "true");
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.page_size) url.searchParams.set("page_size", String(params.page_size));

  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, website.locale, website.currency),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Guest Checkout
// ---------------------------------------------------------------------------

export interface GuestOrderPayload {
  session_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  shipping_address?: string | null;
  notes?: string | null;
}

export interface GuestOrderResult {
  orderId: string;
}

export class GuestOrderError extends Error {
  constructor(
    public readonly code: "CART_NOT_FOUND" | "OUT_OF_STOCK" | "SERVER_ERROR",
    message: string
  ) {
    super(message);
    this.name = "GuestOrderError";
  }
}

/**
 * Create an order without buyer authentication.
 * The cart is identified by `session_id` (from the storefront session cookie).
 * Throws `GuestOrderError` for typed error cases.
 */
export async function initiateGuestOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  payload: GuestOrderPayload
): Promise<GuestOrderResult> {
  const { session_id, ...checkout } = payload;
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Business-ID": website.business_id,
      "X-Session-ID": session_id,
    },
    body: JSON.stringify(checkout),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail ?? "";
    if (detail === "Cart is empty" || detail === "Cart not found") {
      throw new GuestOrderError("CART_NOT_FOUND", detail);
    }
    if (typeof detail === "object" && detail?.code === "OUT_OF_STOCK") {
      throw new GuestOrderError("OUT_OF_STOCK", "Some items are out of stock");
    }
    throw new GuestOrderError("SERVER_ERROR", String(detail || res.status));
  }

  const order = await res.json();
  return { orderId: order.id };
}

/**
 * Resolve website then call initiateGuestOrder.
 * Server-side helper for Astro API routes.
 */
export async function processGuestCheckout(
  env: BuyerServerEnv,
  payload: GuestOrderPayload
): Promise<GuestOrderResult> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return initiateGuestOrder({ baseUrl: env.apiUrl }, website, payload);
}

// ---------------------------------------------------------------------------
// Campaign & countdown utilities
// ---------------------------------------------------------------------------

/**
 * Schedule metadata present in `attributes_meta[attrName]` for datetime-type
 * attributes. The API resolves the countdown target and includes it here so
 * storefronts don't need to recalculate it from raw SC config.
 */
export interface CampaignScheduleMeta {
  /** ISO UTC datetime — null if not configured. */
  countdown_target_at: string | null;
  /** Which field the target was sourced from. */
  countdown_target_source:
    | "section_attribute"
    | "config.display.countdown_target_at"
    | "active_until"
    | null;
}

/**
 * Full shape of a resolved Smart Collection as returned in section
 * `attributes_meta` or `resolved_data` by the composition API.
 */
export interface ResolvedSmartCollectionInfo {
  collection: {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
    active_from: string | null;
    active_until: string | null;
    config: { display?: { countdown_target_at?: string | null } };
    website_id?: string | null;
    cache_ttl?: number;
    contract_type?: string | null;
  };
  schedule: {
    data_window: { from: string | null; until: string | null };
    countdown_target_at: string | null;
    countdown_target_source: string | null;
  };
  meta: {
    inactive: boolean;
    inactive_reason: "disabled" | "before_start" | "after_end" | null;
  };
}

/** Remaining-time snapshot for a countdown. */
export interface CampaignCountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when targetAt is null or already in the past. */
  expired: boolean;
  targetAt: string | null;
}

/**
 * Returns a single countdown snapshot for the given ISO UTC target.
 * Safe to call server-side — no timers.
 */
export function getCampaignCountdown(targetAt: string | null): CampaignCountdownState {
  if (!targetAt) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, targetAt };
  }
  const diffMs = new Date(targetAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, targetAt };
  }
  const s = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
    targetAt,
  };
}

/**
 * Creates a client-side ticker that calls `onTick` every second until expiry.
 * Fires immediately on creation. Returns a cleanup function that cancels the
 * interval — call it in cleanup / on component unmount.
 *
 * ```ts
 * const stop = createCampaignTicker(targetAt, (state) => {
 *   renderCountdown(state);
 *   if (state.expired) stop();
 * });
 * ```
 */
export function createCampaignTicker(
  targetAt: string,
  onTick: (state: CampaignCountdownState) => void,
): () => void {
  const tick = () => {
    const state = getCampaignCountdown(targetAt);
    onTick(state);
    if (state.expired) clearInterval(handle);
  };
  tick();
  const handle = setInterval(tick, 1000);
  return () => clearInterval(handle);
}

/**
 * Extracts the countdown target from `attributes_meta` for a `datetime`-type
 * attribute. Returns null if the attribute has no schedule metadata.
 *
 * ```ts
 * // In section frontmatter:
 * const targetAt = resolveCampaignTarget(props.attributesMeta, "campaign_end_date");
 * ```
 */
export function resolveCampaignTarget(
  attributesMeta: Record<string, any> | null | undefined,
  attrName: string,
): string | null {
  const schedule = attributesMeta?.[attrName]?.schedule as CampaignScheduleMeta | null | undefined;
  return schedule?.countdown_target_at ?? null;
}

/**
 * Extracts the countdown target from a resolved Smart Collection's `schedule`
 * block. Returns null if the SC is missing or has no countdown target.
 *
 * ```ts
 * // sc comes from section.attributes.products_sc or similar:
 * const targetAt = resolveSmartCollectionTarget(sc);
 * ```
 */
export function resolveSmartCollectionTarget(
  sc: ResolvedSmartCollectionInfo | Record<string, any> | null | undefined,
): string | null {
  return (sc as ResolvedSmartCollectionInfo)?.schedule?.countdown_target_at ?? null;
}

// ---------------------------------------------------------------------------
// Storefront Analytics
// ---------------------------------------------------------------------------

export type StorefrontEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'order_completed'
  | 'search';

export interface StorefrontEventPayload {
  product_slug?: string;
  product_id?: string;
  product_name?: string;
  variant_id?: number;
  quantity?: number;
  price?: number;
  order_id?: string;
  order_total?: number;
  query?: string;
  results_count?: number;
  [key: string]: unknown;
}

export interface StorefrontAnalyticsConfig {
  apiUrl: string;
  websiteId: string;
  businessId: string;
  locale?: string;
  flushInterval?: number;
  debug?: boolean;
}

interface QueuedEvent {
  event_type: StorefrontEventType;
  occurred_at: string;
  website_id: string;
  path: string;
  referrer?: string;
  locale?: string;
  payload: StorefrontEventPayload;
}

class ProximaAnalytics {
  private config: StorefrontAnalyticsConfig | null = null;
  private queue: QueuedEvent[] = [];
  private preInitQueue: Array<[StorefrontEventType, StorefrontEventPayload]> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  init(config: StorefrontAnalyticsConfig): void {
    if (typeof window === 'undefined') return;
    this.config = config;
    if (this.initialized) return;
    this.initialized = true;

    for (const [type, payload] of this.preInitQueue.splice(0)) {
      this.track(type, payload);
    }

    const firePageView = () => this.track('page_view');
    firePageView();
    document.addEventListener('astro:page-load', firePageView);

    const interval = config.flushInterval ?? 3000;
    this.timer = setInterval(() => this.flush(), interval);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
  }

  track(type: StorefrontEventType, payload: StorefrontEventPayload = {}): void {
    if (typeof window === 'undefined') return;
    if (!this.config) {
      this.preInitQueue.push([type, payload]);
      return;
    }
    const event: QueuedEvent = {
      event_type: type,
      occurred_at: new Date().toISOString(),
      website_id: this.config.websiteId,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      locale: this.config.locale,
      payload,
    };
    this.queue.push(event);
    if (this.config.debug) console.debug('[proxima:analytics] queued', event);
  }

  flush(beacon = false): void {
    if (!this.config || this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const url = `${this.config.apiUrl}/api/v1/store/events`;
    const body = JSON.stringify({ events: batch });
    const headers = { 'Content-Type': 'application/json', 'X-Business-ID': this.config.businessId };

    if (this.config.debug) console.debug(`[proxima:analytics] flushing ${batch.length} event(s)`);

    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (!sent) this.queue.unshift(...batch);
      return;
    }

    fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
  }

  destroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.initialized = false;
    this.config = null;
    this.queue = [];
    this.preInitQueue = [];
  }
}

/** Singleton analytics client. Call `analytics.init()` once from SiteLayout. */
export const analytics = new ProximaAnalytics();

export {
  createFixtureBundle,
  createStorefrontDataSource,
  validateFixtureBundle,
  resolveStorefrontDataSourceForRequest,
  FixtureGuestOrderError,
} from "./fixtures-commerce.js";

export type {
  FixtureBundle,
  FixtureBundleInput,
  FixtureBrandListingParams,
  FixtureCartMutationParams,
  FixtureCatalogItem,
  FixtureListingParams,
  FixtureProductListingParams,
  FixtureSearchParams,
  ResolveStorefrontDataSourceOptions,
  StorefrontCartParams,
  StorefrontDataMode,
  StorefrontDataSource,
  StorefrontDataSourceConfig,
  ValidateFixtureBundleOptions,
} from "./fixtures-commerce.js";

// ---------------------------------------------------------------------------
// In-process SWR cache — compositions + website config
// ---------------------------------------------------------------------------
// One set of singletons per Node.js process = one per storefront (single-tenant).
// The Proxima API calls POST /api/cache/invalidate on every Builder save to flush
// the relevant entries; TTL ensures eventual freshness if the webhook is missed.
//
// Usage in resolver.ts:
//   import { compositionCache, websiteCache, invalidateByScope } from "@proxima-io/storefront-core";
//
// Usage in src/pages/api/cache/invalidate.ts:
//   import { handleCacheInvalidateWebhook } from "@proxima-io/storefront-core";
//   export const POST: APIRoute = ({ request }) =>
//     handleCacheInvalidateWebhook(request, import.meta.env.PROXIMA_WEBHOOK_SECRET);
// ---------------------------------------------------------------------------

interface _CacheEntry<T> { data: T; expiresAt: number }

class _TtlCache<T> {
  private readonly store = new Map<string, _CacheEntry<T>>();
  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

/** In-process cache for website config (shell, theme, capabilities). TTL: 5 min. */
export const websiteCache = new _TtlCache<ProximaWebsiteResponse>(5 * 60_000);

/** In-process cache for CMS compositions (page sections). TTL: 60 s. */
export const compositionCache = new _TtlCache<ProximaCompositionResponse>(60_000);

/**
 * Flush cache entries by scope — mirrors the payload sent by `StorefrontWebhookNotifier`:
 *   "composition" + path  → flush that page's composition
 *   "website"             → flush website config + all compositions (they depend on it)
 *   "all"                 → flush everything
 */
export function invalidateByScope(scope: string, path?: string): void {
  if (scope === "composition" && path) {
    compositionCache.delete(path);
  } else if (scope === "website") {
    websiteCache.clear();
    compositionCache.clear();
  } else {
    websiteCache.clear();
    compositionCache.clear();
  }
}

/**
 * Handle the POST /api/cache/invalidate webhook from the Proxima API.
 * Drop this into your Astro route:
 *
 *   export const POST: APIRoute = ({ request }) =>
 *     handleCacheInvalidateWebhook(request, import.meta.env.PROXIMA_WEBHOOK_SECRET);
 */
export async function handleCacheInvalidateWebhook(
  request: Request,
  secret?: string,
): Promise<Response> {
  if (secret) {
    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: { scope?: string; path?: string } = {};
  try { body = await request.json(); } catch { /* empty body → treat as "all" */ }

  invalidateByScope(body.scope ?? "all", body.path);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
