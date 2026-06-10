import { normalizeApiUrl, redactToken } from '../internal/url.js';
import type { RegistryRequestMethod, RegistryRequestOptions } from '../types/registry.js';

export type BearerClientConfig = {
  baseUrl: string;
  bearer: string;
  fetchImpl?: typeof fetch;
};

export type BearerRequestError = Error & {
  status?: number;
  responseText?: string;
};

export type BearerErrorFactory = (
  method: RegistryRequestMethod,
  path: string,
  status: number,
  responseText: string,
  bearer: string,
) => BearerRequestError;

export class BearerClient {
  private readonly baseUrl: string;
  private readonly bearer: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BearerClientConfig) {
    this.baseUrl = normalizeApiUrl(config.baseUrl);
    this.bearer = config.bearer;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async request<T>(
    path: string,
    options: RegistryRequestOptions = {},
    createError: BearerErrorFactory,
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const response = await this.fetchImpl(this.url(path), {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.bearer}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw createError(method, path, response.status, redactToken(text, this.bearer), this.bearer);
    }

    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  async fetchRaw(path: string, init: RequestInit): Promise<Response> {
    return this.fetchImpl(this.url(path), init);
  }
}

export function createBearerClient(config: BearerClientConfig): BearerClient {
  return new BearerClient(config);
}
