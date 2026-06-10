# Proposal — Storefront Analytics Full (SDK)

## Why

`@proxima-io/storefront-core` expone un cliente analytics mínimo (5 event types) que no alinea con el `EventType` completo de proxima-api, no envía **`X-Session-ID`** (rompiendo funnels por sesión), y apunta al endpoint legacy **`/api/v1/store/events`**. Los storefronts necesitan un SDK tipado, consent-aware, y estable para emitir el catálogo completo de eventos sin copy-paste por app.

## What Changes

### Fase 0 — Cliente infra (**BREAKING** menor: endpoint path)

- Cambiar `StorefrontEndpoints.analytics.events()` → `/api/v1/storefront/events`.
- En `analytics.flush()`, enviar header **`X-Session-ID`** desde config (`sessionId` resolver).
- Nuevo helper `resolveAnalyticsSessionId()` — prioridad: config explícita → cookie `cart_session_id` → `localStorage` UUID estable `pxa_analytics_session`.
- Extender `StorefrontAnalyticsConfig` con `sessionId?: string` y `getSessionId?: () => string | null`.
- Bump minor `@proxima-io/storefront-core`.

### Fase 1 — Tipos alineados con API (eventos existentes)

Extender `StorefrontEventType`:

```ts
| 'checkout_started'
| 'category_view'
| 'brand_view'
| 'not_found_page_viewed'
| 'checkout_completed'  // opcional alias; prefer order_completed en storefront
```

Payload helpers tipados por evento (sin romper `[key: string]: unknown`).

### Fase 2 — Tipos nuevos (requiere API fase 2)

```ts
| 'cart_view'
| 'remove_from_cart'
| 'checkout_error'
| 'filter_applied'
| 'sort_changed'
| 'promotion_view'
| 'wishlist_add'
| 'login_completed'
| `register_completed`
```

### Fase 3 — DX

- Export `createStorefrontAnalyticsTrackers()` factory opcional (thin wrappers).
- README sección "Analytics + cookie consent" con patrón beacon recomendado.
- Tests: flush headers, session resolver, consent gating (ya parcial).

## Capabilities

### New Capabilities

- `storefront-analytics-client`: endpoint, session, tipos, consent, flush/beacon.

### Modified Capabilities

- (ninguna en `openspec/specs/` vivas del SDK monorepo)

## Impact

- `packages/storefront-core/src/analytics/analytics.ts`
- `packages/storefront-core/src/types/analytics.ts`
- `packages/storefront-core/src/api/endpoints.ts`
- Nuevo `packages/storefront-core/src/analytics/session.ts`
- Tests vitest + README

## Coordinación cross-repo

| Fase | Depende de |
|------|------------|
| 0 | API `/storefront/events` live |
| 1 | Storefronts beacons |
| 2 | API enum fase 2 desplegado |
| 3 | Docs storefronts |

| Repo | Change |
|------|--------|
| proxima-api | `openspec/changes/storefront-analytics-full/` |
| proxima-storefront-sdk | Este change |
| proxima-storefronts | `openspec/changes/storefront-analytics-full/` |
