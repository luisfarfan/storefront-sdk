export type WebsiteExportScope = 'cms' | 'catalog' | 'all';

export interface WebsiteExportOptions {
  apiUrl?: string;
  serviceKey?: string;
  fetchImpl?: typeof fetch;
}

export interface WebsiteExportRequest {
  websiteDomain: string;
  scope?: WebsiteExportScope;
  fixtureDomain?: string;
  catalogMaxProducts?: number;
  catalogIncludeClosure?: boolean;
}

export interface WebsiteExportMeta {
  exported_at: string;
  page_count: number;
  composition_keys: string[];
  fixture_domain?: string;
}

export interface WebsiteExportFixtures {
  website: Record<string, unknown>;
  shell: Record<string, unknown>;
  compositions: Record<string, Record<string, unknown>>;
  catalog_items?: unknown[];
  category_nav_tree?: Record<string, unknown>;
  category_products?: Record<string, string[]>;
  cart?: Record<string, unknown>;
}

export interface WebsiteExportResponse {
  export_schema_version: string;
  website_domain: string;
  scope: WebsiteExportScope;
  manifest: Record<string, unknown>;
  fixtures: WebsiteExportFixtures;
  meta: WebsiteExportMeta;
}
