// ---------------------------------------------------------------------------
// Proxima Storefront Core SDK
// ---------------------------------------------------------------------------
// Single-file client for the Proxima API.  Import what you need:
//   import { loginBuyer, fetchRegistrationForm, addToWishlist } from '@proxima-io/storefront-core';
// ---------------------------------------------------------------------------

export interface ProximaApiConfig {
  baseUrl: string;
  domain: string;
  path: string;
  websiteId?: string;
  businessId?: string;
  serviceKey?: string;
  /** UUID of a content variant — when set, composition returns the variant snapshot instead of live content. */
  variantId?: string;
  /** Preview token obtained from the rotate endpoint. Required when variantId is set. */
  previewToken?: string;
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
  og_image_url?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  twitter_handle?: string | null;
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

/** List all websites for a service-key authenticated caller. Useful for build-time scripts. */
export async function fetchProximaWebsiteList(config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">): Promise<ProximaWebsiteResponse[]> {
  const url = new URL("/api/v1/storefront/cms/websites", config.baseUrl);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Website list failed: ${response.status}`);
  return response.json();
}

/**
 * Resolve a website by domain/host. Call this once per request and cache the result.
 * Pass `host` if the incoming request host differs from `config.domain` (e.g. in middleware).
 *
 * @example
 * const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: Astro.url.hostname });
 */
export async function fetchProximaWebsite(
  config: Pick<ProximaApiConfig, "baseUrl" | "domain" | "serviceKey"> & { host?: string }
): Promise<ProximaWebsiteResponse> {
  const url = new URL("/api/v1/storefront/cms/websites/resolve", config.baseUrl);
  url.searchParams.set("host", config.host || config.domain);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Website resolve failed: ${response.status}`);
  return response.json();
}

/**
 * Build a synthetic `ProximaWebsiteResponse` for the visual builder preview.
 * Use this when the builder passes `websiteId` and `businessId` via query params
 * instead of resolving by domain.
 */
export function makeBuilderPreviewWebsite(
  config: Pick<ProximaApiConfig, "websiteId" | "businessId" | "domain">
): ProximaWebsiteResponse {
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

/**
 * Fetch the fully resolved page composition for the given path.
 * This is the main data-fetching call for every SSR page render.
 * The response embeds all section data (via smart collections) and, for detail pages,
 * the primary entity in `resolved_data` (product, category, brand, blog post).
 * No additional catalog API calls are needed for the initial render.
 *
 * @example
 * // src/pages/[...path].astro
 * const composition = await fetchProximaComposition(
 *   { ...config, path: Astro.url.pathname },
 *   website
 * );
 */
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
  if (config.variantId)   url.searchParams.set("variant_id", config.variantId);
  if (config.previewToken) url.searchParams.set("preview_token", config.previewToken);
  const headers: Record<string, string> = {
    "X-Business-ID": website.business_id,
    "Accept-Language": locale,
    "X-Currency": currency,
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Composition failed: ${response.status}`);
  return response.json();
}

/**
 * @deprecated Use `fetchStorefrontProducts` instead. This function calls the raw
 * catalog endpoint (`/api/v1/products`) which is not enriched for storefront use
 * (no price_formatted, no badge, no default_variant_id). It will be removed in a future version.
 */
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
  if (!response.ok) throw new Error(`Products failed: ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Error constants
// ---------------------------------------------------------------------------

/** Well-known error detail strings returned by the API. Use these for comparison
 *  instead of hardcoding strings in your storefront.
 *
 * @example
 * try { await resetPassword(...) } catch (e: any) {
 *   if (e.data?.detail === BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID) { ... }
 * }
 */
export const BUYER_AUTH_ERRORS = {
  RESET_TOKEN_INVALID:    "RESET_TOKEN_INVALID",
  VERIFY_TOKEN_INVALID:   "VERIFY_TOKEN_INVALID",
  EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
  EMAIL_TAKEN:            "Email already registered in this store",
  MISSING_REQUIRED_FIELDS: "MISSING_REQUIRED_FIELDS",
} as const;

// ---------------------------------------------------------------------------
// Buyer Auth types
// ---------------------------------------------------------------------------

/** Token pair returned by /store/auth/register, /store/auth/login, /store/auth/refresh */
export interface BuyerSession {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
}

/** Full customer profile from GET /store/me */
export interface BuyerProfile {
  id: number;
  email: string;
  business_id: string;
  full_name: string | null;
  phone: string | null;
  doc_type: number | null;          // 1=DNI 2=CE 3=Pasaporte 6=RUC
  doc_number: string | null;
  birth_date: string | null;        // "YYYY-MM-DD"
  newsletter_subscribed: boolean;
  avatar_url: string | null;
  metadata: Record<string, any>;    // custom fields configured per merchant
  registration_source: string;      // "organic" | "google_ads" | ...
  last_login_at: string | null;     // ISO datetime
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Registration Form types
// ---------------------------------------------------------------------------

/** A single resolved field in the storefront registration form. */
export interface RegistrationFormField {
  name: string;
  label: string;
  /** "text" | "password" | "phone" | "date" | "select" | "boolean" | "image" | "address" | "custom" */
  type: string;
  /** "text_input" | "phone_input" | "date_picker" | "select" | "checkbox" | "toggle"
   *  | "image_upload" | "ubigeo_selector" | "google_maps_picker" | "manual" */
  widget: string;
  widget_config: Record<string, any>;
  required: boolean;
  order: number;
  options: string[] | null;
}

/** A single step in the form (always at least one). */
export interface RegistrationFormStep {
  id: string;
  label: string;
  order: number;
  skippable: boolean;
  fields: RegistrationFormField[];
}

/** Full resolved form schema from GET /store/auth/registration-form.
 *  `email` and `password` are always present in steps[0].fields — no need to add them. */
export interface RegistrationForm {
  mode: "single_step" | "multi_step";
  steps: RegistrationFormStep[];
}

// ---------------------------------------------------------------------------
// Registration params & errors
// ---------------------------------------------------------------------------

/** Address submitted during customer registration. */
export interface AddressInRegistration {
  line1: string;
  line2?: string | null;
  reference?: string | null;
  /** 6-digit Peruvian ubigeo code, e.g. "150101" */
  ubigeo_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** "google_maps" | "ubigeo_centroid" | "manual" */
  geocoding_source?: string | null;
}

/** All accepted fields for POST /store/auth/register.
 *  Which fields are required depends on the merchant's registration form configuration.
 *  Use fetchRegistrationForm() to know which fields to show and which are required. */
export interface BuyerRegisterParams {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  /** Default "organic". */
  registrationSource?: string;
  /** Custom fields configured by the merchant — keyed by field name. */
  metadata?: Record<string, any>;
  address?: AddressInRegistration | null;
}

/** A single field that was missing in the registration request. */
export interface MissingField {
  field: string;
  msg: string; // always "FIELD_REQUIRED"
}

/**
 * Thrown when the API returns 422 MISSING_REQUIRED_FIELDS.
 * Use `error.missingFields` to mark exactly which fields are invalid in the UI.
 *
 * @example
 * try {
 *   await registerBuyer(config, website, params);
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     for (const { field } of e.missingFields) markFieldError(field);
 *   }
 * }
 */
export class MissingFieldsError extends Error {
  status = 422 as const;
  missingFields: MissingField[];
  constructor(missingFields: MissingField[]) {
    super("MISSING_REQUIRED_FIELDS");
    this.name = "MissingFieldsError";
    this.missingFields = missingFields;
  }
}

// ---------------------------------------------------------------------------
// Profile update params
// ---------------------------------------------------------------------------

/** Fields the customer can update via PATCH /store/me/profile. All optional. */
export interface BuyerProfileUpdateParams {
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  avatarUrl?: string | null;
  /** If provided, changes the customer's password. */
  password?: string;
}

// ---------------------------------------------------------------------------
// Storefront catalog types
// ---------------------------------------------------------------------------

/** Lightweight product representation used in listings, search results, and smart collections. */
export interface StorefrontProductSummary {
  id: number;
  name: string;
  slug: string;
  price: number;
  price_formatted?: string | null;
  image_url: string;
  brand_name?: string | null;
  category_name?: string | null;
  /** Promotional badge text, e.g. "OFERTA", "NUEVO" */
  badge?: string | null;
  rating: number;
  currency?: string | null;
  /** First variant id — use this when calling addToCart from a listing card */
  default_variant_id?: number | null;
}

/** Pagination metadata returned by listing endpoints. */
export interface StorefrontPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface StorefrontSortOption {
  value: string;
  label: string;
}

export interface StorefrontFacetOption {
  value: string;
  label: string;
  count: number;
}

/** Response from GET /storefront/search */
export interface StorefrontSearchResponse {
  query: string;
  hits: StorefrontProductSummary[];
  total: number;
}

/** Response from GET /storefront/products (all-products listing with facets) */
export interface StorefrontProductListingResponse {
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategorySummary {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
}

export interface StorefrontBrandSummary {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

/** Response from GET /storefront/categories/{slug}/products */
export interface StorefrontCategoryListingResponse {
  category: StorefrontCategorySummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
}

/** Response from GET /storefront/brands/{slug}/products */
export interface StorefrontBrandListingResponse {
  brand: StorefrontBrandSummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategoryDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  image_url?: string | null;
  description?: string | null;
  product_count: number;
}

export interface StorefrontBrandDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  logo_url?: string | null;
  product_count: number;
}

export interface StorefrontCategoryDirectoryResponse {
  items: StorefrontCategoryDirectoryItem[];
  total: number;
}

export interface StorefrontBrandDirectoryResponse {
  items: StorefrontBrandDirectoryItem[];
  total: number;
}

/** Shared params for product listing endpoints — sort, pagination, filters. */
export interface StorefrontListingParams {
  /** Page number, starting at 1 */
  page?: number;
  /** Items per page (1–60). Default: 24 */
  pageSize?: number;
  /** "newest" | "price_asc" | "price_desc" | "popular". Default: "newest" */
  sort?: string;
  /** Locale for translated names, e.g. "es", "en" */
  locale?: string;
  /** ISO currency code, e.g. "PEN", "USD" */
  currency?: string;
}

/** Coupon validation result from GET /commerce/coupons/validate */
export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  /** Amount to deduct from the order total */
  discount_amount?: number;
  /** "percentage" | "fixed" */
  discount_type?: string;
  discount_value?: number;
  /** Error message when valid=false */
  error?: string;
}

// ---------------------------------------------------------------------------
// Cart types
// ---------------------------------------------------------------------------

/** A line item inside a Cart. */
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

/** Shopping cart for a guest session or authenticated customer. */
export interface Cart {
  id: string;
  session_id?: string | null;
  customer_id?: number | null;
  items: CartItem[];
  totals: CartTotals;
}

/** Customer and shipping details submitted at checkout. */
export interface CheckoutRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  customer_doc_type?: number | null;
  customer_doc_number?: string | null;
  address_id?: number | null;
}

// ---------------------------------------------------------------------------
// Address types
// ---------------------------------------------------------------------------

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
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default?: boolean;
}

// ---------------------------------------------------------------------------
// Order types
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  unit_price?: number | null;
  name?: string | null;
}

/** An order placed by a customer. */
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

// ---------------------------------------------------------------------------
// Wishlist types
// ---------------------------------------------------------------------------

/** A single item in the customer's wishlist. */
export interface WishlistItem {
  id: number;
  customer_id: number;
  business_id: string;
  product_id: string;       // UUID — references catalog, no FK enforced
  variant_id: string | null;
  notes: string | null;
  added_at: string;         // ISO datetime
}

// ---------------------------------------------------------------------------
// Server-side env
// ---------------------------------------------------------------------------

/**
 * Environment variables needed by server-side `process*` helpers.
 * Typically populated from `import.meta.env` in an Astro API route.
 */
export interface BuyerServerEnv {
  apiUrl: string;
  domain: string;
  serviceKey?: string;
}

/** Recommended options for the buyer session cookie. Apply to both `buyer_token` and `buyer_refresh_token`. */
export const BUYER_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
} as const;

export const BUYER_COOKIE_NAME = "buyer_token";
export const BUYER_REFRESH_COOKIE_NAME = "buyer_refresh_token";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function apiError(status: number, data: unknown): Error {
  return Object.assign(new Error(`Request failed: ${status}`), { status, data });
}

function authHeaders(
  businessId: string,
  token?: string | null
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ---------------------------------------------------------------------------
// Registration Form
// ---------------------------------------------------------------------------

/**
 * Fetch the merchant-configured registration form schema.
 * Call this server-side in your /register page to know which fields to render
 * and which are required. `email` and `password` are always prepended by the API.
 *
 * @example
 * // src/pages/register.astro
 * const form = await fetchRegistrationForm({ baseUrl: env.apiUrl }, website);
 * // Pass `form` as a prop to a client component that renders the dynamic form
 */
export async function fetchRegistrationForm(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">
): Promise<RegistrationForm> {
  const url = new URL("/api/v1/store/auth/registration-form", config.baseUrl);
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) {
    throw apiError(res.status, await res.json().catch(() => ({})));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Buyer Auth — client-side functions
// ---------------------------------------------------------------------------

/**
 * Register a new customer. The merchant decides which fields are required —
 * call fetchRegistrationForm() first to know what to collect.
 *
 * Throws MissingFieldsError when the merchant marked fields as required but
 * they were omitted, so you can mark exactly which inputs are invalid.
 *
 * @example
 * try {
 *   const session = await registerBuyer(config, website, { email, password, fullName });
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     e.missingFields.forEach(({ field }) => markError(field));
 *   }
 * }
 */
export async function registerBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: BuyerRegisterParams
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/register", config.baseUrl);
  const body: Record<string, any> = {
    email: params.email,
    password: params.password,
  };
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.registrationSource !== undefined)  body.registration_source = params.registrationSource;
  if (params.metadata !== undefined)            body.metadata = params.metadata;
  if (params.address !== undefined)             body.address = params.address;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Parse MISSING_REQUIRED_FIELDS into structured MissingFieldsError
    if (res.status === 422 && typeof data.detail === "string" && data.detail.startsWith("MISSING_REQUIRED_FIELDS:")) {
      try {
        const raw = data.detail.replace("MISSING_REQUIRED_FIELDS:", "").trim();
        // API returns Python repr: [{'field': 'phone', 'msg': 'FIELD_REQUIRED'}, ...]
        // Safe to JSON.parse after normalizing Python single-quotes
        const normalized = raw.replace(/'/g, '"');
        const missingFields: MissingField[] = JSON.parse(normalized);
        throw new MissingFieldsError(missingFields);
      } catch (e) {
        if (e instanceof MissingFieldsError) throw e;
        // If parsing failed, fall through to generic error
      }
    }
    throw apiError(res.status, data);
  }
  return res.json();
}

/**
 * Authenticate a customer with email and password.
 * Returns a BuyerSession with access_token and refresh_token.
 * Throws { status: 401 } on wrong credentials.
 */
export async function loginBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; password: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/login", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify({ email: params.email, password: params.password }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Invalidate the current session server-side. Best-effort — always clear the cookie too. */
export async function logoutBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/logout", config.baseUrl);
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
}

/**
 * Exchange a refresh token for a new access token.
 * Call this when you get a 401 on any authenticated request.
 * Throws { status: 401 } if the refresh token is expired or revoked.
 *
 * @example
 * // In Astro middleware:
 * try {
 *   const session = await refreshBuyerToken(config, website, { refreshToken });
 *   // Set new access_token cookie
 * } catch {
 *   // Clear both cookies, redirect to login
 * }
 */
export async function refreshBuyerToken(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { refreshToken: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/refresh", config.baseUrl);
  url.searchParams.set("refresh_token", params.refreshToken);
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's full profile. */
export async function fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Update the authenticated customer's profile. Only the fields you include
 * in `params` are changed — it's a partial update.
 */
export async function updateBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string } & BuyerProfileUpdateParams
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me/profile", config.baseUrl);
  const body: Record<string, any> = {};
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.avatarUrl !== undefined)           body.avatar_url = params.avatarUrl;
  if (params.password !== undefined)            body.password = params.password;

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Password recovery & email verification
// ---------------------------------------------------------------------------

/**
 * Send a password reset email. Always resolves — even if the email doesn't exist.
 * Always show: "Si el email existe, recibirás un enlace para restablecer tu contraseña."
 */
export async function forgotPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/forgot-password", config.baseUrl);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify({ email: params.email }),
  });
}

/**
 * Reset the customer's password using the token from the reset email link.
 * The token is the `?token=` query param in the reset URL.
 * On success, all active sessions are revoked — redirect to login.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function resetPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string; newPassword: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/reset-password", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token, new_password: params.newPassword }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Verify the customer's email using the token from the verification email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function verifyEmail(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/verify-email", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Re-send the email verification link. Requires the customer to be authenticated.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED } if already verified.
 */
export async function resendVerification(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/resend-verification", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

// ---------------------------------------------------------------------------
// Storefront catalog — search & listings (client-side interactions)
// ---------------------------------------------------------------------------

// Internal helper: builds the Accept-Language + X-Currency + X-Business-ID headers
function storefrontHeaders(
  businessId: string,
  locale?: string,
  currency?: string,
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (locale)   h["Accept-Language"] = locale;
  if (currency) h["X-Currency"] = currency;
  return h;
}

/**
 * Search products by query string. Use this for the search bar, autocomplete,
 * and search results pages — `resolved_data` for a `search` page is intentionally
 * null; query results must be fetched directly.
 *
 * @example
 * const results = await searchStorefront(config, website, { q: 'zapatillas', limit: 10 });
 */
export async function searchStorefront(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: { q: string; limit?: number; locale?: string; currency?: string }
): Promise<StorefrontSearchResponse> {
  const url = new URL("/api/v1/storefront/search", config.baseUrl);
  url.searchParams.set("q", params.q);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the general product listing with optional filters and pagination.
 * Use this for client-side filter/sort/paginate interactions on the all-products page.
 * The initial page render is handled by the composition — call this for subsequent
 * filter changes and page turns.
 */
export async function fetchStorefrontProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    brand?: string;
    category?: string;
    q?: string;
  } = {}
): Promise<StorefrontProductListingResponse> {
  const url = new URL("/api/v1/storefront/products", config.baseUrl);
  if (params.page)             url.searchParams.set("page", String(params.page));
  if (params.pageSize)         url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)             url.searchParams.set("sort", params.sort);
  if (params.brand)            url.searchParams.set("brand", params.brand);
  if (params.category)         url.searchParams.set("category", params.category);
  if (params.q)                url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch paginated + filtered products for a category page (CLP).
 * Use this for client-side filter/sort/paginate after the initial SSR render
 * (which arrives in `resolved_data` from `fetchProximaComposition`).
 */
export async function fetchCategoryProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    /** Category slug, from the URL path */
    slug: string;
    brand?: string;
    q?: string;
  }
): Promise<StorefrontCategoryListingResponse> {
  const url = new URL(`/api/v1/storefront/categories/${encodeURIComponent(params.slug)}/products`, config.baseUrl);
  if (params.page)     url.searchParams.set("page", String(params.page));
  if (params.pageSize) url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)     url.searchParams.set("sort", params.sort);
  if (params.brand)    url.searchParams.set("brand", params.brand);
  if (params.q)        url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch paginated + filtered products for a brand page (BLP).
 * Use this for client-side filter/sort/paginate after the initial SSR render
 * (which arrives in `resolved_data` from `fetchProximaComposition`).
 */
export async function fetchBrandProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">,
  params: StorefrontListingParams & {
    /** Brand slug, from the URL path */
    slug: string;
    category?: string;
    q?: string;
  }
): Promise<StorefrontBrandListingResponse> {
  const url = new URL(`/api/v1/storefront/brands/${encodeURIComponent(params.slug)}/products`, config.baseUrl);
  if (params.page)     url.searchParams.set("page", String(params.page));
  if (params.pageSize) url.searchParams.set("page_size", String(params.pageSize));
  if (params.sort)     url.searchParams.set("sort", params.sort);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.q)        url.searchParams.set("q", params.q);
  const res = await fetch(url, {
    headers: storefrontHeaders(
      website.business_id,
      params.locale ?? website.locale,
      params.currency ?? website.currency,
    ),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the full category directory (all categories with product counts).
 * Useful for navigation menus and sitemap generation.
 * For section-level category carousels, use smart collections via composition instead.
 */
export async function fetchCategoriesDirectory(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale">,
  params: { locale?: string } = {}
): Promise<StorefrontCategoryDirectoryResponse> {
  const url = new URL("/api/v1/storefront/categories", config.baseUrl);
  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, params.locale ?? website.locale),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Fetch the full brand directory (all brands with product counts).
 * Useful for navigation menus and sitemap generation.
 */
export async function fetchBrandsDirectory(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale">,
  params: { locale?: string } = {}
): Promise<StorefrontBrandDirectoryResponse> {
  const url = new URL("/api/v1/storefront/brands", config.baseUrl);
  const res = await fetch(url, {
    headers: storefrontHeaders(website.business_id, params.locale ?? website.locale),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

function cartHeaders(businessId: string, token?: string | null): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/** Fetch the current cart. Works for both guest sessions and authenticated customers. */
export async function fetchCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null }
): Promise<Cart> {
  const url = new URL("/api/v1/cart", config.baseUrl);
  const res = await fetch(url, { headers: cartHeaders(website.business_id, params.token) });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product variant to the cart. Use `StorefrontProductSummary.default_variant_id`
 * as `variantId` when adding from a listing card.
 */
export async function addToCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/items", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify({ product_variant_id: params.variantId, quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Update the quantity of an existing cart item. Set `quantity` to 0 to remove it. */
export async function updateCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify({ quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Remove a product variant from the cart entirely. */
export async function removeCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; variantId: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: cartHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Merge a guest cart (identified by session ID) into the authenticated customer's cart.
 * Call this immediately after a successful login if there is an active guest session.
 *
 * @example
 * const sessionId = localStorage.getItem('proxima_session_id');
 * if (sessionId) await mergeGuestCart(config, website, { token, sessionId });
 */
export async function mergeGuestCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; sessionId: string }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/merge", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Business-ID": website.business_id,
      "X-Session-ID": params.sessionId,
      "Authorization": `Bearer ${params.token}`,
    },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Validate a coupon code before checkout. Always resolves — check `result.valid`.
 * Use the `discount_amount` from the result to preview the discount in the UI.
 *
 * @example
 * const result = await validateCoupon(config, website, { code: 'PROMO10', amount: 150.00 });
 * if (result.valid) showDiscount(result.discount_amount);
 * else showError(result.error);
 */
export async function validateCoupon(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { code: string; amount: number }
): Promise<CouponValidationResult> {
  const url = new URL("/api/v1/commerce/coupons/validate", config.baseUrl);
  url.searchParams.set("code", params.code);
  url.searchParams.set("amount", String(params.amount));
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Submit the current cart as an order (checkout). The cart must be non-empty.
 * On success the cart is cleared. Throws 400 on validation errors (e.g. out of stock).
 */
export async function createOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; checkout: CheckoutRequest }
): Promise<Order> {
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.checkout),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's order history, paginated. */
export async function fetchOrders(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; page?: number; size?: number }
): Promise<OrderListResponse> {
  const url = new URL("/api/v1/store/me/orders", config.baseUrl);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.size) url.searchParams.set("size", String(params.size));
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch a single order by ID. Works for authenticated customers and guests with the receipt token. */
export async function fetchOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; orderId: string }
): Promise<Order> {
  const url = new URL(`/api/v1/orders/${params.orderId}`, config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Address Book
// ---------------------------------------------------------------------------

/** Fetch all saved addresses for the authenticated customer. */
export async function fetchCustomerAddresses(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<CustomerAddress[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`fetchCustomerAddresses failed: ${res.status}`);
  return res.json();
}

/** Save a new address to the customer's address book. */
export async function createCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; address: AddressInput }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("createCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Partially update a saved address. Only the fields included in `address` are changed. */
export async function updateCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number; address: Partial<AddressInput> }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("updateCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Delete a saved address. Throws if the address does not exist. */
export async function deleteCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`deleteCustomerAddress failed: ${res.status}`);
}

/** Mark an address as the customer's default. The previous default is unset automatically. */
export async function setDefaultAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}/default`, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`setDefaultAddress failed: ${res.status}`);
  return res.json();
}

/**
 * Search Peruvian ubigeo codes (department/province/district) by name.
 * Use this to power the address form's location selector.
 * Returns an empty array on error instead of throwing.
 */
export async function searchUbigeo(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { q: string }
): Promise<UbigeoResult[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/catalog/locations/ubigeos?q=${encodeURIComponent(params.q)}`);
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

/**
 * Fetch all wishlist items for the authenticated customer.
 * Returns an empty array if the wishlist is empty.
 */
export async function fetchWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<WishlistItem[]> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product to the wishlist. Idempotent — if the product is already
 * in the wishlist, returns the existing item without creating a duplicate.
 */
export async function addToWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: {
    token: string;
    productId: string;
    variantId?: string | null;
    notes?: string | null;
  }
): Promise<WishlistItem> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify({
      product_id: params.productId,
      variant_id: params.variantId ?? null,
      notes: params.notes ?? null,
    }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Remove a product from the wishlist.
 * Throws { status: 404 } if the product was not in the wishlist.
 */
export async function removeFromWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; productId: string }
): Promise<void> {
  const url = new URL(`/api/v1/store/me/wishlist/${params.productId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

// ---------------------------------------------------------------------------
// Server-side Handler Helpers (for Astro API routes)
//
// These orchestrators combine fetchProximaWebsite + SDK calls so that Astro
// API routes become thin wrappers (~10 lines) that only deal with cookies
// and redirects. Use them in `src/pages/api/buyer/**` files.
// ---------------------------------------------------------------------------

/**
 * Resolve the website then call loginBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 */
export async function processBuyerLogin(
  env: BuyerServerEnv,
  params: { email: string; password: string; next?: string }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await loginBuyer({ baseUrl: env.apiUrl }, website, { email: params.email, password: params.password });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: params.next || "/" };
}

/**
 * Resolve the website then call registerBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 * Propagates MissingFieldsError so the API route can return structured 422 errors.
 */
export async function processBuyerRegister(
  env: BuyerServerEnv,
  params: BuyerRegisterParams & { next?: string }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const { next, ...registerParams } = params;
  const session = await registerBuyer({ baseUrl: env.apiUrl }, website, registerParams);
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: next || "/" };
}

/**
 * Call logoutBuyer (best-effort — never throws).
 * Always clear the session cookie regardless of the result.
 */
export async function processBuyerLogout(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await logoutBuyer({ baseUrl: env.apiUrl }, website, { token: params.token });
  } catch {
    // Best-effort — caller must always clear the cookie regardless
  }
}

/**
 * Resolve the website then exchange a refresh token for a new access token.
 * Use this in Astro middleware to silently refresh expired sessions.
 * Throws { status: 401 } if the refresh token is expired — clear cookies and redirect to login.
 */
export async function processRefreshToken(
  env: BuyerServerEnv,
  params: { refreshToken: string }
): Promise<{ access_token: string; refresh_token: string | null }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await refreshBuyerToken({ baseUrl: env.apiUrl }, website, { refreshToken: params.refreshToken });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null };
}

/**
 * Resolve the website then send a password reset email.
 * Never throws — always show a generic confirmation message.
 */
export async function processForgotPassword(
  env: BuyerServerEnv,
  params: { email: string }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await forgotPassword({ baseUrl: env.apiUrl }, website, { email: params.email });
  } catch {
    // Never expose whether the email exists
  }
}

/**
 * Reset the customer's password with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function processResetPassword(
  env: BuyerServerEnv,
  params: { token: string; newPassword: string }
): Promise<void> {
  await resetPassword({ baseUrl: env.apiUrl }, params);
}

/**
 * Verify the customer's email with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function processVerifyEmail(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  await verifyEmail({ baseUrl: env.apiUrl }, params);
}

/**
 * Resolve the website then add a variant to the cart.
 * Token is optional (guest cart supported).
 */
export async function processAddToCart(
  env: BuyerServerEnv,
  params: { token?: string | null; variantId: number; quantity: number }
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
  params: { token?: string | null; variantId: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return removeCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, variantId: params.variantId });
}

/**
 * Resolve the website then fetch the current cart.
 * Token is optional (guest cart supported).
 */
export async function processGetCart(
  env: BuyerServerEnv,
  params: { token?: string | null }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return fetchCart({ baseUrl: env.apiUrl }, website, { token: params.token });
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

/** Resolve website then set the customer's default address. */
export async function processSetDefaultAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return setDefaultAddress({ baseUrl: env.apiUrl }, website, params);
}

/** Resolve website then delete a saved address. */
export async function processDeleteAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<void> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return deleteCustomerAddress({ baseUrl: env.apiUrl }, website, params);
}

// ---------------------------------------------------------------------------
// Storefront Analytics
// ---------------------------------------------------------------------------

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
