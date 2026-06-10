## 0. Scaffolding

- [ ] 0.1 Read API `EventType` + ingest router path
- [ ] 0.2 Read tech-store `@/lib/analytics` partial implementation on main

## 1. Phase 0 — Transport & session (**ship first**)

- [ ] 1.1 `StorefrontEndpoints.analytics.events()` → `/api/v1/storefront/events`
- [ ] 1.2 Add `src/analytics/session.ts` — `resolveAnalyticsSessionId()`
- [ ] 1.3 Extend `StorefrontAnalyticsConfig` with session options
- [ ] 1.4 `flush()`: headers `X-Business-ID`, `X-Session-ID`
- [ ] 1.5 Replace sendBeacon-only path with fetch keepalive for session headers
- [ ] 1.6 Unit tests: URL, headers, session resolver, consent gate
- [ ] 1.7 Bump version 0.8.0 + README
- [ ] 1.8 `npm run build && npm test`

## 2. Phase 1 — Tier A types

- [ ] 2.1 Extend `StorefrontEventType` union (checkout_started, category_view, brand_view, not_found_page_viewed)
- [ ] 2.2 Optional typed payload interfaces
- [ ] 2.3 Export from barrel `index.ts`
- [ ] 2.4 Tests track() accepts new types

## 3. Phase 2 — Tier B types (after API enum)

- [ ] 3.1 Extend union with tier-B events
- [ ] 3.2 Bump 0.8.1
- [x] 3.3 README event catalog table — see `docs/13-analytics.md`

## 4. Phase 3 — DX (optional)

- [ ] 4.1 `createStorefrontAnalyticsTrackers()` factory
- [x] 4.2 JSDoc on consent + session for template authors

## 5. Coordination

- [ ] 5.1 Verify tech-store smoke after publish
- [ ] 5.2 Note breaking-ish endpoint change in CHANGELOG
