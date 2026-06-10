/** Session-scoped first-touch marketing attribution (UTMs + ad click IDs). */
export const ATTRIBUTION_STORAGE_KEY = 'pxa_session_attribution';

export interface SessionAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  /** Path + query of the landing hit in this tab session. */
  landing_path?: string;
  /** document.referrer on the landing hit. */
  landing_referrer?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid'] as const;

const MAX_VALUE_LEN = 256;

function trimValue(raw: string | null): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.length > MAX_VALUE_LEN ? value.slice(0, MAX_VALUE_LEN) : value;
}

function readStored(): SessionAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionAttribution;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: SessionAttribution): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

function readFromSearchParams(search: URLSearchParams): Partial<SessionAttribution> {
  const out: Partial<SessionAttribution> = {};
  for (const key of UTM_KEYS) {
    const value = trimValue(search.get(key));
    if (value) out[key] = value;
  }
  for (const key of CLICK_ID_KEYS) {
    const value = trimValue(search.get(key));
    if (value) out[key] = value;
  }
  return out;
}

/** Best-effort channel guess when paid UTMs are absent (organic/social/direct). */
export function inferAttributionFromReferrer(referrer: string): Partial<SessionAttribution> {
  if (!referrer.trim()) return {};
  try {
    const host = new URL(referrer).hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 't.co' || host.endsWith('.twitter.com') || host === 'twitter.com' || host === 'x.com') {
      return { utm_source: 'twitter', utm_medium: 'social' };
    }
    if (host.includes('google.')) return { utm_source: 'google', utm_medium: 'organic' };
    if (host.includes('facebook.com') || host.includes('instagram.com') || host.includes('l.facebook.com')) {
      return { utm_source: 'facebook', utm_medium: 'social' };
    }
    if (host.includes('bing.com')) return { utm_source: 'bing', utm_medium: 'organic' };
    if (host.includes('tiktok.com')) return { utm_source: 'tiktok', utm_medium: 'social' };
    if (host.includes('youtube.com')) return { utm_source: 'youtube', utm_medium: 'social' };
    return { utm_source: host, utm_medium: 'referral' };
  } catch {
    return {};
  }
}

/**
 * Capture first-touch attribution for the current browser tab session.
 * UTMs / click IDs from the landing URL win; subsequent navigations keep the snapshot.
 */
export function captureSessionAttribution(): SessionAttribution {
  if (typeof window === 'undefined') return {};

  const stored = readStored();
  if (stored) return stored;

  const href = window.location.href;
  const url = new URL(href);
  const fromUrl = readFromSearchParams(url.searchParams);
  const landingReferrer = document.referrer?.trim() || undefined;

  const attribution: SessionAttribution = {
    landing_path: `${url.pathname}${url.search}`,
    landing_referrer: landingReferrer,
    ...fromUrl,
  };

  if (!attribution.utm_source && landingReferrer) {
    Object.assign(attribution, inferAttributionFromReferrer(landingReferrer));
  }

  writeStored(attribution);
  return attribution;
}

/** Returns the stored session attribution (capturing on first call). */
export function getSessionAttribution(): SessionAttribution {
  return captureSessionAttribution();
}

/** Test helper — clears stored attribution. */
export function clearSessionAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
