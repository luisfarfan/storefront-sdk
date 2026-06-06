import {
  StorefrontEndpoints,
  createStorefrontClient,
} from '@proxima-io/storefront-core';
import type { CmsTenantIds } from './resolve-cms-tenant.js';

export type StorefrontApiClientOptions = {
  baseUrl: string;
  getDefaultCurrency: () => string;
  buildLanguageHeader: (locale?: string | null) => string;
};

type FetchApiOptions = RequestInit & {
  locale?: string;
  currency?: string;
};

function normalizeLegacyEndpoint(endpoint: string): {
  path: string;
  query: Record<string, string>;
} {
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let queryString = '';

  const qIndex = path.indexOf('?');
  if (qIndex !== -1) {
    queryString = path.slice(qIndex + 1);
    path = path.slice(0, qIndex);
  }

  if (path.startsWith('/storefront/')) {
    path = `/api/v1${path}`;
  }

  const query: Record<string, string> = {};
  if (queryString) {
    for (const [key, value] of new URLSearchParams(queryString)) {
      query[key] = value;
    }
  }

  return { path, query };
}

function toCmsApiError(error: unknown): Error {
  const err = error as Error & { status?: number; data?: { detail?: string } };
  if (typeof err.status === 'number') {
    const detail = err.data?.detail;
    return new Error(detail || `API Error: ${err.status}`);
  }
  return err instanceof Error ? err : new Error(String(error));
}

function rethrowCmsApiError(error: unknown): never {
  throw toCmsApiError(error);
}

function requestHeaders(
  locale: string,
  buildLanguageHeader: StorefrontApiClientOptions['buildLanguageHeader'],
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept-Language': buildLanguageHeader(locale),
    ...extra,
  };
}

function parseRequestBody(body: RequestInit['body']): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

/**
 * Per-request storefront API client (CMS composition + catalog endpoints)
 * scoped to a resolved tenant (website + business).
 */
export function createStorefrontApiClient(
  tenant: CmsTenantIds,
  opts: StorefrontApiClientOptions,
) {
  const { getDefaultCurrency, buildLanguageHeader } = opts;
  const client = createStorefrontClient({ baseUrl: opts.baseUrl });
  const { websiteId, businessId } = tenant;

  function tenantRequest<T>(
    method: string,
    path: string,
    options: {
      locale?: string;
      currency?: string;
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const locale = options.locale || 'es';
    const currency = options.currency || getDefaultCurrency();

    return client
      .request<T>(method, path, {
        businessId,
        currency,
        query: options.query,
        body: options.body,
        headers: requestHeaders(locale, buildLanguageHeader, options.headers),
      })
      .catch(rethrowCmsApiError);
  }

  async function fetchApi<T = unknown>(
    endpoint: string,
    options: FetchApiOptions = {},
  ): Promise<T> {
    const { path, query } = normalizeLegacyEndpoint(endpoint);
    const method = (options.method || 'GET').toUpperCase();
    const locale = options.locale || 'es';
    const currency = options.currency || getDefaultCurrency();

    const mergedQuery = { ...query };
    for (const [key, value] of Object.entries(mergedQuery)) {
      if (value === undefined || value === null) delete mergedQuery[key];
    }

    return client
      .request<T>(method, path, {
        businessId,
        currency,
        query: Object.keys(mergedQuery).length ? mergedQuery : undefined,
        body: parseRequestBody(options.body),
        headers: requestHeaders(locale, buildLanguageHeader, options.headers as Record<string, string> | undefined),
      })
      .catch(rethrowCmsApiError);
  }

  function getCmsPage(path: string, locale = 'es') {
    const lang = locale || 'es';
    return tenantRequest('GET', StorefrontEndpoints.cms.composition(websiteId), {
      locale: lang,
      query: {
        path,
        locale: lang,
        business_id: businessId,
      },
    });
  }

  return {
    fetchApi,
    getHomePage(locale = 'es') {
      return getCmsPage('/', locale);
    },
    getCmsPage,
    getProduct(slug: string, locale = 'es') {
      return getCmsPage(`/producto/${slug}`, locale);
    },
    getCategoryPage(slug: string, locale = 'es') {
      return getCmsPage(`/categoria/${slug}`, locale);
    },
    getCategoryListing(
      slug: string,
      locale = 'es',
      listing: {
        page?: number;
        pageSize?: number;
        sort?: string;
        brand?: string;
        q?: string;
      } = {},
    ) {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.categoryProducts(slug), {
        locale: lang,
        query: {
          locale: lang,
          page: listing.page || 1,
          page_size: listing.pageSize || 24,
          sort: listing.sort || 'newest',
          brand: listing.brand,
          q: listing.q,
        },
      });
    },
    getBrandPage(slug: string, locale = 'es') {
      return getCmsPage(`/marca/${slug}`, locale);
    },
    getBrandListing(
      slug: string,
      locale = 'es',
      listing: {
        page?: number;
        pageSize?: number;
        sort?: string;
        category?: string;
        q?: string;
      } = {},
    ) {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.brandProducts(slug), {
        locale: lang,
        query: {
          locale: lang,
          page: listing.page || 1,
          page_size: listing.pageSize || 24,
          sort: listing.sort || 'newest',
          category: listing.category,
          q: listing.q,
        },
      });
    },
    getBrandsPage(locale = 'es') {
      return getCmsPage('/marcas', locale);
    },
    getBrandsDirectory(locale = 'es') {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.brands(), {
        locale: lang,
        query: { locale: lang },
      });
    },
    getCategoriesPage(locale = 'es') {
      return getCmsPage('/categorias', locale);
    },
    getCategoriesDirectory(locale = 'es') {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.categories(), {
        locale: lang,
        query: { locale: lang },
      });
    },
    getProductsPage(locale = 'es') {
      return getCmsPage('/productos', locale);
    },
    getProductsListing(
      locale = 'es',
      listing: {
        page?: number;
        pageSize?: number;
        sort?: string;
        brand?: string;
        category?: string;
        q?: string;
      } = {},
    ) {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.products(), {
        locale: lang,
        query: {
          locale: lang,
          page: listing.page || 1,
          page_size: listing.pageSize || 24,
          sort: listing.sort || 'newest',
          brand: listing.brand,
          category: listing.category,
          q: listing.q,
        },
      });
    },
    searchProducts(query: string, locale = 'es') {
      const lang = locale || 'es';
      return tenantRequest('GET', StorefrontEndpoints.catalog.search(), {
        locale: lang,
        query: {
          q: query,
          locale: lang,
        },
      });
    },
  };
}

export type StorefrontApiClient = ReturnType<typeof createStorefrontApiClient>;
