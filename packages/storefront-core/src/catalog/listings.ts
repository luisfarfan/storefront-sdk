import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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

function storefrontContext(
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: { locale?: string; currency?: string } = {},
) {
  return {
    businessId: website.business_id,
    locale: params.locale ?? website.locale,
    currency: params.currency ?? website.currency,
  };
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontSearchResponse>(StorefrontEndpoints.catalog.search(), {
    ...storefrontContext(website, params),
    query: { q: params.q, limit: params.limit },
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontProductListingResponse>(StorefrontEndpoints.catalog.products(), {
    ...storefrontContext(website, params),
    query: {
      page: params.page,
      page_size: params.pageSize,
      sort: params.sort,
      brand: params.brand,
      category: params.category,
      q: params.q,
    },
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontCategoryListingResponse>(
    StorefrontEndpoints.catalog.categoryProducts(params.slug),
    {
      ...storefrontContext(website, params),
      query: {
        page: params.page,
        page_size: params.pageSize,
        sort: params.sort,
        brand: params.brand,
        q: params.q,
      },
    },
  );
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontBrandListingResponse>(
    StorefrontEndpoints.catalog.brandProducts(params.slug),
    {
      ...storefrontContext(website, params),
      query: {
        page: params.page,
        page_size: params.pageSize,
        sort: params.sort,
        category: params.category,
        q: params.q,
      },
    },
  );
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontCategoryDirectoryResponse>(StorefrontEndpoints.catalog.categories(), {
    businessId: website.business_id,
    locale: params.locale ?? website.locale,
  });
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
  const client = createStorefrontClient(config);
  return client.get<CategoryNavTreeResponse>(StorefrontEndpoints.catalog.categoryTree(), {
    businessId: website.business_id,
    locale: params.locale ?? website.locale,
    query: { max_depth: params.maxDepth },
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontBrandDirectoryResponse>(StorefrontEndpoints.catalog.brands(), {
    businessId: website.business_id,
    locale: params.locale ?? website.locale,
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontProductListingResponse>(StorefrontEndpoints.catalog.products(), {
    businessId: website.business_id,
    locale: website.locale,
    currency: website.currency,
    query: {
      brand: params.filters?.brand,
      category: params.filters?.category,
      price_min: params.filters?.price_min,
      price_max: params.filters?.price_max,
      in_stock: params.filters?.in_stock ? 'true' : undefined,
      sort: params.sort,
      page: params.page,
      page_size: params.page_size,
    },
  });
}
