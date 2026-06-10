import { WebsiteExportClientError } from '../errors/website-export-client-error.js';
import { RegistryEndpoints } from '../api/endpoints.js';
import { BearerClient } from '../api/bearer-client.js';
import { normalizeApiUrl, redactToken } from '../internal/url.js';
import type {
  WebsiteExportOptions,
  WebsiteExportRequest,
  WebsiteExportResponse,
} from '../types/website-export.js';

export class WebsiteExportClient {
  private readonly http: BearerClient;
  private readonly serviceKey: string;

  constructor(options: WebsiteExportOptions = {}) {
    const apiUrl = normalizeApiUrl(options.apiUrl ?? process.env['PROXIMA_API_URL']);
    const serviceKey = options.serviceKey ?? process.env['PROXIMA_SERVICE_KEY'] ?? '';

    if (!apiUrl) {
      throw new WebsiteExportClientError('PROXIMA_API_URL is required');
    }
    if (!serviceKey) {
      throw new WebsiteExportClientError('PROXIMA_SERVICE_KEY is required');
    }

    this.serviceKey = serviceKey;
    this.http = new BearerClient({
      baseUrl: apiUrl,
      bearer: serviceKey,
      fetchImpl: options.fetchImpl,
    });
  }

  async export(request: WebsiteExportRequest): Promise<WebsiteExportResponse> {
    const path = RegistryEndpoints.admin.websitesExport({
      websiteDomain: request.websiteDomain,
      scope: request.scope ?? 'cms',
      fixtureDomain: request.fixtureDomain,
      catalogMaxProducts: request.catalogMaxProducts,
      catalogIncludeClosure: request.catalogIncludeClosure,
    });

    const response = await this.http.fetchRaw(path, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
      },
    });

    const text = await response.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (!response.ok) {
      const detail = typeof body['detail'] === 'string' ? body['detail'] : undefined;
      throw new WebsiteExportClientError(
        detail ?? `Export request failed: GET ${path} -> ${response.status}`,
        {
          status: response.status,
          responseText: redactToken(text, this.serviceKey),
        },
      );
    }

    return body as unknown as WebsiteExportResponse;
  }
}
