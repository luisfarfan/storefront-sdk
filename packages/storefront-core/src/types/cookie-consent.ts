/** Bump when categories or semantics change to re-prompt returning visitors. */
export const COOKIE_CONSENT_VERSION = 1;

/** localStorage key for persisted consent. */
export const COOKIE_CONSENT_STORAGE_KEY = 'pxa_cookie_consent';

/** CustomEvent name fired after the shopper saves or updates consent. */
export const COOKIE_CONSENT_CHANGED_EVENT = 'pxa:cookie-consent-changed';

export interface CookieConsentCategories {
  /** Session, cart, auth — always enabled; not configurable. */
  essential: true;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState extends CookieConsentCategories {
  version: number;
  /** ISO timestamp when the shopper made their choice. */
  decidedAt: string;
}
