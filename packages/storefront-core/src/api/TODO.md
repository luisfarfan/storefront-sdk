# API endpoints — pending verification

Items to confirm against `proxima-api` before closing the storefront namespace migration.

- [x] **`payment-instructions`** — removed from SDK; payment methods ship in website resolve shell footer (`payment_methods` attribute).
- [x] **Analytics ingest** — `POST /api/v1/storefront/events` (see `docs/13-analytics.md`; legacy `/api/v1/store/events` removed).
- [ ] **`GET /api/v1/catalog/locations/ubigeos`** (`searchUbigeo`) — Legacy catalog path. Is there a storefront equivalent or does this stay?
- [ ] **Cart item path `{id}`** — SDK passes `variantId` in `/storefront/cart/items/{id}`. Confirm backend expects variant id vs cart line item id.
- [ ] **`GET /api/v1/products`** (`fetchProximaProducts`, deprecated) — Remove when no consumers remain; use `/storefront/products`.
- [ ] **Missing SDK helpers** (API exists, no helper yet): `POST /storefront/checkout/direct`, `GET /storefront/products/{slug}`, `GET /storefront/link-picker`, `GET /storefront/link-validate`, `GET /storefront/pages/{page_key}`.
