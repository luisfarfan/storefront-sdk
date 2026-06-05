import type { ProximaCompositionResponse, ProximaWebsiteResponse } from '../types/cms.js';

// ---------------------------------------------------------------------------
// In-process SWR cache — compositions + website config
// ---------------------------------------------------------------------------
// One set of singletons per Node.js process = one per storefront (single-tenant).
// The Proxima API calls POST /api/cache/invalidate on every Builder save to flush
// the relevant entries; TTL ensures eventual freshness if the webhook is missed.
//
// Usage in resolver.ts:
//   import { compositionCache, websiteCache, invalidateByScope } from "@proxima-io/storefront-core";
//
// Usage in src/pages/api/cache/invalidate.ts:
//   import { handleCacheInvalidateWebhook } from "@proxima-io/storefront-core";
//   export const POST: APIRoute = ({ request }) =>
//     handleCacheInvalidateWebhook(request, import.meta.env.PROXIMA_WEBHOOK_SECRET);
// ---------------------------------------------------------------------------

interface _CacheEntry<T> { data: T; expiresAt: number }

class _TtlCache<T> {
  private readonly store = new Map<string, _CacheEntry<T>>();
  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

/** In-process cache for website config (shell, theme, capabilities). TTL: 5 min. */
export const websiteCache = new _TtlCache<ProximaWebsiteResponse>(5 * 60_000);

/** In-process cache for CMS compositions (page sections). TTL: 60 s. */
export const compositionCache = new _TtlCache<ProximaCompositionResponse>(60_000);

/**
 * Flush cache entries by scope — mirrors the payload sent by `StorefrontWebhookNotifier`:
 *   "composition" + path  → flush that page's composition
 *   "website"             → flush website config + all compositions (they depend on it)
 *   "all"                 → flush everything
 */
export function invalidateByScope(scope: string, path?: string): void {
  if (scope === "composition" && path) {
    compositionCache.delete(path);
  } else if (scope === "website") {
    websiteCache.clear();
    compositionCache.clear();
  } else {
    websiteCache.clear();
    compositionCache.clear();
  }
}

/**
 * Handle the POST /api/cache/invalidate webhook from the Proxima API.
 * Drop this into your Astro route:
 *
 *   export const POST: APIRoute = ({ request }) =>
 *     handleCacheInvalidateWebhook(request, import.meta.env.PROXIMA_WEBHOOK_SECRET);
 */
export async function handleCacheInvalidateWebhook(
  request: Request,
  secret?: string,
): Promise<Response> {
  if (secret) {
    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: { scope?: string; path?: string } = {};
  try { body = await request.json(); } catch { /* empty body → treat as "all" */ }

  invalidateByScope(body.scope ?? "all", body.path);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}