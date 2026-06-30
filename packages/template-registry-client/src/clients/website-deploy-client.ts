import { WebsiteDeployClientError } from '../errors/website-deploy-client-error.js';
import { RegistryEndpoints } from '../api/endpoints.js';
import { BearerClient } from '../api/bearer-client.js';
import { normalizeApiUrl, redactToken } from '../internal/url.js';
import type {
  WebsiteDeployBreakingChange,
  WebsiteDeployManifest,
  WebsiteDeployOptions,
  WebsiteDeployResult,
} from '../types/website-deploy.js';

export class WebsiteDeployClient {
  private readonly http: BearerClient;
  private readonly serviceKey: string;

  constructor(options: WebsiteDeployOptions = {}) {
    const apiUrl = normalizeApiUrl(options.apiUrl ?? process.env['PROXIMA_API_URL']);
    const serviceKey = options.serviceKey ?? process.env['PROXIMA_SERVICE_KEY'] ?? '';

    if (!apiUrl) {
      throw new WebsiteDeployClientError('PROXIMA_API_URL is required');
    }
    if (!serviceKey) {
      throw new WebsiteDeployClientError('PROXIMA_SERVICE_KEY is required');
    }

    this.serviceKey = serviceKey;
    this.http = new BearerClient({
      baseUrl: apiUrl,
      bearer: serviceKey,
      fetchImpl: options.fetchImpl,
    });
  }

  async deploy(
    domain: string,
    manifest: WebsiteDeployManifest,
    options: { force?: boolean; autoScaffold?: boolean } = {},
  ): Promise<WebsiteDeployResult> {
    const path = RegistryEndpoints.admin.websitesDeploy({
      force: options.force,
      autoScaffold: options.autoScaffold,
    });
    const response = await this.http.fetchRaw(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify({
        website_domain: domain,
        section_types: manifest.section_types,
        pages: manifest.pages,
        shell_sections: manifest.shell_sections ?? [],
      }),
    });

    const text = await response.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (response.status === 409) {
      throw new WebsiteDeployClientError(
        (body['detail'] as string) ?? 'Breaking change detected. Re-run with --force to override.',
        {
          status: 409,
          responseText: redactToken(text, this.serviceKey),
          breakingChanges: body['breaking_changes'] as WebsiteDeployBreakingChange[] | undefined,
        },
      );
    }

    if (!response.ok) {
      throw new WebsiteDeployClientError(
        `Deploy request failed: POST ${path} -> ${response.status}`,
        {
          status: response.status,
          responseText: redactToken(text, this.serviceKey),
        },
      );
    }

    return body as unknown as WebsiteDeployResult;
  }
}
