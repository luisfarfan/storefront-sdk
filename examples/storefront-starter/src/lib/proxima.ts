import { fetchProximaWebsite } from '@proxima-io/storefront-core';
import type { ProximaWebsiteResponse } from '@proxima-io/storefront-core';

export const proximaConfig = {
  baseUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_DOMAIN,
  serviceKey: import.meta.env.PROXIMA_SERVICE_KEY,
};

// Cache simple en memoria — en producción puedes usar Redis o LRU cache
let websiteCache: ProximaWebsiteResponse | null = null;

/**
 * Obtiene los datos del website del tenant.
 * Cacheado en memoria para no hacer una llamada extra en cada request.
 */
export async function getWebsite(): Promise<ProximaWebsiteResponse> {
  if (websiteCache) return websiteCache;
  websiteCache = await fetchProximaWebsite(proximaConfig);
  return websiteCache;
}
