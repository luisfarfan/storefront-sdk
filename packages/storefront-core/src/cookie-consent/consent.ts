import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  type CookieConsentState,
} from '../types/cookie-consent.js';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function parseStoredConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.essential !== true) return null;
    if (typeof parsed.analytics !== 'boolean') return null;
    if (typeof parsed.marketing !== 'boolean') return null;
    if (typeof parsed.decidedAt !== 'string' || !parsed.decidedAt) return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return null;
  }
}

/** Read persisted consent, or `null` if none / stale version. */
export function readCookieConsent(): CookieConsentState | null {
  if (!isBrowser()) return null;
  return parseStoredConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

/** Whether the shopper already accepted or rejected non-essential cookies. */
export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() !== null;
}

/** Whether analytics events may be sent (requires explicit accept). */
export function isAnalyticsConsentGranted(state: CookieConsentState | null = readCookieConsent()): boolean {
  return state?.analytics === true;
}

export function isMarketingConsentGranted(state: CookieConsentState | null = readCookieConsent()): boolean {
  return state?.marketing === true;
}

function buildState(analytics: boolean, marketing: boolean): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics,
    marketing,
    decidedAt: new Date().toISOString(),
  };
}

/** Persist consent and notify listeners (analytics gating, third-party tags). */
/** Persist consent and dispatch `COOKIE_CONSENT_CHANGED_EVENT` (analytics client listens). */
export function writeCookieConsent(categories: { analytics: boolean; marketing: boolean }): CookieConsentState {
  const state = buildState(categories.analytics, categories.marketing);
  if (isBrowser()) {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
    dispatchCookieConsentChanged(state);
  }
  return state;
}

/** Accept analytics + marketing — call from cookie banner "Accept all". */
export function acceptAllCookieConsent(): CookieConsentState {
  return writeCookieConsent({ analytics: true, marketing: true });
}

/** Reject non-essential cookies — analytics stays gated until user accepts. */
export function rejectNonEssentialCookieConsent(): CookieConsentState {
  return writeCookieConsent({ analytics: false, marketing: false });
}

export function dispatchCookieConsentChanged(state: CookieConsentState): void {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent<CookieConsentState>(COOKIE_CONSENT_CHANGED_EVENT, { detail: state }),
  );
}

/** Subscribe to consent updates. Returns an unsubscribe function. */
export function onCookieConsentChanged(listener: (state: CookieConsentState) => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentState>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, handler);
}
