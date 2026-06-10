import type { StorefrontAnalyticsConfig } from '../types/analytics.js';

export const ANALYTICS_SESSION_STORAGE_KEY = 'pxa_analytics_session';

const DEFAULT_CART_SESSION_COOKIE = 'cart_session_id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ResolveAnalyticsSessionIdOptions {
  cookieName?: string;
  storageKey?: string;
}

/**
 * Resolve the browser session id sent as `X-Session-ID` on analytics batches.
 * Priority: config.sessionId → config.getSessionId() → readable cart cookie → localStorage UUID.
 */
export function resolveAnalyticsSessionId(
  config?: Pick<StorefrontAnalyticsConfig, 'sessionId' | 'getSessionId' | 'cartSessionCookieName'>,
  options?: ResolveAnalyticsSessionIdOptions,
): string {
  const explicit = config?.sessionId?.trim();
  if (explicit && isUuid(explicit)) return explicit;

  const fromGetter = config?.getSessionId?.()?.trim();
  if (fromGetter && isUuid(fromGetter)) return fromGetter;

  const cookieName = config?.cartSessionCookieName ?? options?.cookieName ?? DEFAULT_CART_SESSION_COOKIE;
  const fromCookie = readCookie(cookieName)?.trim();
  if (fromCookie && isUuid(fromCookie)) return fromCookie;

  if (!isBrowser()) return createSessionId();

  const storageKey = options?.storageKey ?? ANALYTICS_SESSION_STORAGE_KEY;
  try {
    const stored = localStorage.getItem(storageKey)?.trim();
    if (stored && isUuid(stored)) return stored;
    const created = createSessionId();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return createSessionId();
  }
}
