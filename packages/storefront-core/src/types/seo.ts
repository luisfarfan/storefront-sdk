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

export interface SitemapWebsiteMeta {
  domain: string;
  pages?: Array<{
    resolver_kind: string;
    path?: string | null;
  }> | null;
}