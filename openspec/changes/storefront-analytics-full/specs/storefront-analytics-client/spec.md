# storefront-analytics-client Specification

## Purpose

Define the `@proxima-io/storefront-core` analytics client contract: types, transport, session attribution, and cookie-consent gating.

## ADDED Requirements

### Requirement: Post events to storefront ingest path

The analytics client SHALL POST batches to `/api/v1/storefront/events` relative to configured `apiUrl`.

#### Scenario: Flush URL

- **WHEN** `apiUrl` is `https://api.proxima.pe` and queue is flushed
- **THEN** request URL SHALL be `https://api.proxima.pe/api/v1/storefront/events`

### Requirement: Send business and session headers

Every flush SHALL include:

- `X-Business-ID: {businessId}` from config
- `X-Session-ID: {uuid}` from session resolver

#### Scenario: Session from resolver

- **GIVEN** cart cookie `cart_session_id=550e8400-e29b-41d4-a716-446655440000`
- **WHEN** analytics flushes
- **THEN** `X-Session-ID` header SHALL match that UUID

### Requirement: Support full tier-A event type union

`StorefrontEventType` SHALL include at minimum:

`page_view`, `product_view`, `category_view`, `brand_view`, `search`, `add_to_cart`, `checkout_started`, `order_completed`, `not_found_page_viewed`.

#### Scenario: Track category view

- **WHEN** `analytics.track('category_view', { category_slug: 'gpu' })` before init
- **THEN** event SHALL queue and replay after init

### Requirement: Support tier-B event types after API deploy

`StorefrontEventType` SHALL extend with tier-B types when API enum is available.

### Requirement: Respect analytics cookie consent

When `init(config, { requireAnalyticsConsent: true })` and consent not granted, the client SHALL NOT flush events until consent grants analytics.

#### Scenario: Reject then accept

- **WHEN** user rejects cookies then later accepts
- **THEN** `resumeFromConsent()` SHALL initialize and flush queued events

### Requirement: Auto page_view on init and navigation

The client SHALL emit `page_view` on init and on `astro:page-load` when initialized.

#### Scenario: SPA navigation

- **WHEN** Astro view transition completes
- **THEN** one `page_view` event is queued

### Requirement: Session resolver helper exported

The package SHALL export `resolveAnalyticsSessionId()` for storefronts that need explicit session wiring.

#### Scenario: Stable session across reloads

- **WHEN** no cart cookie exists
- **THEN** resolver creates UUID stored in `localStorage` key `pxa_analytics_session`
- **AND** returns same UUID on subsequent calls
