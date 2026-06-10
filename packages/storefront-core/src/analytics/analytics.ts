import { StorefrontEndpoints } from '../api/endpoints.js';
import { isAnalyticsConsentGranted, onCookieConsentChanged } from '../cookie-consent/consent.js';
import { getSessionAttribution, captureSessionAttribution } from './attribution.js';
import { resolveAnalyticsSessionId } from './session.js';
import type { StorefrontAnalyticsConfig, StorefrontEventPayload, StorefrontEventType } from '../types/analytics.js';

export interface StorefrontAnalyticsInitOptions {
  /**
   * When true, `init()` buffers until the shopper grants analytics consent
   * (`acceptAllCookieConsent()`). Pair with a cookie banner UI.
   */
  requireAnalyticsConsent?: boolean;
}

interface QueuedEvent {
  event_type: StorefrontEventType;
  occurred_at: string;
  website_id: string;
  path: string;
  referrer?: string;
  locale?: string;
  payload: StorefrontEventPayload;
}

class ProximaAnalytics {
  private config: StorefrontAnalyticsConfig | null = null;
  private pendingConfig: StorefrontAnalyticsConfig | null = null;
  private queue: QueuedEvent[] = [];
  private preInitQueue: Array<[StorefrontEventType, StorefrontEventPayload]> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private consentRequired = false;

  init(config: StorefrontAnalyticsConfig, options?: StorefrontAnalyticsInitOptions): void {
    if (typeof window === 'undefined') return;
    if (options?.requireAnalyticsConsent) {
      this.consentRequired = true;
      this.pendingConfig = config;
      if (!isAnalyticsConsentGranted()) return;
    }
    this.start(config);
  }

  /** Resume init after the shopper grants analytics consent. */
  resumeFromConsent(): void {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;
    if (!this.consentRequired || !isAnalyticsConsentGranted()) return;
    const config = this.pendingConfig ?? this.config;
    if (!config) return;
    this.start(config);
  }

  private start(config: StorefrontAnalyticsConfig): void {
    if (typeof window === 'undefined') return;
    this.config = config;
    this.pendingConfig = null;
    if (this.initialized) return;
    this.initialized = true;

    captureSessionAttribution();

    for (const [type, payload] of this.preInitQueue.splice(0)) {
      this.track(type, payload);
    }

    const firePageView = () => this.track('page_view');
    firePageView();
    document.addEventListener('astro:page-load', firePageView);

    const interval = config.flushInterval ?? 3000;
    this.timer = setInterval(() => this.flush(), interval);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
  }

  track(type: StorefrontEventType, payload: StorefrontEventPayload = {}): void {
    if (typeof window === 'undefined') return;
    if (!this.config) {
      this.preInitQueue.push([type, payload]);
      return;
    }
    const attribution = getSessionAttribution();
    const hasAttribution = Object.keys(attribution).length > 0;
    const mergedPayload: StorefrontEventPayload = hasAttribution
      ? { ...payload, attribution }
      : payload;
    const event: QueuedEvent = {
      event_type: type,
      occurred_at: new Date().toISOString(),
      website_id: this.config.websiteId,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      locale: this.config.locale,
      payload: mergedPayload,
    };
    this.queue.push(event);
    if (this.config.debug) console.debug('[proxima:analytics] queued', event);
  }

  flush(beacon = false): void {
    if (!this.config || this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const url = `${this.config.apiUrl.replace(/\/$/, '')}${StorefrontEndpoints.analytics.events()}`;
    const body = JSON.stringify({ events: batch });
    const sessionId = resolveAnalyticsSessionId(this.config);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Business-ID': this.config.businessId,
      'X-Session-ID': sessionId,
    };

    if (this.config.debug) {
      console.debug(`[proxima:analytics] flushing ${batch.length} event(s) → ${url}`);
    }

    void fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {
      if (beacon) this.queue.unshift(...batch);
    });
  }

  destroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.initialized = false;
    this.consentRequired = false;
    this.pendingConfig = null;
    this.config = null;
    this.queue = [];
    this.preInitQueue = [];
  }
}

/** Singleton analytics client. Call `analytics.init()` once from SiteLayout. */
export const analytics = new ProximaAnalytics();

if (typeof window !== 'undefined') {
  onCookieConsentChanged((state) => {
    if (state.analytics) analytics.resumeFromConsent();
  });
}