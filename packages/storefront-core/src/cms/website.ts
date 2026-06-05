import type {
  ProximaApiConfig,
  ProximaCompositionResponse,
  ProximaProductListResponse,
  ProximaWebsiteResponse,
} from '../types/cms.js';
import type {
  StorefrontBusinessProfile,
  StorefrontCampaign,
  StorefrontPaymentMethod,
} from '../types/business.js';

export async function fetchBusinessProfile(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontBusinessProfile> {
  const url = new URL("/api/v1/storefront/business/profile", config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Business profile fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Fetch all active campaigns for a tenant. An "active" campaign is
 * `is_active=true` AND (active_until is null OR active_until > now).
 * Scheduled-but-not-yet-started campaigns are included so the storefront
 * can render teasers ("Empieza en X días"); filter by `active_from` if
 * you only want strictly-live ones.
 */
export async function fetchCampaigns(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontCampaign[]> {
  const url = new URL("/api/v1/storefront/campaigns", config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Campaigns fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Fetch a single campaign by slug. Returns null if the campaign doesn't
 * exist or is no longer active — sections pinned to a specific campaign
 * (e.g. a hero hardcoded to 'black-week-2026') use this to detect when
 * to fall back to their generic copy.
 */
export async function fetchCampaignBySlug(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
  slug: string,
): Promise<StorefrontCampaign | null> {
  const url = new URL(`/api/v1/storefront/campaigns/${encodeURIComponent(slug)}`, config.baseUrl);
  url.searchParams.set("business_id", businessId);
  const headers: Record<string, string> = {};
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Campaign fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Fetch the merchant's enabled payment methods. Tenant-wide — call once per
 * request and cache on `Astro.locals` so the footer reads from memory.
 *
 * Backed by `GET /store/commerce/payment-instructions` (public storefront
 * endpoint — same surface used by the checkout flow).
 *
 * @example
 * const methods = await fetchPaymentMethods(
 *   { baseUrl: env.apiUrl, serviceKey: env.serviceKey },
 *   website.business_id,
 * );
 */
export async function fetchPaymentMethods(
  config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">,
  businessId: string,
): Promise<StorefrontPaymentMethod[]> {
  const url = new URL("/api/v1/store/commerce/payment-instructions", config.baseUrl);
  const headers: Record<string, string> = {
    "X-Business-ID": businessId,
  };
  if (config.serviceKey) headers["Authorization"] = `Bearer ${config.serviceKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Payment methods fetch failed: ${response.status}`);
  const data = await response.json() as { items?: StorefrontPaymentMethod[] };
  return data.items ?? [];
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