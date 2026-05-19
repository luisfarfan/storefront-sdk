import type { CmsTenantIds } from './resolve-cms-tenant.js';

export type StorefrontApiClientOptions = {
  baseUrl: string;
  getDefaultCurrency: () => string;
  buildLanguageHeader: (locale?: string | null) => string;
};

/**
 * Per-request storefront API client (CMS composition + catalog endpoints)
 * scoped to a resolved tenant (website + business).
 */
export function createStorefrontApiClient(
  tenant: CmsTenantIds,
  opts: StorefrontApiClientOptions,
) {
  const { baseUrl, getDefaultCurrency, buildLanguageHeader } = opts;
  const root = baseUrl.replace(/\/$/, '');

  async function fetchApi<T = unknown>(
    endpoint: string,
    options: RequestInit & { locale?: string; currency?: string } = {},
  ): Promise<T> {
    const url = `${root}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const locale = options.locale || 'es';
    const currency = options.currency || getDefaultCurrency();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Business-ID': tenant.businessId || '',
      'Accept-Language': buildLanguageHeader(locale),
      'X-Currency': currency,
      ...(options.headers as Record<string, string> | undefined),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        detail?: string;
      };
      throw new Error(
        errorData.detail || `API Error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  const { websiteId, businessId } = tenant;

  function getCmsPage(path: string, locale = 'es') {
    const lang = locale || 'es';
    return fetchApi(
      `/storefront/cms/websites/${websiteId}/pages/composition?path=${encodeURIComponent(path)}&locale=${lang}&business_id=${businessId}`,
    );
  }

  return {
    fetchApi,
    getHomePage(locale = 'es') {
      const lang = locale || 'es';
      return fetchApi(
        `/storefront/cms/websites/${websiteId}/pages/composition?path=/&locale=${lang}&business_id=${businessId}`,
      );
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
      const params = new URLSearchParams({
        locale: lang,
        page: String(listing.page || 1),
        page_size: String(listing.pageSize || 24),
        sort: listing.sort || 'newest',
      });
      if (listing.brand) params.set('brand', listing.brand);
      if (listing.q) params.set('q', listing.q);
      return fetchApi(`/storefront/categories/${slug}/products?${params.toString()}`);
    },
    getBrandPage(slug: string, locale = 'es') {
      return this.getCmsPage(`/marca/${slug}`, locale);
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
      const params = new URLSearchParams({
        locale: lang,
        page: String(listing.page || 1),
        page_size: String(listing.pageSize || 24),
        sort: listing.sort || 'newest',
      });
      if (listing.category) params.set('category', listing.category);
      if (listing.q) params.set('q', listing.q);
      return fetchApi(`/storefront/brands/${slug}/products?${params.toString()}`);
    },
    getBrandsPage(locale = 'es') {
      return getCmsPage('/marcas', locale);
    },
    getBrandsDirectory(locale = 'es') {
      const lang = locale || 'es';
      return fetchApi(`/storefront/brands?locale=${lang}`);
    },
    getCategoriesPage(locale = 'es') {
      return getCmsPage('/categorias', locale);
    },
    getCategoriesDirectory(locale = 'es') {
      const lang = locale || 'es';
      return fetchApi(`/storefront/categories?locale=${lang}`);
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
      const params = new URLSearchParams({
        locale: lang,
        page: String(listing.page || 1),
        page_size: String(listing.pageSize || 24),
        sort: listing.sort || 'newest',
      });
      if (listing.brand) params.set('brand', listing.brand);
      if (listing.category) params.set('category', listing.category);
      if (listing.q) params.set('q', listing.q);
      return fetchApi(`/storefront/products?${params.toString()}`);
    },
    searchProducts(query: string, locale = 'es') {
      const lang = locale || 'es';
      return fetchApi(
        `/storefront/search?q=${encodeURIComponent(query)}&locale=${lang}`,
      );
    },
  };
}

export type StorefrontApiClient = ReturnType<typeof createStorefrontApiClient>;
