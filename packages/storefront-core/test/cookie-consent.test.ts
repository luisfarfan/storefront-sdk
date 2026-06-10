import { afterEach, describe, expect, it, vi } from 'vitest';
import { COOKIE_CONSENT_STORAGE_KEY } from '../src/types/cookie-consent.js';
import {
  acceptAllCookieConsent,
  hasCookieConsentDecision,
  isAnalyticsConsentGranted,
  readCookieConsent,
  rejectNonEssentialCookieConsent,
  writeCookieConsent,
} from '../src/cookie-consent/consent.js';

const storage = new Map<string, string>();

function mockBrowserStorage() {
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
}

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe('cookie consent', () => {
  it('returns null when nothing is stored', () => {
    mockBrowserStorage();
    expect(readCookieConsent()).toBeNull();
    expect(hasCookieConsentDecision()).toBe(false);
  });

  it('persists accept-all preferences', () => {
    mockBrowserStorage();
    const state = acceptAllCookieConsent();
    expect(state.analytics).toBe(true);
    expect(state.marketing).toBe(true);
    expect(state.essential).toBe(true);
    expect(hasCookieConsentDecision()).toBe(true);
    expect(isAnalyticsConsentGranted()).toBe(true);
    expect(readCookieConsent()?.decidedAt).toBeTruthy();
    expect(storage.get(COOKIE_CONSENT_STORAGE_KEY)).toBeTruthy();
  });

  it('persists reject-non-essential preferences', () => {
    mockBrowserStorage();
    const state = rejectNonEssentialCookieConsent();
    expect(state.analytics).toBe(false);
    expect(state.marketing).toBe(false);
    expect(isAnalyticsConsentGranted()).toBe(false);
  });

  it('ignores stale stored versions', () => {
    mockBrowserStorage();
    storage.set(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        essential: true,
        analytics: true,
        marketing: true,
        decidedAt: '2020-01-01T00:00:00.000Z',
      }),
    );
    expect(readCookieConsent()).toBeNull();
  });

  it('writeCookieConsent stores granular choices', () => {
    mockBrowserStorage();
    writeCookieConsent({ analytics: true, marketing: false });
    expect(readCookieConsent()).toMatchObject({ analytics: true, marketing: false });
  });
});
