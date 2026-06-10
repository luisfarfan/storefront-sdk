import { analytics } from './analytics.js';
import type { StorefrontAnalyticsConfig, StorefrontEventPayload, StorefrontEventType } from '../types/analytics.js';

type AnalyticsClient = Pick<typeof analytics, 'init' | 'track' | 'flush'>;

function track(client: AnalyticsClient, type: StorefrontEventType, payload: StorefrontEventPayload = {}): void {
  client.track(type, payload);
}

/** Thin typed wrappers — optional DX layer over the analytics singleton. */
export function createStorefrontAnalyticsTrackers(client: AnalyticsClient = analytics) {
  return {
    init: (config: StorefrontAnalyticsConfig, options?: Parameters<typeof analytics.init>[1]) =>
      client.init(config, options),
    flush: (beacon?: boolean) => client.flush(beacon),
    pageView: () => track(client, 'page_view'),
    productView: (payload: StorefrontEventPayload) => track(client, 'product_view', payload),
    categoryView: (payload: StorefrontEventPayload) => track(client, 'category_view', payload),
    brandView: (payload: StorefrontEventPayload) => track(client, 'brand_view', payload),
    search: (query: string, resultsCount: number) =>
      track(client, 'search', { query, results_count: resultsCount }),
    addToCart: (payload: StorefrontEventPayload) => track(client, 'add_to_cart', payload),
    removeFromCart: (payload: StorefrontEventPayload) => track(client, 'remove_from_cart', payload),
    cartView: (payload: StorefrontEventPayload) => track(client, 'cart_view', payload),
    checkoutStarted: (payload: StorefrontEventPayload) => track(client, 'checkout_started', payload),
    checkoutError: (payload: StorefrontEventPayload) => track(client, 'checkout_error', payload),
    orderCompleted: (payload: StorefrontEventPayload) => track(client, 'order_completed', payload),
    notFound: (payload: StorefrontEventPayload) => track(client, 'not_found_page_viewed', payload),
    filterApplied: (payload: StorefrontEventPayload) => track(client, 'filter_applied', payload),
    sortChanged: (payload: StorefrontEventPayload) => track(client, 'sort_changed', payload),
    promotionView: (payload: StorefrontEventPayload) => track(client, 'promotion_view', payload),
    wishlistAdd: (payload: StorefrontEventPayload) => track(client, 'wishlist_add', payload),
    loginCompleted: (method = 'password') => track(client, 'login_completed', { method }),
    registerCompleted: () => track(client, 'register_completed'),
  };
}

export type StorefrontAnalyticsTrackers = ReturnType<typeof createStorefrontAnalyticsTrackers>;
