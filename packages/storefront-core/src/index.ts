// Proxima Storefront Core SDK — barrel re-exports

export * from './types/cms.js';
export * from './types/seo.js';
export * from './types/business.js';
export * from './types/buyer.js';
export * from './types/catalog.js';
export * from './types/cart.js';
export * from './types/order.js';
export * from './types/address.js';
export * from './types/wishlist.js';
export * from './types/server-env.js';
export * from './types/listing.js';
export * from './types/guest-order.js';
export * from './types/campaign.js';
export * from './types/analytics.js';
export * from './types/cookie-consent.js';

export * from './api/index.js';

export * from './seo/page-seo.js';
export * from './seo/json-ld.js';
export * from './seo/sitemap.js';
export * from './seo/robots.js';
export * from './seo/indexnow.js';

export * from './cms/website.js';
export * from './cms/payment-methods.js';

export * from './buyer/auth.js';

export * from './catalog/listings.js';

export * from './cart/cart.js';

export * from './orders/orders.js';
export * from './orders/guest.js';

export * from './addresses/address-book.js';

export * from './wishlist/wishlist.js';

export * from './server/process.js';

export * from './campaign/countdown.js';

export { analytics } from './analytics/analytics.js';
export type { StorefrontAnalyticsInitOptions } from './analytics/analytics.js';
export { resolveAnalyticsSessionId, ANALYTICS_SESSION_STORAGE_KEY } from './analytics/session.js';
export {
  captureSessionAttribution,
  getSessionAttribution,
  clearSessionAttribution,
  inferAttributionFromReferrer,
  ATTRIBUTION_STORAGE_KEY,
} from './analytics/attribution.js';
export type { SessionAttribution } from './analytics/attribution.js';
export { createStorefrontAnalyticsTrackers } from './analytics/trackers.js';
export type { StorefrontAnalyticsTrackers } from './analytics/trackers.js';

export * from './cookie-consent/consent.js';

export * from './cache/cache.js';

export {
  createFixtureBundle,
  createStorefrontDataSource,
  validateFixtureBundle,
  resolveStorefrontDataSourceForRequest,
  FixtureGuestOrderError,
} from './fixtures-commerce.js';

export type {
  FixtureBundle,
  FixtureBundleInput,
  FixtureBrandListingParams,
  FixtureCartMutationParams,
  FixtureCatalogItem,
  FixtureListingParams,
  FixtureProductListingParams,
  FixtureSearchParams,
  ResolveStorefrontDataSourceOptions,
  StorefrontCartParams,
  StorefrontDataMode,
  StorefrontDataSource,
  StorefrontDataSourceConfig,
  ValidateFixtureBundleOptions,
} from './fixtures-commerce.js';
