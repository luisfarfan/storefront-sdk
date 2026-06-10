import { normalizeApiUrl } from '@proxima-io/template-registry-client';
import { AdminEndpoints } from './endpoints.js';
import { fetchWithRetry } from '../internal/fetch-retry.js';
import type { ManifestPublishResult } from '../types/template-structure.js';

export type AdminClientConfig = {
  apiUrl: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
};

function parseTemplateList(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const record = data as Record<string, unknown>;
  return (record.items ?? record.results ?? []) as Array<Record<string, unknown>>;
}

export class AdminClient {
  private readonly apiUrl: string;
  private readonly serviceKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AdminClientConfig) {
    this.apiUrl = normalizeApiUrl(config.apiUrl);
    this.serviceKey = config.serviceKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  url(path: string, query?: Record<string, string>): string {
    const url = new URL(path, this.apiUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.serviceKey}`,
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body !== undefined && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
    return fetchWithRetry(this.url(path), { ...init, headers }, 3, this.fetchImpl);
  }

  async checkTemplateExists(templateKey: string): Promise<{ existingId: string | null; response: Response }> {
    const response = await this.request(
      `${AdminEndpoints.cms.websiteTemplates()}?template_key=${encodeURIComponent(templateKey)}`,
    );

    if (!response.ok) {
      return { existingId: null, response };
    }

    const items = parseTemplateList(await response.json());
    const match = items.find((t) => t.template_key === templateKey);
    return { existingId: (match?.id as string | undefined) ?? null, response };
  }

  async upsertWebsiteTemplate(
    existingId: string | null,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    if (existingId) {
      return this.request(AdminEndpoints.cms.websiteTemplate(existingId), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
    return this.request(AdminEndpoints.cms.websiteTemplates(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async patchTemplateStructure(templateKey: string, structure: unknown): Promise<Response> {
    return this.request(AdminEndpoints.cms.templateStructure(templateKey), {
      method: 'PATCH',
      body: JSON.stringify({ structure }),
    });
  }

  async publishWebsiteTemplate(templateKey: string, body: Record<string, unknown>): Promise<Response> {
    return this.request(AdminEndpoints.cms.templatePublish(templateKey), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async parseJsonBody<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  static async parsePublishResult(response: Response): Promise<ManifestPublishResult> {
    return AdminClient.parseJsonBody<ManifestPublishResult>(response);
  }
}

export function createAdminClient(config: AdminClientConfig): AdminClient {
  return new AdminClient(config);
}
