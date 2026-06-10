# Analytics — `@proxima-io/storefront-core`

Client-side analytics for Proxima storefronts: typed events, batch transport, session funnels, GDPR-style cookie consent, and first-touch marketing attribution (UTMs + ad click IDs).

**Storefront wiring reference (beacons, layout, store hooks):** `proxima-storefronts/apps/tech-store/docs/analytics.md`

---

## Transport

| Item | Value |
|------|--------|
| Endpoint | `POST {apiUrl}/api/v1/storefront/events` |
| Body | `{ "events": [ { event_type, occurred_at, website_id, path, referrer?, locale?, payload } ] }` |
| Headers | `Content-Type: application/json`, **`X-Business-ID`**, **`X-Session-ID`** |
| Flush | Batch every `flushInterval` ms (default **3000**); `fetch(..., { keepalive: true })` on tab hide |

The legacy path **`/api/v1/store/events`** is removed — do not reference it in new code.

---

## Quick start

```ts
import { analytics } from '@proxima-io/storefront-core';

// Call once from your layout client boot (after SSR injects config):
analytics.init(
  {
    apiUrl: 'https://api.proxima.io',
    websiteId: 'uuid-website',
    businessId: 'uuid-business',
    locale: 'es',
    sessionId: 'uuid-from-ssr-cart-cookie', // optional but recommended
    flushInterval: 3000,
    debug: false,
  },
  { requireAnalyticsConsent: true },
);

// Anywhere client-side:
analytics.track('product_view', {
  product_slug: 'rtx-4090',
  product_id: '42',
  price: 8999,
});
```

- **`page_view`** fires automatically on init and on every `astro:page-load` (View Transitions).
- Events queued **before** `init()` replay when the client starts — safe to call `track()` early.
- With `requireAnalyticsConsent: true`, nothing flushes until the shopper accepts analytics cookies; `resumeFromConsent()` runs automatically when consent is granted.

---

## Session ID (`X-Session-ID`)

Export: `resolveAnalyticsSessionId(config?, options?)`  
Storage key: `ANALYTICS_SESSION_STORAGE_KEY` (`pxa_analytics_session`)

Resolution order:

1. `config.sessionId` (SSR — e.g. httpOnly cart cookie read server-side)
2. `config.getSessionId()` callback
3. Readable guest cart cookie (`cart_session_id` by default, overridable via `cartSessionCookieName`)
4. `localStorage` UUID (created on first use)

Pass the cart session from SSR whenever possible so analytics sessions align with cart/checkout funnels.

---

## Cookie consent

Exports from `@proxima-io/storefront-core` (`cookie-consent/consent.js`):

| Helper | Purpose |
|--------|---------|
| `readCookieConsent()` | Current consent state or `null` |
| `hasCookieConsentDecision()` | User has chosen accept/reject |
| `isAnalyticsConsentGranted()` | Analytics category allowed |
| `isMarketingConsentGranted()` | Marketing category allowed |
| `acceptAllCookieConsent()` | Accept analytics + marketing |
| `rejectNonEssentialCookieConsent()` | Essential only |
| `writeCookieConsent({ analytics, marketing })` | Custom choice |
| `onCookieConsentChanged(listener)` | Subscribe to changes (analytics client uses this to call `resumeFromConsent()`) |

Pattern:

```ts
analytics.init(config, { requireAnalyticsConsent: true });
// Banner UI calls acceptAllCookieConsent() or rejectNonEssentialCookieConsent()
// → analytics resumes automatically; no manual analytics.init() retry needed
```

---

## Marketing attribution

First-touch UTMs and ad click IDs are captured once per browser tab session and merged into **every** event payload as `payload.attribution`.

Exports:

| Helper | Purpose |
|--------|---------|
| `captureSessionAttribution()` | Read landing URL + referrer; persist snapshot |
| `getSessionAttribution()` | Return stored snapshot (captures on first call) |
| `clearSessionAttribution()` | Test helper — clears `localStorage` |
| `inferAttributionFromReferrer(referrer)` | Organic/social fallback when UTMs absent |
| `ATTRIBUTION_STORAGE_KEY` | `pxa_session_attribution` |

Captured from landing URL:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `gclid`, `fbclid`, `msclkid`
- `landing_path`, `landing_referrer`

If no `utm_source` but `document.referrer` is present, the SDK infers channel (e.g. `google` / `organic`, `facebook` / `social`).

Admin query: `GET /admin/analytics/traffic` → `campaign_sources[]` grouped by source/medium/campaign.

---

## Event catalog

All values of `StorefrontEventType`:

| Event | Typical payload fields |
|-------|------------------------|
| `page_view` | _(auto — path/referrer on envelope)_ |
| `product_view` | `product_slug`, `product_id?`, `product_name?`, `price?` |
| `category_view` | `category_slug`, `category_name?` |
| `brand_view` | `brand_slug`, `brand_name?` |
| `search` | `query`, `results_count` |
| `add_to_cart` | `product_slug`, `variant_id`, `quantity?`, `price?`, … |
| `remove_from_cart` | same family as add |
| `cart_view` | `item_count`, `cart_total?` |
| `checkout_started` | `item_count`, `cart_total?` |
| `checkout_completed` | order fields |
| `checkout_error` | `error_code`, `step?` |
| `order_completed` | `order_id`, `order_total?` |
| `not_found_page_viewed` | `requested_path?` |
| `filter_applied` | `filter_type`, `filter_value`, `pathname?` |
| `sort_changed` | `sort`, `pathname?` |
| `promotion_view` | `promotion_slug`, `section_type?`, `badge_text?` |
| `wishlist_add` | product fields |
| `login_completed` | `method?` |
| `register_completed` | `method?` |

Every payload may include **`attribution`** (`SessionAttributionPayload`) when a landing snapshot exists.

Typed helpers (optional): `ProductViewPayload`, `AddToCartPayload`, `CheckoutStartedPayload`.

---

## Recommended storefront architecture

Do **not** scatter `analytics.track()` across button handlers. Prefer:

1. **SSR config JSON** in layout (`#pxa-analytics-config`) — `apiUrl`, `websiteId`, `businessId`, `sessionId`, `locale`
2. **Declarative beacons** — hidden `data-pxa-beacon` nodes for SSR-known data (PDP slug, search query + count, order total)
3. **Domain store choke points** — cart mutations in one module (`addToCart` / `removeFromCart`)

Disable analytics when:

- `PROXIMA_DATA_MODE=fixtures` or template demo host
- CMS Builder preview (`cmsPreview === true`)

See tech-store for the full matrix and validation checklist.

---

## API surface

```ts
class ProximaAnalytics {
  init(config: StorefrontAnalyticsConfig, options?: StorefrontAnalyticsInitOptions): void;
  resumeFromConsent(): void;
  track(type: StorefrontEventType, payload?: StorefrontEventPayload): void;
  flush(beacon?: boolean): void;
  destroy(): void;
}

export const analytics: ProximaAnalytics;
```

`StorefrontAnalyticsConfig`:

```ts
{
  apiUrl: string;
  websiteId: string;
  businessId: string;
  locale?: string;
  flushInterval?: number;
  debug?: boolean;
  sessionId?: string;
  getSessionId?: () => string | null | undefined;
  cartSessionCookieName?: string;
}
```

---

## Testing

Unit tests live in `packages/storefront-core/test/analytics.test.ts` and `attribution.test.ts`.

Smoke in browser (live merchant):

1. Accept cookie consent → Network shows `POST …/storefront/events` with `X-Session-ID`
2. Land with `?utm_source=…` → subsequent events include `payload.attribution`
3. Funnel: PDP → add_to_cart → checkout_started → order_completed
