/** Storefront analytics events accepted by proxima-api ingest. */
export type StorefrontEventType =
  | 'page_view'
  | 'product_view'
  | 'category_view'
  | 'brand_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'cart_view'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_error'
  | 'order_completed'
  | 'not_found_page_viewed'
  | 'filter_applied'
  | 'sort_changed'
  | 'promotion_view'
  | 'wishlist_add'
  | 'login_completed'
  | 'register_completed';

export interface StorefrontEventPayload {
  product_slug?: string;
  product_id?: string;
  product_name?: string;
  variant_id?: number;
  quantity?: number;
  price?: number;
  order_id?: string;
  order_total?: number;
  query?: string;
  results_count?: number;
  category_slug?: string;
  category_name?: string;
  brand_slug?: string;
  brand_name?: string;
  item_count?: number;
  cart_total?: number;
  requested_path?: string;
  error_code?: string;
  step?: string;
  filter_type?: string;
  filter_value?: string;
  pathname?: string;
  sort?: string;
  promotion_slug?: string;
  section_type?: string;
  badge_text?: string;
  method?: string;
  attribution?: SessionAttributionPayload;
  [key: string]: unknown;
}

/** First-touch marketing attribution attached to every analytics event in a session. */
export interface SessionAttributionPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  landing_path?: string;
  landing_referrer?: string;
}

export interface StorefrontAnalyticsConfig {
  apiUrl: string;
  websiteId: string;
  businessId: string;
  locale?: string;
  flushInterval?: number;
  debug?: boolean;
  /** SSR-provided session (e.g. httpOnly cart cookie read server-side). */
  sessionId?: string;
  /** Optional runtime resolver — runs before cookie/localStorage fallbacks. */
  getSessionId?: () => string | null | undefined;
  /** Cookie name for guest cart session (default `cart_session_id`). */
  cartSessionCookieName?: string;
}

export interface ProductViewPayload {
  product_slug: string;
  product_id?: string;
  product_name?: string;
  price?: number;
}

export interface AddToCartPayload {
  product_slug: string;
  product_id?: string;
  product_name?: string;
  variant_id: number;
  price?: number;
  quantity?: number;
}

export interface CheckoutStartedPayload {
  item_count: number;
  cart_total?: number;
}
