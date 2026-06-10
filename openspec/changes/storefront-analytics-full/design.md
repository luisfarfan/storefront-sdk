## Context

El SDK es la única dependencia npm que los storefronts Astro usan para analytics. Cookie consent (`cookie-consent/consent.ts`) ya gatea `analytics.init()`. Falta completar transporte y tipos.

## Goals / Non-Goals

**Goals:**

- Un `analytics.init(config, { requireAnalyticsConsent: true })` production-ready.
- Session ID automático sin boilerplate en cada app.
- Tipos TS = union completa acordada con API.

**Non-Goals:**

- React/Vue adapters (Astro only).
- Server-side analytics proxy en storefront (client → API directo).

## Architecture

```
BaseLayout SSR
  └─ #pxa-analytics-config JSON

bootAnalytics() [storefront init-client]
  └─ analytics.init(config, { requireAnalyticsConsent: true })
       └─ resolveSessionId() → X-Session-ID on flush

Domain
  └─ track.ts wrappers OR analytics.track() direct

Page events
  └─ SSR beacons consumed by consumePageBeacons()
```

## Session Resolution

```ts
export function resolveAnalyticsSessionId(opts?: {
  cookieName?: string;       // default cart_session_id
  storageKey?: string;       // default pxa_analytics_session
}): string
```

1. `config.sessionId` if set
2. `config.getSessionId?.()` if returns non-null
3. Cookie `cart_session_id` (non-httpOnly readable — verify tech-store)
4. `localStorage[pxa_analytics_session]` or create UUID v4

Persist created UUID in localStorage (essential cookie territory — document in privacy policy).

## Flush Changes

```ts
headers: {
  'Content-Type': 'application/json',
  'X-Business-ID': config.businessId,
  'X-Session-ID': resolveAnalyticsSessionId(config),
}
```

sendBeacon: Blob cannot set custom headers easily — **use fetch keepalive** for hidden flush when session header required; fall back beacon only if session in query (not recommended). **Decision:** visibility flush uses `fetch` + headers; beacon path same if API accepts (verify — may drop session on beacon; prefer fetch keepalive always).

## Type Extensions

File: `types/analytics.ts`

- Expand `StorefrontEventType` union (tiers A + B).
- Optional discriminated helpers:

```ts
export type StorefrontAnalyticsEvent =
  | { type: 'product_view'; payload: ProductViewPayload }
  | { type: 'add_to_cart'; payload: AddToCartPayload }
  ...
```

## Versioning

- **0.8.0** — fase 0 + tier A types
- **0.8.1** — tier B types (post API deploy)

## Testing

- Mock fetch: assert URL ends with `/storefront/events`
- Assert `X-Session-ID` header present
- Consent denied → no fetch
- Consent granted → preInitQueue replay

## Risks

sendBeacon without headers — **remove beacon-only path** or document session loss. Recommend unified `fetch(..., { keepalive: true })`.
