import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontBusinessProfile>(StorefrontEndpoints.business.profile(), {
    query: { business_id: businessId },
    failPrefix: 'Business profile fetch failed',
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontCampaign[]>(StorefrontEndpoints.campaigns.list(), {
    query: { business_id: businessId },
    failPrefix: 'Campaigns fetch failed',
  });
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
  const client = createStorefrontClient(config);
  return client.get<StorefrontCampaign | null>(StorefrontEndpoints.campaigns.bySlug(slug), {
    query: { business_id: businessId },
    notFound: 'null',
    failPrefix: 'Campaign fetch failed',
  });
}

/**
 * Fetch the merchant's enabled payment methods. Tenant-wide — call once per
 * request and cache on `Astro.locals` so the footer reads from memory.
 *
 * Backed by `GET /storefront/payment-instructions` (public storefront
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
  const client = createStorefrontClient(config);
  const data = await client.get<{ items?: StorefrontPaymentMethod[] }>(
    StorefrontEndpoints.commerce.paymentInstructions(),
    { businessId, failPrefix: 'Payment methods fetch failed' },
  );
  return data.items ?? [];
}

/** List all websites for a service-key authenticated caller. Useful for build-time scripts. */
export async function fetchProximaWebsiteList(config: Pick<ProximaApiConfig, "baseUrl" | "serviceKey">): Promise<ProximaWebsiteResponse[]> {
  const client = createStorefrontClient(config);
  return client.get<ProximaWebsiteResponse[]>(StorefrontEndpoints.cms.websites(), {
    failPrefix: 'Website list failed',
  });
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
  const client = createStorefrontClient(config);
  return client.get<ProximaWebsiteResponse>(StorefrontEndpoints.cms.resolveWebsite(), {
    query: { host: config.host || config.domain },
    failPrefix: 'Website resolve failed',
  });
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
  const client = createStorefrontClient(config);
  return client.get<ProximaCompositionResponse>(
    StorefrontEndpoints.cms.composition(website.id),
    {
      businessId: website.business_id,
      locale,
      currency,
      query: {
        path: config.path,
        locale,
        business_id: website.business_id,
        variant_id: config.variantId,
        preview_token: config.previewToken,
      },
      failPrefix: 'Composition failed',
    },
  );
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
  const client = createStorefrontClient(config);
  return client.get<ProximaProductListResponse>(StorefrontEndpoints.catalog.legacyProducts(), {
    businessId: website.business_id,
    locale: website.locale ?? "es",
    currency: website.currency ?? "PEN",
    query: { size: 12 },
    failPrefix: 'Products failed',
  });
}
