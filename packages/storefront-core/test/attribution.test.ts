import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ATTRIBUTION_STORAGE_KEY,
  captureSessionAttribution,
  clearSessionAttribution,
  inferAttributionFromReferrer,
} from '../src/analytics/attribution.js';

const storage = new Map<string, string>();

function mockBrowser(url: string, referrer = '') {
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
    location: { href: url, pathname: new URL(url).pathname, search: new URL(url).search },
    localStorage: ls,
  });
  vi.stubGlobal('document', { referrer });
  vi.stubGlobal('localStorage', ls);
}

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe('session attribution', () => {
  it('captures UTMs and click ids from landing URL', () => {
    mockBrowser(
      'https://shop.test/producto/gpu?utm_source=facebook&utm_medium=cpc&utm_campaign=audio-week&fbclid=abc123',
    );
    clearSessionAttribution();

    const attr = captureSessionAttribution();
    expect(attr.utm_source).toBe('facebook');
    expect(attr.utm_medium).toBe('cpc');
    expect(attr.utm_campaign).toBe('audio-week');
    expect(attr.fbclid).toBe('abc123');
    expect(attr.landing_path).toBe(
      '/producto/gpu?utm_source=facebook&utm_medium=cpc&utm_campaign=audio-week&fbclid=abc123',
    );
  });

  it('persists first-touch across navigations', () => {
    mockBrowser('https://shop.test/?utm_source=google&utm_medium=cpc&gclid=xyz');
    clearSessionAttribution();
    captureSessionAttribution();

    mockBrowser('https://shop.test/checkout');
    const attr = captureSessionAttribution();
    expect(attr.utm_source).toBe('google');
    expect(attr.gclid).toBe('xyz');
    expect(storage.get(ATTRIBUTION_STORAGE_KEY)).toBeTruthy();
  });

  it('infers organic google when no UTMs but referrer is google', () => {
    mockBrowser('https://shop.test/', 'https://www.google.com/');
    clearSessionAttribution();

    const attr = captureSessionAttribution();
    expect(attr.utm_source).toBe('google');
    expect(attr.utm_medium).toBe('organic');
    expect(attr.landing_referrer).toBe('https://www.google.com/');
  });

  it('inferAttributionFromReferrer maps facebook referral', () => {
    expect(inferAttributionFromReferrer('https://l.facebook.com/')).toEqual({
      utm_source: 'facebook',
      utm_medium: 'social',
    });
  });
});
