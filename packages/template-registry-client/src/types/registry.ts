export interface RegistryClientOptions {
  apiUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface WebsiteTemplateRecord {
  id: string;
  slug?: string | null;
  template_key?: string | null;
  publication_status?: string;
  deployment_config?: Record<string, unknown>;
  repository_config?: Record<string, unknown>;
  [key: string]: unknown;
}

export type RegistryRequestMethod = 'GET' | 'POST' | 'PATCH';

export interface RegistryRequestOptions {
  method?: RegistryRequestMethod;
  body?: unknown;
}
