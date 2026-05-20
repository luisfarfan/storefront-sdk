## Context

Proxima storefronts (nova-gear, atelier, luma) are Astro SSR apps that consume `@proxima/storefront-core` for all API calls. The SDK exposes typed fetch helpers and server-side `process*` orchestrators that Astro API routes use as thin wrappers (~10 lines each). The backend has already shipped a complete address book REST API under `/api/v1/store/me/addresses`.

Currently `CheckoutRequest` accepts only a free-text `shipping_address` string. The backend now also accepts a saved `address_id`. Ubigeo (Peruvian geo-code) search already exists at `GET /api/v1/ubigeos?q=` and is public (no auth).

The `WebsiteCapabilities` type is currently `Record<string, any>` in `ProximaWebsiteResponse`, and each storefront app defines a narrower local `WebsiteCapabilities` type in `src/lib/types.ts`. Two new flags need to be added: `address_book` (enables the address book UI) and `checkout_ubigeo` (makes ubigeo required in checkout).

## Goals / Non-Goals

**Goals:**
- Add `CustomerAddress`, `UbigeoResult`, and `AddressInput` TypeScript types to `storefront-core`.
- Add six SDK functions: `fetchCustomerAddresses`, `createCustomerAddress`, `updateCustomerAddress`, `deleteCustomerAddress`, `setDefaultAddress`, `searchUbigeo`.
- Add `processSetDefaultAddress` and `processDeleteAddress` server helpers following the existing `process*` pattern.
- Extend `CheckoutRequest` with optional `address_id?: number | null`.
- Add `address_book` and `checkout_ubigeo` to each storefront's `WebsiteCapabilities` type.
- Add Astro UI components: `AddressBookView.astro`, `AddressFormView.astro`, updated `CheckoutView.astro`.
- Add four API route files per storefront app under `pages/api/buyer/address/`.
- Replicate UI and route changes across nova-gear, atelier, and luma.

**Non-Goals:**
- No backend changes — the API is already deployed.
- No changes to the guest checkout flow — `address_id` is purely optional.
- No real-time ubigeo validation on blur — search is triggered on demand.
- No pagination for the address list — the expected number of saved addresses per customer is small.
- No unit test infrastructure changes — existing test patterns apply.

## Decisions

### Follow the existing `process*` pattern for server helpers
All existing Astro API routes import a `process*` function from `storefront-core` and handle only cookies and redirects locally. New helpers (`processSetDefaultAddress`, `processDeleteAddress`) follow this exact pattern: accept `BuyerServerEnv` + typed params, call `fetchProximaWebsite` internally, call the underlying SDK function, return a typed result. This keeps route files at ~10 lines.

Alternative considered: let routes call SDK functions directly with `config` and `website`. Rejected because it duplicates the `fetchProximaWebsite` call in every route and diverges from the established pattern.

### API routes use POST-only with ID in form body
The existing buyer API routes (`pages/api/buyer/`) all use POST methods with form-encoded bodies, even for operations that semantically are DELETE or PATCH. This avoids CORS preflight complexity in Astro's SSR mode and keeps the pattern consistent. The four new address routes (`create.ts`, `update.ts`, `delete.ts`, `default.ts`) follow the same convention — `id` is passed as a hidden form field.

Alternative considered: use REST verbs (PATCH, DELETE). Rejected for consistency with existing route patterns.

### Ubigeo search is a direct SDK call from the client (no Astro API route)
`searchUbigeo` hits a public endpoint (`GET /api/v1/ubigeos?q=`) that requires no auth and no tenant header beyond `X-Business-ID`. The `AddressFormView.astro` component emits a `<script>` that calls the backend directly via `fetch` on keystroke (debounced). This avoids creating a proxy API route for a purely read-only public endpoint.

Alternative considered: add a `/api/ubigeos` proxy route. Rejected as unnecessary complexity for a public endpoint.

### Feature-flag gating via `capabilities.address_book`
`AddressBookView` and `AddressFormView` are only rendered when `capabilities.address_book === true`. The ubigeo field in `CheckoutView` is only shown and required when `capabilities.checkout_ubigeo === true`. This allows storefronts to be deployed without activating the feature until the merchant enables it from the Proxima dashboard.

### Types live in `storefront-core`, not in each storefront app
`CustomerAddress`, `UbigeoResult`, and `AddressInput` are exported from `packages/storefront-core/src/index.ts`, just like all other domain types. Storefront apps import from `@proxima/storefront-core`. Each app's `src/lib/types.ts` only defines the app-level narrowing (e.g., `WebsiteCapabilities`).

## Risks / Trade-offs

- **Ubigeo field UX inconsistency across storefronts** → Each storefront's `AddressFormView.astro` is a copy, not a shared component. Visual differences can drift. Mitigation: treat the nova-gear implementation as the reference and replicate verbatim initially; a future change can extract a shared component package.
- **Form-body ID passing is not type-safe** → The `delete.ts` and `default.ts` routes parse `id` from `FormData` as a string and convert to `number`. Invalid input returns a 400. Mitigation: validate and return a descriptive error message.
- **No optimistic UI** → Address list re-fetches from the server after each mutation (full page redirect or HTMX-style swap). For Astro SSR this is the default pattern; no client-side state management is added.
- **`address_id` in checkout coexists with `shipping_address`** → The backend accepts either or both. The UI should send `address_id` when a saved address is selected and omit `shipping_address` (or vice versa). If both are sent, backend precedence is defined by the API. Mitigation: document in code comments, send only one at a time from the UI.

## Migration Plan

1. Add types and SDK functions to `packages/storefront-core/src/index.ts` — no breaking changes, purely additive.
2. Add `address_book` and `checkout_ubigeo` to each storefront app's `WebsiteCapabilities` type — additive, optional fields.
3. Add `AddressBookView.astro` and `AddressFormView.astro` to nova-gear first, then replicate to atelier and luma.
4. Update `CheckoutView.astro` in all three apps to handle `address_id` and ubigeo flag.
5. Add the four `pages/api/buyer/address/*.ts` route files to all three apps.
6. No rollback concern — all new code is behind the `address_book` capability flag which defaults to false.
