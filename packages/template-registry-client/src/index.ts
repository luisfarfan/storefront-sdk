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

export interface RegistryRequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}

export class RegistryClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;

  constructor(message: string, options: { status?: number; responseText?: string } = {}) {
    super(message);
    this.name = "RegistryClientError";
    this.status = options.status;
    this.responseText = options.responseText;
  }
}

export class TemplateRegistryClient {
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RegistryClientOptions = {}) {
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? process.env.PROXIMA_API_URL);
    this.token = options.token ?? process.env.PROXIMA_API_TOKEN ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.apiUrl) {
      throw new RegistryClientError("PROXIMA_API_URL is required");
    }
    if (!this.token) {
      throw new RegistryClientError("PROXIMA_API_TOKEN is required");
    }
  }

  async listAdminTemplates(): Promise<WebsiteTemplateRecord[]> {
    return this.request("/api/v1/admin/cms/website-templates");
  }

  async listCatalogTemplates(): Promise<WebsiteTemplateRecord[]> {
    return this.request("/api/v1/storefront/cms/website-templates");
  }

  async findTemplate(input: { templateKey?: string | null; slug?: string | null }): Promise<WebsiteTemplateRecord | null> {
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
    return this.request("/api/v1/admin/cms/website-templates", { method: "POST", body: payload });
  }

  async updateTemplate(templateId: string, payload: unknown): Promise<WebsiteTemplateRecord> {
    return this.request(`/api/v1/admin/cms/website-templates/${templateId}`, { method: "PATCH", body: payload });
  }

  async patchDeployment(templateId: string, deploymentConfig: Record<string, unknown>): Promise<WebsiteTemplateRecord> {
    return this.updateTemplate(templateId, { deployment_config: deploymentConfig });
  }

  async publishTemplate(templateId: string): Promise<WebsiteTemplateRecord> {
    return this.updateTemplate(templateId, { publication_status: "published" });
  }

  async previewTemplate(templateId: string, path = "/", locale = "es"): Promise<unknown> {
    const params = new URLSearchParams({ path, locale });
    return this.request(`/api/v1/storefront/cms/website-templates/${templateId}/preview?${params.toString()}`);
  }

  async isVisibleInCatalog(templateId: string): Promise<boolean> {
    const catalog = await this.listCatalogTemplates();
    return catalog.some((template) => template.id === templateId);
  }

  private async request<T = any>(pathname: string, options: RegistryRequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const response = await this.fetchImpl(`${this.apiUrl}${pathname}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new RegistryClientError(`Registry request failed: ${method} ${pathname} -> ${response.status}`, {
        status: response.status,
        responseText: redactToken(text, this.token),
      });
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

export function normalizeApiUrl(value?: string): string {
  return (value ?? "").replace(/\/$/u, "");
}

export function redactToken(value: string, token: string): string {
  return token ? value.split(token).join("[REDACTED]") : value;
}

// ---------------------------------------------------------------------------
// WebsiteDeployClient — deploys section types + page scaffolding to a specific
// website. Uses PROXIMA_SERVICE_KEY (not PROXIMA_API_TOKEN).
// ---------------------------------------------------------------------------

export interface WebsiteDeployOptions {
  /** Base URL of the Proxima API. Default: process.env.PROXIMA_API_URL */
  apiUrl?: string;
  /** Service key for the website's business. Default: process.env.PROXIMA_SERVICE_KEY */
  serviceKey?: string;
  /** Optional fetch override (for testing). */
  fetchImpl?: typeof fetch;
}

export interface WebsiteDeployResult {
  ok: boolean;
  website: { id: number; domain: string };
  section_types: { created: string[]; updated: string[]; unchanged: string[] };
  pages: {
    created: string[];
    scaffolded: Record<string, string[]>;
    skipped: Record<string, string>;
  };
  warnings: string[];
}

export interface WebsiteDeployBreakingChange {
  section_type: string;
  attribute: string;
  change: string;
  from: string;
  to: string;
}

export class WebsiteDeployClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;
  readonly breakingChanges?: WebsiteDeployBreakingChange[];

  constructor(
    message: string,
    options: {
      status?: number;
      responseText?: string;
      breakingChanges?: WebsiteDeployBreakingChange[];
    } = {},
  ) {
    super(message);
    this.name = "WebsiteDeployClientError";
    this.status = options.status;
    this.responseText = options.responseText;
    this.breakingChanges = options.breakingChanges;
  }
}

export class WebsiteDeployClient {
  private readonly apiUrl: string;
  private readonly serviceKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WebsiteDeployOptions = {}) {
    this.apiUrl = normalizeApiUrl(options.apiUrl ?? process.env["PROXIMA_API_URL"]);
    this.serviceKey = options.serviceKey ?? process.env["PROXIMA_SERVICE_KEY"] ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (!this.apiUrl) {
      throw new WebsiteDeployClientError("PROXIMA_API_URL is required");
    }
    if (!this.serviceKey) {
      throw new WebsiteDeployClientError("PROXIMA_SERVICE_KEY is required");
    }
  }

  async deploy(
    domain: string,
    manifest: { section_types: unknown[]; pages: unknown[]; shell_sections?: unknown[] },
    options: { force?: boolean } = {},
  ): Promise<WebsiteDeployResult> {
    const url = `${this.apiUrl}/api/v1/admin/cms/websites/deploy${options.force ? "?force=true" : ""}`;

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
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
        (body["detail"] as string) ?? "Breaking change detected. Re-run with --force to override.",
        {
          status: 409,
          responseText: redactToken(text, this.serviceKey),
          breakingChanges: body["breaking_changes"] as WebsiteDeployBreakingChange[] | undefined,
        },
      );
    }

    if (!response.ok) {
      throw new WebsiteDeployClientError(
        `Deploy request failed: POST /api/v1/admin/cms/websites/deploy -> ${response.status}`,
        {
          status: response.status,
          responseText: redactToken(text, this.serviceKey),
        },
      );
    }

    return body as unknown as WebsiteDeployResult;
  }
}
