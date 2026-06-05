import { apiError, storefrontHeaders } from '../internal/http.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type {
  CategoryNavTreeResponse,
  StorefrontBrandDirectoryResponse,
  StorefrontBrandListingResponse,
  StorefrontCategoryDirectoryResponse,
  StorefrontCategoryListingResponse,
  StorefrontListingParams,
  StorefrontProductListingResponse,
  StorefrontSearchResponse,
} from '../types/catalog.js';
import type { ProductListingFilters, ProductListingSortOption } from '../types/listing.js';

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