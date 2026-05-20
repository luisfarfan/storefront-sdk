## Why

Customers on Proxima storefronts currently have no way to save or reuse shipping addresses — every checkout requires re-entering address details manually. The backend has implemented the full address book API, so now the SDK and storefront apps need types, functions, and UI to expose this capability to shoppers.

## What Changes

- **New TypeScript types** in `packages/storefront-core/src/index.ts`: `CustomerAddress`, `UbigeoResult`, `AddressInput`
- **New SDK functions** for address CRUD: `fetchCustomerAddresses`, `createCustomerAddress`, `updateCustomerAddress`, `deleteCustomerAddress`, `setDefaultAddress`, and `searchUbigeo`
- **Updated `CheckoutRequest` type** to accept optional `address_id?: number | null`
- **Updated `WebsiteCapabilities` type** in each storefront app's `src/lib/types.ts` to add `address_book?: boolean` and `checkout_ubigeo?: boolean`
- **New server helpers** `processSetDefaultAddress` and `processDeleteAddress` added to the `BuyerServerEnv` pattern
- **New Astro UI components** in storefront apps: `AddressBookView.astro`, `AddressFormView.astro` (with ubigeo search), and updates to `CheckoutView.astro`
- **New API route handlers** in storefront apps under `pages/api/buyer/address/`: `create.ts`, `update.ts`, `delete.ts`, `default.ts`

## Capabilities

### New Capabilities

- `address-book-sdk`: New TypeScript types (`CustomerAddress`, `UbigeoResult`, `AddressInput`), six SDK functions for address management and ubigeo search, `CheckoutRequest.address_id` extension, new server helpers, and `WebsiteCapabilities` flag additions in `packages/storefront-core`.
- `address-book-ui`: Astro components (`AddressBookView`, `AddressFormView`) and updated `CheckoutView` for storefronts (nova-gear, atelier, luma), plus API route handlers under `pages/api/buyer/address/`.

### Modified Capabilities

## Impact

- `packages/storefront-core/src/index.ts`: new types and functions exported; `CheckoutRequest` type gets `address_id` field
- `apps/nova-gear/src/components/commerce/`: new `AddressBookView.astro` and `AddressFormView.astro`; updated `CheckoutView.astro`
- `apps/nova-gear/src/pages/api/buyer/address/`: new route files (`create.ts`, `update.ts`, `delete.ts`, `default.ts`)
- `apps/nova-gear/src/lib/types.ts`: `WebsiteCapabilities` updated
- Same component/route/type changes replicated to `apps/atelier/` and `apps/luma/`
- No breaking changes to existing checkout flow — all new fields are optional; feature is gated behind `capabilities.address_book`
