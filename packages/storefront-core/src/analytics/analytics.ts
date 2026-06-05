import type { StorefrontAnalyticsConfig, StorefrontEventPayload, StorefrontEventType } from '../types/analytics.js';

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
  private queue: QueuedEvent[] = [];
  private preInitQueue: Array<[StorefrontEventType, StorefrontEventPayload]> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  init(config: StorefrontAnalyticsConfig): void {
    if (typeof window === 'undefined') return;
    this.config = config;
    if (this.initialized) return;
    this.initialized = true;

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
    const event: QueuedEvent = {
      event_type: type,
      occurred_at: new Date().toISOString(),
      website_id: this.config.websiteId,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      locale: this.config.locale,
      payload,
    };
    this.queue.push(event);
    if (this.config.debug) console.debug('[proxima:analytics] queued', event);
  }

  flush(beacon = false): void {
    if (!this.config || this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const url = `${this.config.apiUrl}/api/v1/store/events`;
    const body = JSON.stringify({ events: batch });
    const headers = { 'Content-Type': 'application/json', 'X-Business-ID': this.config.businessId };

    if (this.config.debug) console.debug(`[proxima:analytics] flushing ${batch.length} event(s)`);

    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (!sent) this.queue.unshift(...batch);
      return;
    }

    fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
  }

  destroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.initialized = false;
    this.config = null;
    this.queue = [];
    this.preInitQueue = [];
  }
}

/** Singleton analytics client. Call `analytics.init()` once from SiteLayout. */
export const analytics = new ProximaAnalytics();