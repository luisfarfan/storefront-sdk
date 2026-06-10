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