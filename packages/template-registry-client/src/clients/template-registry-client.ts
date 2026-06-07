import { RegistryClientError } from '../errors/registry-client-error.js';
import { RegistryEndpoints } from '../api/endpoints.js';
import { BearerClient } from '../api/bearer-client.js';
import type {
  RegistryClientOptions,
  RegistryRequestMethod,
  WebsiteTemplateRecord,
} from '../types/registry.js';
import { normalizeApiUrl } from '../internal/url.js';

function registryErrorFactory(
  method: RegistryRequestMethod,
  path: string,
  status: number,
  responseText: string,
): RegistryClientError {
  return new RegistryClientError(`Registry request failed: ${method} ${path} -> ${status}`, {
    status,
    responseText,
  });
}

export class TemplateRegistryClient {
  private readonly http: BearerClient;

  constructor(options: RegistryClientOptions = {}) {
    const apiUrl = normalizeApiUrl(options.apiUrl ?? process.env.PROXIMA_API_URL);
    const token = options.token ?? process.env.PROXIMA_API_TOKEN ?? '';

    if (!apiUrl) {
      throw new RegistryClientError('PROXIMA_API_URL is required');
    }
    if (!token) {
      throw new RegistryClientError('PROXIMA_API_TOKEN is required');
    }

    this.http = new BearerClient({
      baseUrl: apiUrl,
      bearer: token,
      fetchImpl: options.fetchImpl,
    });
  }

  async listAdminTemplates(): Promise<WebsiteTemplateRecord[]> {
    return this.http.request(RegistryEndpoints.admin.websiteTemplates(), {}, registryErrorFactory);
  }

  async listCatalogTemplates(): Promise<WebsiteTemplateRecord[]> {
    return this.http.request(RegistryEndpoints.storefront.websiteTemplates(), {}, registryErrorFactory);
  }

  async findTemplate(input: {
    templateKey?: string | null;
    slug?: string | null;
  }): Promise<WebsiteTemplateRecord | null> {
    const templates = await this.listAdminTemplates();
    if (input.templateKey) {
      const byTemplateKey = templates.find((template) => template.template_key === input.templateKey);
      if (byTemplateKey) {
        return byTemplateKey;
      }
    }
    if (input.slug) {
      const bySlug = templates.find((template) => template.slug === input.slug);
      if (bySlug) {
        return bySlug;
      }
    }
    return null;
  }

  async createTemplate(payload: unknown): Promise<WebsiteTemplateRecord> {
    return this.http.request(
      RegistryEndpoints.admin.websiteTemplates(),
      { method: 'POST', body: payload },
      registryErrorFactory,
    );
  }

  async updateTemplate(templateId: string, payload: unknown): Promise<WebsiteTemplateRecord> {
    return this.http.request(
      RegistryEndpoints.admin.websiteTemplate(templateId),
      { method: 'PATCH', body: payload },
      registryErrorFactory,
    );
  }

  async patchDeployment(templateId: string, deploymentConfig: Record<string, unknown>): Promise<WebsiteTemplateRecord> {
    return this.updateTemplate(templateId, { deployment_config: deploymentConfig });
  }

  async publishTemplate(templateId: string): Promise<WebsiteTemplateRecord> {
    return this.updateTemplate(templateId, { publication_status: 'published' });
  }

  async previewTemplate(templateId: string, path = '/', locale = 'es'): Promise<unknown> {
    const params = new URLSearchParams({ path, locale });
    return this.http.request(
      RegistryEndpoints.storefront.websiteTemplatePreview(templateId, params.toString()),
      {},
      registryErrorFactory,
    );
  }

  async isVisibleInCatalog(templateId: string): Promise<boolean> {
    const catalog = await this.listCatalogTemplates();
    return catalog.some((template) => template.id === templateId);
  }
}
