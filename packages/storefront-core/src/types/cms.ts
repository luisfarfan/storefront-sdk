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
  data_mode?: string | null;
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
  shell_sections?: Record<
    string,
    {
      section_id: number;
      section_type: string;
      section_name: string;
      attributes: Record<string, any>;
    }
  >;
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