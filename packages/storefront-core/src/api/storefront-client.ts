import { apiError } from '../internal/http.js';

export type StorefrontClientConfig = {
  baseUrl: string;
  serviceKey?: string;
  fetch?: typeof fetch;
};

export type StorefrontRequestContext = {
  businessId?: string;
  locale?: string;
  currency?: string;
  token?: string | null;
  sessionId?: string | null;
  serviceKey?: string;
};

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type StorefrontRequestOptions = StorefrontRequestContext & {
  query?: QueryParams;
  headers?: Record<string, string>;
  /** Return null on 404 instead of throwing */
  notFound?: 'null';
  /** Plain Error: `${failPrefix}: ${status}` */
  failPrefix?: string;
  /** Address-style: Object.assign(new Error(failLabel), { status, detail }) */
  failLabel?: string;
  /** Do not throw on non-OK responses */
  ignoreErrors?: boolean;
  /** Return fallback on any non-OK response (e.g. ubigeo search) */
  fallback?: unknown;
};

type JsonRequestOptions = StorefrontRequestOptions & {
  body?: unknown;
};

function appendQuery(url: URL, query?: QueryParams): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
}

function buildHeaders(
  clientServiceKey: string | undefined,
  opts: StorefrontRequestOptions & { withJsonBody?: boolean },
): Record<string, string> {
  const headers: Record<string, string> = { ...opts.headers };

  if (opts.withJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (opts.businessId) {
    headers['X-Business-ID'] = opts.businessId;
  }
  if (opts.locale) {
    headers['Accept-Language'] = opts.locale;
  }
  if (opts.currency) {
    headers['X-Currency'] = opts.currency;
  }

  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  } else {
    const serviceKey = opts.serviceKey ?? clientServiceKey;
    if (serviceKey) {
      headers['Authorization'] = `Bearer ${serviceKey}`;
    }
  }

  if (opts.sessionId && !opts.token) {
    headers['X-Session-ID'] = opts.sessionId;
  }

  return headers;
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function handleErrorResponse(
  response: Response,
  opts: StorefrontRequestOptions,
): Promise<never> {
  const data = await response.json().catch(() => ({}));

  if (opts.failLabel) {
    throw Object.assign(new Error(opts.failLabel), {
      status: response.status,
      detail: (data as { detail?: unknown }).detail,
    });
  }

  if (opts.failPrefix) {
    throw new Error(`${opts.failPrefix}: ${response.status}`);
  }

  throw apiError(response.status, data);
}

export class StorefrontClient {
  private readonly baseUrl: string;
  private readonly serviceKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: StorefrontClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.serviceKey = config.serviceKey;
    this.fetchImpl = config.fetch ?? fetch;
  }

  url(path: string, query?: QueryParams): URL {
    const url = new URL(path, this.baseUrl);
    appendQuery(url, query);
    return url;
  }

  async request<T>(
    method: string,
    path: string,
    opts: JsonRequestOptions = {},
  ): Promise<T> {
    const url = this.url(path, opts.query);
    const init: RequestInit = {
      method,
      headers: buildHeaders(this.serviceKey, {
        ...opts,
        withJsonBody: opts.body !== undefined,
      }),
    };

    if (opts.body !== undefined) {
      init.body = JSON.stringify(opts.body);
    }

    const response = await this.fetchImpl(url, init);

    if (opts.ignoreErrors) {
      return parseJsonBody<T>(response);
    }

    if (response.status === 404 && opts.notFound === 'null') {
      return null as T;
    }

    if (!response.ok) {
      if (opts.fallback !== undefined) {
        return opts.fallback as T;
      }
      return handleErrorResponse(response, opts);
    }

    return parseJsonBody<T>(response);
  }

  get<T>(path: string, opts?: StorefrontRequestOptions): Promise<T> {
    return this.request<T>('GET', path, opts);
  }

  post<T>(path: string, body?: unknown, opts?: StorefrontRequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...opts, body });
  }

  patch<T>(path: string, body?: unknown, opts?: StorefrontRequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...opts, body });
  }

  delete<T>(path: string, opts?: StorefrontRequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, opts);
  }
}

export function createStorefrontClient(
  config: Pick<StorefrontClientConfig, 'baseUrl' | 'serviceKey' | 'fetch'>,
): StorefrontClient {
  return new StorefrontClient(config);
}
