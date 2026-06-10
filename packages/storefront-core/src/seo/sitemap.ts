import type { SitemapWebsiteMeta } from '../types/seo.js';
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
