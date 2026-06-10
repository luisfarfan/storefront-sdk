import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptAllCookieConsent } from '../src/cookie-consent/consent.js';
import { analytics } from '../src/analytics/analytics.js';
import { clearSessionAttribution } from '../src/analytics/attribution.js';
import { resolveAnalyticsSessionId } from '../src/analytics/session.js';
import { StorefrontEndpoints } from '../src/api/endpoints.js';

const storage = new Map<string, string>();
let fetchMock: ReturnType<typeof vi.fn>;

function mockBrowser(url = 'https://shop.test/catalogo') {
  const ls = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
  vi.stubGlobal('window', {
    location: {
      href: url,
      pathname: new URL(url).pathname,
      search: new URL(url).search,
    },
    localStorage: ls,
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', {
    referrer: 'https://example.com',
    cookie: '',
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('crypto', { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' });
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  storage.clear();
  clearSessionAttribution();
  analytics.destroy();
  vi.unstubAllGlobals();
});

describe('analytics transport', () => {
  it('posts to storefront events path with session header', () => {
    mockBrowser();
    acceptAllCookieConsent();
    analytics.init({
      apiUrl: 'https://api.test',
      websiteId: 'ws-1',
      businessId: 'biz-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    analytics.track('product_view', { product_slug: 'gpu-1' });
    analytics.flush();

    expect(StorefrontEndpoints.analytics.events()).toBe('/api/v1/storefront/events');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/storefront/events');
    expect((init.headers as Record<string, string>)['X-Business-ID']).toBe('biz-1');
    expect((init.headers as Record<string, string>)['X-Session-ID']).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('merges session attribution into event payload', () => {
    mockBrowser('https://shop.test/?utm_source=newsletter&utm_medium=email');
    clearSessionAttribution();
    acceptAllCookieConsent();
    analytics.init({
      apiUrl: 'https://api.test',
      websiteId: 'ws-1',
      businessId: 'biz-1',
    });
    analytics.track('add_to_cart', { product_slug: 'gpu-1' });
    analytics.flush();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      events: Array<{ payload: { attribution?: { utm_source?: string } } }>;
    };
    expect(body.events[0]?.payload?.attribution?.utm_source).toBe('newsletter');
  });

  it('resolveAnalyticsSessionId persists fallback uuid', () => {
    mockBrowser();
    const first = resolveAnalyticsSessionId();
    const second = resolveAnalyticsSessionId();
    expect(first).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(second).toBe(first);
  });
});

describe('analytics consent gate', () => {
  it('does not flush before analytics consent when required', () => {
    mockBrowser();
    analytics.init(
      {
        apiUrl: 'https://api.test',
        websiteId: 'ws-1',
        businessId: 'biz-1',
      },
      { requireAnalyticsConsent: true },
    );
    analytics.track('page_view');
    analytics.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
