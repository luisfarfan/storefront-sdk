import type { BreadcrumbItem, JsonLdLocalBusinessMeta, JsonLdProductMeta, JsonLdWebsiteMeta } from '../types/seo.js';

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