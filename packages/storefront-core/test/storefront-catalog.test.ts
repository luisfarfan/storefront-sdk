/**
 * Tests for storefront catalog & cart functions:
 * searchStorefront, fetchStorefrontProducts, fetchCategoryProducts,
 * fetchBrandProducts, fetchCategoriesDirectory, fetchBrandsDirectory,
 * mergeGuestCart, validateCoupon
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchStorefront,
  fetchStorefrontProducts,
  fetchCategoryProducts,
  fetchBrandProducts,
  fetchCategoriesDirectory,
  fetchBrandsDirectory,
  mergeGuestCart,
  validateCoupon,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONFIG = { baseUrl: 'http://api.test' };
const WEBSITE = { business_id: 'biz-123', locale: 'es', currency: 'PEN', name: 'Test', domain: 'test.localhost', delivery_mode: 'custom', website_kind: 'ecommerce', theme_tokens: {}, animation_config: {}, pages: [], capabilities: {} } as any;
const WEBSITE_SLIM = { business_id: 'biz-123', locale: 'es', currency: 'PEN' };

const PRODUCT: any = {
  id: 1, name: 'Zapatilla X', slug: 'zapatilla-x',
  price: 150, price_formatted: 'S/ 150.00', image_url: 'https://cdn.test/img.jpg',
  rating: 4.5, default_variant_id: 42,
};

const PAGINATION = { page: 1, page_size: 24, total: 1, total_pages: 1 };

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? status : status,
    json: async () => body,
  }));
}

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// searchStorefront
// ---------------------------------------------------------------------------

describe('searchStorefront', () => {
  it('returns hits and total', async () => {
    mockFetch({ query: 'zapatilla', hits: [PRODUCT], total: 1 });
    const result = await searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'zapatilla' });
    expect(result.query).toBe('zapatilla');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].slug).toBe('zapatilla-x');
    expect(result.total).toBe(1);
  });

  it('sends q and limit as query params', async () => {
    mockFetch({ query: 'ropa', hits: [], total: 0 });
    await searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'ropa', limit: 5 });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('q=ropa');
    expect(String(url)).toContain('limit=5');
  });

  it('sends X-Business-ID and Accept-Language headers', async () => {
    mockFetch({ query: 'x', hits: [], total: 0 });
    await searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'x', locale: 'en' });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['X-Business-ID']).toBe('biz-123');
    expect(init.headers['Accept-Language']).toBe('en');
  });

  it('uses website locale/currency as defaults', async () => {
    mockFetch({ query: 'x', hits: [], total: 0 });
    await searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'x' });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Accept-Language']).toBe('es');
    expect(init.headers['X-Currency']).toBe('PEN');
  });

  it('throws on API error', async () => {
    mockFetch({ detail: 'Too many requests' }, false, 429);
    await expect(searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'x' })).rejects.toMatchObject({ status: 429 });
  });

  it('returns empty hits when no results', async () => {
    mockFetch({ query: 'xyz123', hits: [], total: 0 });
    const result = await searchStorefront(CONFIG, WEBSITE_SLIM as any, { q: 'xyz123' });
    expect(result.hits).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchStorefrontProducts
// ---------------------------------------------------------------------------

describe('fetchStorefrontProducts', () => {
  const LISTING = {
    items: [PRODUCT],
    pagination: PAGINATION,
    sort_current: 'newest',
    sort_options: [{ value: 'newest', label: 'Más reciente' }],
    brand_facets: [],
    category_facets: [],
  };

  it('returns listing response', async () => {
    mockFetch(LISTING);
    const result = await fetchStorefrontProducts(CONFIG, WEBSITE_SLIM as any);
    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.sort_current).toBe('newest');
  });

  it('sends pagination and filter params', async () => {
    mockFetch(LISTING);
    await fetchStorefrontProducts(CONFIG, WEBSITE_SLIM as any, {
      page: 2, pageSize: 12, sort: 'price_asc',
      brand: 'nike', category: 'zapatillas', q: 'running',
    });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const s = String(url);
    expect(s).toContain('page=2');
    expect(s).toContain('page_size=12');
    expect(s).toContain('sort=price_asc');
    expect(s).toContain('brand=nike');
    expect(s).toContain('category=zapatillas');
    expect(s).toContain('q=running');
  });

  it('calls /storefront/products (not the deprecated /products)', async () => {
    mockFetch(LISTING);
    await fetchStorefrontProducts(CONFIG, WEBSITE_SLIM as any);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/storefront/products');
    expect(String(url)).not.toMatch(/\/api\/v1\/products(?!\/)/);
  });
});

// ---------------------------------------------------------------------------
// fetchCategoryProducts
// ---------------------------------------------------------------------------

describe('fetchCategoryProducts', () => {
  const CATEGORY_LISTING = {
    category: { id: 5, name: 'Zapatillas', slug: 'zapatillas', image_url: null },
    items: [PRODUCT],
    pagination: PAGINATION,
    sort_current: 'newest',
    sort_options: [],
    brand_facets: [{ value: 'nike', label: 'Nike', count: 3 }],
  };

  it('returns category listing with facets', async () => {
    mockFetch(CATEGORY_LISTING);
    const result = await fetchCategoryProducts(CONFIG, WEBSITE_SLIM as any, { slug: 'zapatillas' });
    expect(result.category.slug).toBe('zapatillas');
    expect(result.items).toHaveLength(1);
    expect(result.brand_facets[0].value).toBe('nike');
  });

  it('encodes slug in URL path', async () => {
    mockFetch(CATEGORY_LISTING);
    await fetchCategoryProducts(CONFIG, WEBSITE_SLIM as any, { slug: 'zapatillas deportivas' });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('zapatillas%20deportivas');
  });

  it('sends filter params', async () => {
    mockFetch(CATEGORY_LISTING);
    await fetchCategoryProducts(CONFIG, WEBSITE_SLIM as any, {
      slug: 'zapatillas', page: 2, sort: 'price_asc', brand: 'adidas',
    });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('sort=price_asc');
    expect(String(url)).toContain('brand=adidas');
  });

  it('throws 404 when category not found', async () => {
    mockFetch({ detail: 'Category not found' }, false, 404);
    await expect(
      fetchCategoryProducts(CONFIG, WEBSITE_SLIM as any, { slug: 'ghost' })
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// fetchBrandProducts
// ---------------------------------------------------------------------------

describe('fetchBrandProducts', () => {
  const BRAND_LISTING = {
    brand: { id: 3, name: 'Nike', slug: 'nike', logo_url: null },
    items: [PRODUCT],
    pagination: PAGINATION,
    sort_current: 'newest',
    sort_options: [],
    category_facets: [{ value: 'zapatillas', label: 'Zapatillas', count: 5 }],
  };

  it('returns brand listing with category facets', async () => {
    mockFetch(BRAND_LISTING);
    const result = await fetchBrandProducts(CONFIG, WEBSITE_SLIM as any, { slug: 'nike' });
    expect(result.brand.slug).toBe('nike');
    expect(result.category_facets[0].value).toBe('zapatillas');
  });

  it('sends category filter', async () => {
    mockFetch(BRAND_LISTING);
    await fetchBrandProducts(CONFIG, WEBSITE_SLIM as any, { slug: 'nike', category: 'zapatillas' });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('category=zapatillas');
    expect(String(url)).toContain('/storefront/brands/nike/products');
  });
});

// ---------------------------------------------------------------------------
// fetchCategoriesDirectory
// ---------------------------------------------------------------------------

describe('fetchCategoriesDirectory', () => {
  it('returns categories with product counts', async () => {
    const directory = {
      items: [
        { id: 1, name: 'Zapatillas', slug: 'zapatillas', href: '/categoria/zapatillas', product_count: 42 },
        { id: 2, name: 'Ropa', slug: 'ropa', href: '/categoria/ropa', product_count: 18 },
      ],
      total: 2,
    };
    mockFetch(directory);
    const result = await fetchCategoriesDirectory(CONFIG, WEBSITE_SLIM as any);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].product_count).toBe(42);
  });

  it('calls /storefront/categories', async () => {
    mockFetch({ items: [], total: 0 });
    await fetchCategoriesDirectory(CONFIG, WEBSITE_SLIM as any);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/storefront/categories');
  });
});

// ---------------------------------------------------------------------------
// fetchBrandsDirectory
// ---------------------------------------------------------------------------

describe('fetchBrandsDirectory', () => {
  it('returns brands with product counts', async () => {
    const directory = {
      items: [
        { id: 1, name: 'Nike', slug: 'nike', href: '/marca/nike', product_count: 30, logo_url: null },
      ],
      total: 1,
    };
    mockFetch(directory);
    const result = await fetchBrandsDirectory(CONFIG, WEBSITE_SLIM as any);
    expect(result.items[0].slug).toBe('nike');
    expect(result.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// mergeGuestCart
// ---------------------------------------------------------------------------

describe('mergeGuestCart', () => {
  const CART = {
    id: 'cart-abc', session_id: null, customer_id: 42,
    items: [{ id: 1, product_variant_id: 7, quantity: 2, metadata: null }],
    totals: { subtotal: 300, formatted_subtotal: 'S/ 300.00', currency: 'PEN' },
  };

  it('returns the merged cart', async () => {
    mockFetch(CART);
    const result = await mergeGuestCart(CONFIG, WEBSITE, { token: 'tok-abc', sessionId: 'sess-xyz' });
    expect(result.id).toBe('cart-abc');
    expect(result.items).toHaveLength(1);
  });

  it('sends X-Session-ID and Authorization headers', async () => {
    mockFetch(CART);
    await mergeGuestCart(CONFIG, WEBSITE, { token: 'tok-abc', sessionId: 'sess-xyz' });
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/cart/merge');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Session-ID']).toBe('sess-xyz');
    expect(init.headers['Authorization']).toBe('Bearer tok-abc');
  });

  it('throws on error (e.g. 401 unauthenticated)', async () => {
    mockFetch({ detail: 'Unauthorized' }, false, 401);
    await expect(mergeGuestCart(CONFIG, WEBSITE, { token: 'bad', sessionId: 'sess' }))
      .rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// validateCoupon
// ---------------------------------------------------------------------------

describe('validateCoupon', () => {
  it('returns valid result with discount info', async () => {
    mockFetch({ valid: true, code: 'PROMO10', discount_amount: 15, discount_type: 'percentage', discount_value: 10 });
    const result = await validateCoupon(CONFIG, WEBSITE_SLIM as any, { code: 'PROMO10', amount: 150 });
    expect(result.valid).toBe(true);
    expect(result.discount_amount).toBe(15);
    expect(result.discount_type).toBe('percentage');
  });

  it('returns invalid result with error message', async () => {
    mockFetch({ valid: false, error: 'Coupon expired' });
    const result = await validateCoupon(CONFIG, WEBSITE_SLIM as any, { code: 'OLD50', amount: 100 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Coupon expired');
  });

  it('sends code and amount as query params', async () => {
    mockFetch({ valid: true, code: 'X', discount_amount: 10, discount_type: 'fixed', discount_value: 10 });
    await validateCoupon(CONFIG, WEBSITE_SLIM as any, { code: 'SAVE10', amount: 200.50 });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('code=SAVE10');
    expect(String(url)).toContain('amount=200.5');
    expect(String(url)).toContain('/commerce/coupons/validate');
  });
});
