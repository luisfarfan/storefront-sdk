import type { SitemapWebsiteMeta } from '../types/seo.js';
import { buildCanonicalUrl } from './hreflang.js';
import {
  fillPathTemplate,
  findWebsitePageByResolver,
  slugFromCatalogHref,
} from './engine-url.js';
import {
  fetchBrandsDirectory,
  fetchCategoryNavTree,
  fetchStorefrontProducts,
} from '../catalog/listings.js';

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
  const defaultLocale = website.default_locale ?? "es";
  const enabledLocales = website.enabled_locales?.length
    ? website.enabled_locales
    : [defaultLocale];
  const entries: string[] = [];

  function localizedTemplatesFor(
    resolverKind: string,
    fallbackTemplate: string,
  ): Array<{ locale: string; template: string }> {
    const page = findWebsitePageByResolver(website.pages, resolverKind);
    const localizedPaths = page?.localized_paths ?? {};
    const hasLocalized = Object.keys(localizedPaths).length > 0;

    if (!hasLocalized) {
      return [{ locale: defaultLocale, template: page?.path ?? fallbackTemplate }];
    }

    return enabledLocales
      .map((locale) => ({
        locale,
        template: localizedPaths[locale] ?? localizedPaths[defaultLocale] ?? page?.path ?? fallbackTemplate,
      }))
      .filter((item) => Boolean(item.template));
  }

  function pushEngineUrls(
    resolverKind: string,
    fallbackTemplate: string,
    slug: string,
    priority: string,
    changefreq: string,
  ) {
    for (const { locale, template } of localizedTemplatesFor(resolverKind, fallbackTemplate)) {
      const logicalPath = template.includes('{')
        ? fillPathTemplate(template, { slug })
        : template;
      const loc = buildCanonicalUrl(website.domain, locale, logicalPath, defaultLocale);
      entries.push(_urlEntry(loc, priority, changefreq, TODAY));
    }
  }

  // 1. Content pages from the website manifest
  for (const page of website.pages ?? []) {
    if (SITEMAP_PRIVATE_KINDS.has(page.resolver_kind)) continue;
    if (page.resolver_kind !== "content_page") continue;

    const localizedPaths = page.localized_paths ?? {};
    const localesToEmit = Object.keys(localizedPaths).length > 0
      ? enabledLocales.filter((locale) => localizedPaths[locale] || page.path)
      : [defaultLocale];

    for (const locale of localesToEmit) {
      const path = localizedPaths[locale] ?? page.path;
      if (!path) continue;
      const priority = path === "/" ? "1.0" : "0.8";
      const changefreq = path === "/" ? "daily" : "weekly";
      const loc = buildCanonicalUrl(website.domain, locale, path, defaultLocale);
      entries.push(_urlEntry(loc, priority, changefreq, TODAY));
    }
  }

  // 2. Category pages (recursive nav tree)
  try {
    const tree = await fetchCategoryNavTree({ baseUrl: apiUrl }, website as any);
    function collectHrefs(nodes: typeof tree.nodes) {
      for (const node of nodes) {
        const slug =
          slugFromCatalogHref(node.href, 'categoria') ??
          slugFromCatalogHref(node.href, 'category') ??
          node.href.split('/').filter(Boolean).pop();
        if (slug) {
          pushEngineUrls('category_detail', '/categoria/{slug}', slug, '0.8', 'daily');
        } else {
          entries.push(_urlEntry(`${siteUrl}${node.href}`, '0.8', 'daily', TODAY));
        }
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
      const slug =
        slugFromCatalogHref(brand.href, 'marca') ??
        slugFromCatalogHref(brand.href, 'brand') ??
        brand.slug;
      if (slug) {
        pushEngineUrls('brand_detail', '/marca/{slug}', slug, '0.7', 'weekly');
      } else {
        entries.push(_urlEntry(`${siteUrl}${brand.href}`, '0.7', 'weekly', TODAY));
      }
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
        pushEngineUrls('product_detail', '/producto/{slug}', product.slug, '0.9', 'weekly');
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
