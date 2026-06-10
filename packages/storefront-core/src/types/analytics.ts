export type StorefrontEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'order_completed'
  | 'search';

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
  [key: string]: unknown;
}

export interface StorefrontAnalyticsConfig {
  apiUrl: string;
  websiteId: string;
  businessId: string;
  locale?: string;
  flushInterval?: number;
  debug?: boolean;
}
