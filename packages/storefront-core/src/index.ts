export interface ProximaApiConfig {
  baseUrl: string;
  domain: string;
  path: string;
  websiteId?: string;
  businessId?: string;
  serviceKey?: string;
}

export interface ProximaPageSummary {
  name: string;
  path: string;
  resolver_kind: string;
  is_active: boolean;
}

export interface ProximaWebsiteResponse {
  id: string;
  business_id: string;
  name: string;
  domain: string;
  subdomain_slug?: string | null;
  custom_domain?: string | null;
  publication_status?: string;
  published_at?: string | null;
  delivery_mode: string;
  website_kind: string;
  template_key?: string | null;
  code_profile?: string | null;
  locale: string;
  currency: string;
  capabilities: Record<string, any>;
  theme_tokens: Record<string, any>;
  animation_config: Record<string, any>;
  pages: ProximaPageSummary[];
}

export interface ProximaCompositionResponse {
  page_id: number;
  website_id: string;
  path: string;
  path_template: string;
  name: string;
  entity_type?: string | null;
  resolver_kind?: string | null;
  route_params: Record<string, string>;
  resolved_data?: Record<string, any> | null;
  sections: Array<{
    id: number;
    name: string;
    type: string;
    order: number;
    attributes: Record<string, any>;
    attributes_meta?: Record<string, any>;
  }>;
  seo?: Record<string, any> | null;
}

export interface ProximaProductListResponse {
  items: any[];
  total: number;
  page: number;
  size: number;
}

export async function fetchProximaWebsiteList(config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">): Promise<ProximaWebsiteResponse[]> {
  const url = new URL("/api/v1/storefront/cms/websites", config.baseUrl);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Website list failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchProximaWebsite(config: Pick<ProximaApiConfig, "baseUrl" | "domain" | "serviceKey"> & { host?: string }): Promise<ProximaWebsiteResponse> {
  const url = new URL("/api/v1/storefront/cms/websites/resolve", config.baseUrl);
  url.searchParams.set("host", config.host || config.domain);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Website resolve failed: ${response.status}`);
  }
  return response.json();
}

export function makeBuilderPreviewWebsite(config: Pick<ProximaApiConfig, "websiteId" | "businessId" | "domain">): ProximaWebsiteResponse {
  if (!config.websiteId || !config.businessId) {
    throw new Error("Builder preview requires websiteId and businessId");
  }
  return {
    id: config.websiteId,
    business_id: config.businessId,
    name: "Builder preview",
    domain: config.domain,
    delivery_mode: "custom_managed",
    website_kind: "ecommerce",
    template_key: null,
    code_profile: null,
    locale: "es",
    currency: "PEN",
    capabilities: {},
    theme_tokens: {},
    animation_config: {},
    pages: [],
  };
}

export async function fetchProximaComposition(
  config: ProximaApiConfig,
  website: ProximaWebsiteResponse,
): Promise<ProximaCompositionResponse> {
  const locale = website.locale ?? "es";
  const currency = website.currency ?? "PEN";
  const url = new URL(`/api/v1/storefront/cms/websites/${website.id}/pages/composition`, config.baseUrl);
  url.searchParams.set("path", config.path);
  url.searchParams.set("locale", locale);
  url.searchParams.set("business_id", website.business_id);
  const headers: Record<string, string> = {
    "X-Business-ID": website.business_id,
    "Accept-Language": locale,
    "X-Currency": currency,
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Composition failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchProximaProducts(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  website: ProximaWebsiteResponse,
): Promise<ProximaProductListResponse> {
  const url = new URL("/api/v1/products", config.baseUrl);
  url.searchParams.set("size", "12");
  const headers: Record<string, string> = {
    "X-Business-ID": website.business_id,
    "Accept-Language": website.locale ?? "es",
    "X-Currency": website.currency ?? "PEN",
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Products failed: ${response.status}`);
  }
  return response.json();
}

// --- Buyer Commerce Types (canonical: clients + commerce modules) ---

/** Token returned by /store/auth/register and /store/auth/login */
export interface BuyerSession {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
}

/** Customer profile from GET /store/me */
export interface BuyerProfile {
  id: number;
  email: string;
  business_id: string;
  full_name?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A single cart line — canonical field is product_variant_id */
export interface CartItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  metadata?: {
    name?: string | null;
    slug?: string | null;
    brand?: string | null;
    image?: string | null;
    unit_price?: number | null;
    unit_price_string?: string | null;
  } | null;
}

export interface CartTotals {
  subtotal: number;
  formatted_subtotal: string;
  currency: string;
}

/** Cart from GET /cart — tenant via X-Business-ID header */
export interface Cart {
  id: string;
  session_id?: string | null;
  customer_id?: number | null;
  items: CartItem[];
  totals: CartTotals;
}

/** Checkout request body for POST /checkout */
export interface CheckoutRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  /** Plain string: "Av. Javier Prado 1234, Lima" */
  shipping_address?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  customer_doc_type?: number | null;
  customer_doc_number?: string | null;
  /** ID of a saved CustomerAddress. When provided, the backend formats the address snapshot. */
  address_id?: number | null;
}

// --- Address Book ---

export interface UbigeoResult {
  code: string;
  department: string;
  province: string;
  district: string;
  full_name: string;
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  business_id: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  ubigeo?: UbigeoResult | null;
  reference?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AddressInput {
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  reference?: string | null;
  is_default?: boolean;
}

export interface OrderItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  unit_price?: number | null;
  name?: string | null;
}

/** Order from POST /checkout and GET /orders/{id} */
export interface Order {
  id: string;
  status: string;
  total?: number;
  shipping_address?: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
}

// --- Buyer Auth (canonical: /api/v1/store/auth/*) ---
// Tenant is passed as X-Business-ID header, not in the request body.

export async function registerBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { email: string; password: string; fullName?: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/register", config.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify({ email: params.email, password: params.password, full_name: params.fullName }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function loginBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { email: string; password: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/login", config.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify({ email: params.email, password: params.password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function logoutBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/logout", config.baseUrl);
  await fetch(url, { method: "POST", headers: { "Authorization": `Bearer ${params.token}` } });
}

export async function fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me", config.baseUrl);
  const response = await fetch(url, { headers: { "Authorization": `Bearer ${params.token}` } });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

// --- Cart (canonical: /api/v1/cart) ---
// Tenant via X-Business-ID, optional auth via Bearer.

function cartHeaders(businessId: string, token?: string): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function fetchCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string }
): Promise<Cart> {
  const url = new URL("/api/v1/cart", config.baseUrl);
  const response = await fetch(url, { headers: cartHeaders(website.business_id, params.token) });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function addToCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/items", config.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify({ product_variant_id: params.variantId, quantity: params.quantity }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function updateCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify({ quantity: params.quantity }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function removeCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string; variantId: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const response = await fetch(url, {
    method: "DELETE",
    headers: cartHeaders(website.business_id, params.token),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

// --- Orders (canonical: /api/v1/checkout, /api/v1/orders) ---

export async function createOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; checkout: CheckoutRequest }
): Promise<Order> {
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.checkout),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function fetchOrders(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; page?: number; size?: number }
): Promise<OrderListResponse> {
  const url = new URL("/api/v1/store/me/orders", config.baseUrl);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.size) url.searchParams.set("size", String(params.size));
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${params.token}`, "X-Business-ID": website.business_id },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

export async function fetchOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; orderId: string }
): Promise<Order> {
  const url = new URL(`/api/v1/orders/${params.orderId}`, config.baseUrl);
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${params.token}`, "X-Business-ID": website.business_id },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Request failed: ${response.status}`), { status: response.status, data: err });
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Server-side Handler Helpers
//
// These orchestrators combine fetchProximaWebsite + SDK calls so that Astro
// API routes become thin wrappers (~10 lines) that only deal with cookies and
// redirects.  Use them in `src/pages/api/buyer/**` files.
// ---------------------------------------------------------------------------

/** Environment config read from Astro import.meta.env */
export interface BuyerServerEnv {
  apiUrl: string;
  domain: string;
  serviceKey?: string;
}

/** Cookie config for the buyer session token */
export const BUYER_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
} as const;

export const BUYER_COOKIE_NAME = "buyer_token";

/**
 * Resolve the website then call loginBuyer.
 * Returns { access_token, next } on success, throws on failure.
 */
export async function processBuyerLogin(
  env: BuyerServerEnv,
  params: { email: string; password: string; next?: string }
): Promise<{ access_token: string; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await loginBuyer({ baseUrl: env.apiUrl }, website, { email: params.email, password: params.password });
  return { access_token: session.access_token, next: params.next || "/" };
}

/**
 * Resolve the website then call registerBuyer.
 * Returns { access_token, next } on success, throws on failure.
 */
export async function processBuyerRegister(
  env: BuyerServerEnv,
  params: { email: string; password: string; fullName?: string; next?: string }
): Promise<{ access_token: string; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await registerBuyer({ baseUrl: env.apiUrl }, website, { email: params.email, password: params.password, fullName: params.fullName });
  return { access_token: session.access_token, next: params.next || "/" };
}

/**
 * Call logoutBuyer (best-effort — never throws).
 */
export async function processBuyerLogout(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  try {
    await logoutBuyer({ baseUrl: env.apiUrl }, { token: params.token });
  } catch {
    // Best-effort; caller should always clear the cookie regardless
  }
}

/**
 * Resolve the website then add a variant to the cart.
 * Token is optional (guest cart supported).
 */
export async function processAddToCart(
  env: BuyerServerEnv,
  params: { token?: string; variantId: number; quantity: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return addToCart({ baseUrl: env.apiUrl }, website, { token: params.token, variantId: params.variantId, quantity: params.quantity });
}

/**
 * Resolve the website then remove a variant from the cart.
 * Token is optional (guest cart supported).
 */
export async function processRemoveCartItem(
  env: BuyerServerEnv,
  params: { token?: string; variantId: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return removeCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, variantId: params.variantId });
}

/**
 * Resolve the website then call POST /checkout.
 * Returns { orderId } on success, throws on failure.
 */
export async function processBuyerCheckout(
  env: BuyerServerEnv,
  params: { token: string; checkout: CheckoutRequest }
): Promise<{ orderId: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const order = await createOrder({ baseUrl: env.apiUrl }, website, { token: params.token, checkout: params.checkout });
  return { orderId: order.id };
}

// --- Address Book SDK functions ---

export async function fetchCustomerAddresses(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<CustomerAddress[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
  if (!res.ok) throw new Error(`fetchCustomerAddresses failed: ${res.status}`);
  return res.json();
}

export async function createCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; address: AddressInput }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("createCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

export async function updateCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number; address: Partial<AddressInput> }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("updateCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

export async function deleteCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
  if (!res.ok && res.status !== 204) throw new Error(`deleteCustomerAddress failed: ${res.status}`);
}

export async function setDefaultAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}/default`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
  if (!res.ok) throw new Error(`setDefaultAddress failed: ${res.status}`);
  return res.json();
}

export async function searchUbigeo(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { q: string }
): Promise<UbigeoResult[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/catalog/locations/ubigeos?q=${encodeURIComponent(params.q)}`);
  if (!res.ok) return [];
  return res.json();
}

// --- Address Book Server Helpers ---

export async function processSetDefaultAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return setDefaultAddress({ baseUrl: env.apiUrl }, website, params);
}

export async function processDeleteAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<void> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return deleteCustomerAddress({ baseUrl: env.apiUrl }, website, params);
}

// ---------------------------------------------------------------------------
// Storefront Analytics
//
// Client-side event tracking for the Proxima analytics ingest endpoint.
// Endpoint: POST /api/v1/store/events  (X-Business-ID header required)
//
// Usage — in SiteLayout.astro <script> tag:
//   import { analytics } from '@proxima-io/storefront-core';
//   analytics.init({ apiUrl, websiteId, businessId, locale });
//   // page_view fires automatically on astro:page-load
//
// Manual tracking:
//   analytics.track('product_view', { product_slug: 'titan-mx-pro' });
//   analytics.track('add_to_cart', { product_slug, variant_id, price });
//   analytics.track('order_completed', { order_id, order_total });
//   analytics.track('search', { query, results_count });
// ---------------------------------------------------------------------------

export type StorefrontEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'order_completed'
  | 'search';

export interface StorefrontEventPayload {
  /** Product slug or ID, for product_view / add_to_cart */
  product_slug?: string;
  product_id?: string;
  product_name?: string;
  /** Variant ID for add_to_cart */
  variant_id?: number;
  quantity?: number;
  price?: number;
  /** Order ID and total for order_completed */
  order_id?: string;
  order_total?: number;
  /** Search term and result count for search */
  query?: string;
  results_count?: number;
  /** Arbitrary extras */
  [key: string]: unknown;
}

export interface StorefrontAnalyticsConfig {
  /** Base URL of the Proxima API (e.g. http://localhost:8000) */
  apiUrl: string;
  /** website.id UUID */
  websiteId: string;
  /** website.business_id UUID — sent as X-Business-ID */
  businessId: string;
  /** ISO locale code, e.g. "es" */
  locale?: string;
  /** How often (ms) to flush the event queue. Default: 3000 */
  flushInterval?: number;
  /** Log events to console. Default: false */
  debug?: boolean;
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
  private queue: QueuedEvent[] = [];
  /** Events queued before init() is called — replayed once config is set. */
  private preInitQueue: Array<[StorefrontEventType, StorefrontEventPayload]> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /**
   * Initialize the analytics client. Call once from SiteLayout.
   * Automatically starts listening for Astro page transitions and
   * fires a page_view event on each navigation.
   * Any events queued before init() is replayed immediately.
   */
  init(config: StorefrontAnalyticsConfig): void {
    if (typeof window === 'undefined') return; // SSR guard
    this.config = config;
    if (this.initialized) return;
    this.initialized = true;

    // Replay events queued before init() (e.g. product_view from a component script)
    for (const [type, payload] of this.preInitQueue.splice(0)) {
      this.track(type, payload);
    }

    // Auto page_view on first load and on Astro view transitions
    const firePageView = () => this.track('page_view');
    firePageView();
    document.addEventListener('astro:page-load', firePageView);

    // Periodic flush
    const interval = config.flushInterval ?? 3000;
    this.timer = setInterval(() => this.flush(), interval);

    // Flush on page hide (tab close / navigate away)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
  }

  /**
   * Queue a storefront event. Call from any client-side component.
   * Safe to call before init() — events are replayed once the config is set.
   * The event queue is flushed automatically every `flushInterval` ms.
   */
  track(type: StorefrontEventType, payload: StorefrontEventPayload = {}): void {
    if (typeof window === 'undefined') return;
    if (!this.config) {
      // Store for replay after init — drop only if we're in SSR
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

  /**
   * Flush the current queue to the API.
   * Pass `beacon = true` to use sendBeacon (fire-and-forget on page unload).
   */
  flush(beacon = false): void {
    if (!this.config || this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const url = `${this.config.apiUrl}/api/v1/store/events`;
    const body = JSON.stringify({ events: batch });
    const headers = { 'Content-Type': 'application/json', 'X-Business-ID': this.config.businessId };

    if (this.config.debug) console.debug(`[proxima:analytics] flushing ${batch.length} event(s)`);

    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // sendBeacon doesn't support custom headers — wrap in a Blob
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (!sent) {
        // sendBeacon failed (e.g. queue full) — re-queue for next flush
        this.queue.unshift(...batch);
      }
      return;
    }

    fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {
      // Silent fail — analytics must never break the storefront
    });
  }

  /** Stop the flush timer and reset state (useful in tests). */
  destroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.initialized = false;
    this.config = null;
    this.queue = [];
    this.preInitQueue = [];
  }
}

/** Singleton analytics client. Import and call `analytics.init()` from SiteLayout. */
export const analytics = new ProximaAnalytics();
