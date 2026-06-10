/**
 * Tests for createStorefrontApiClient — verifies canonical /api/v1/storefront paths.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStorefrontApiClient } from '../src/create-storefront-api-client.js';

const TENANT = { websiteId: 'web-1', businessId: 'biz-1' };
const OPTS = {
  baseUrl: 'http://api.test',
  getDefaultCurrency: () => 'PEN',
  buildLanguageHeader: (locale?: string | null) => locale || 'es',
};

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return {
      ok,
      status,
      url,
      json: async () => body,
    };
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('createStorefrontApiClient', () => {
  it('getHomePage calls canonical composition endpoint', async () => {
    mockFetch({ sections: [] });
    const api = createStorefrontApiClient(TENANT, OPTS);
    await api.getHomePage('es');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/v1/storefront/cms/websites/web-1/pages/composition');
    expect(url).toContain('path=%2F');
    expect(url).toContain('business_id=biz-1');
  });

  it('searchProducts calls canonical search endpoint', async () => {
    mockFetch({ hits: [], total: 0 });
    const api = createStorefrontApiClient(TENANT, OPTS);
    await api.searchProducts('zapatillas', 'es');

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain('/api/v1/storefront/search');
    expect(url).toContain('q=zapatillas');
  });

  it('fetchApi normalizes legacy /storefront paths', async () => {
    mockFetch({ items: [] });
    const api = createStorefrontApiClient(TENANT, OPTS);
    await api.fetchApi('/storefront/brands?locale=es');

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain('/api/v1/storefront/brands');
    expect(url).toContain('locale=es');
  });

  it('throws CMS-style error with API detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Invalid slug' }),
    }));

    const api = createStorefrontApiClient(TENANT, OPTS);
    await expect(api.getBrandsDirectory()).rejects.toThrow('Invalid slug');
  });
});
