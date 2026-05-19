export interface ProximaApiConfig {
  baseUrl: string;
  domain: string;
  path: string;
  websiteId?: string;
  businessId?: string;
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
  capabilities: Record<string, any>;
  theme_tokens: Record<string, any>;
  animation_config: Record<string, any>;
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

export async function fetchProximaWebsite(config: Pick<ProximaApiConfig, "baseUrl" | "domain"> & { host?: string }): Promise<ProximaWebsiteResponse> {
  const url = new URL("/api/v1/storefront/cms/websites/resolve", config.baseUrl);
  url.searchParams.set("host", config.host || config.domain);
  const response = await fetch(url);
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
    capabilities: {},
    theme_tokens: {},
    animation_config: {},
  };
}

export async function fetchProximaComposition(
  config: ProximaApiConfig,
  website: ProximaWebsiteResponse,
): Promise<ProximaCompositionResponse> {
  const url = new URL(`/api/v1/storefront/cms/websites/${website.id}/pages/composition`, config.baseUrl);
  url.searchParams.set("path", config.path);
  url.searchParams.set("locale", "es");
  url.searchParams.set("business_id", website.business_id);
  const response = await fetch(url, {
    headers: {
      "X-Business-ID": website.business_id,
      "Accept-Language": "es",
      "X-Currency": "PEN",
    },
  });
  if (!response.ok) {
    throw new Error(`Composition failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchProximaProducts(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
): Promise<ProximaProductListResponse> {
  const url = new URL("/api/v1/products", config.baseUrl);
  url.searchParams.set("size", "12");
  const response = await fetch(url, {
    headers: {
      "X-Business-ID": website.business_id,
      "Accept-Language": "es",
      "X-Currency": "PEN",
    },
  });
  if (!response.ok) {
    throw new Error(`Products failed: ${response.status}`);
  }
  return response.json();
}
