## 1. SDK Types

- [x] 1.1 Add `CustomerAddress` interface to `packages/storefront-core/src/index.ts` with all fields from the backend address object shape
- [x] 1.2 Add `UbigeoResult` interface to `packages/storefront-core/src/index.ts` with fields: `code`, `department`, `province`, `district`, `full_name`
- [x] 1.3 Add `AddressInput` interface to `packages/storefront-core/src/index.ts` with the writable address fields
- [x] 1.4 Add `address_id?: number | null` to the existing `CheckoutRequest` interface

## 2. SDK Functions

- [x] 2.1 Implement `fetchCustomerAddresses(config, { token })` — calls `GET /api/v1/store/me/addresses` with Bearer token, returns `Promise<CustomerAddress[]>`
- [x] 2.2 Implement `createCustomerAddress(config, { token, address: AddressInput })` — calls `POST /api/v1/store/me/addresses`, returns `Promise<CustomerAddress>`
- [x] 2.3 Implement `updateCustomerAddress(config, { token, addressId, address: Partial<AddressInput> })` — calls `PATCH /api/v1/store/me/addresses/{id}`, returns `Promise<CustomerAddress>`
- [x] 2.4 Implement `deleteCustomerAddress(config, { token, addressId })` — calls `DELETE /api/v1/store/me/addresses/{id}`, returns `Promise<void>`
- [x] 2.5 Implement `setDefaultAddress(config, { token, addressId })` — calls `POST /api/v1/store/me/addresses/{id}/default`, returns `Promise<CustomerAddress>`
- [x] 2.6 Implement `searchUbigeo(config, { q })` — calls `GET /api/v1/ubigeos?q=<q>` (no auth), returns `Promise<UbigeoResult[]>`

## 3. SDK Server Helpers

- [x] 3.1 Implement `processSetDefaultAddress(env: BuyerServerEnv, { token, addressId })` following existing `process*` pattern — resolves website and calls `setDefaultAddress`, returns `Promise<CustomerAddress>`
- [x] 3.2 Implement `processDeleteAddress(env: BuyerServerEnv, { token, addressId })` — resolves website and calls `deleteCustomerAddress`, returns `Promise<void>`
- [x] 3.3 Export all new types and functions from `packages/storefront-core/src/index.ts`

## 4. WebsiteCapabilities Type Updates

- [x] 4.1 Add `address_book?: boolean` and `checkout_ubigeo?: boolean` to `WebsiteCapabilities` in `apps/nova-gear/src/lib/types.ts`
- [x] 4.2 Add same flags to `WebsiteCapabilities` in `apps/atelier/src/lib/types.ts`
- [x] 4.3 Add same flags to `WebsiteCapabilities` in `apps/luma/src/lib/types.ts`

## 5. UI Components — nova-gear

- [x] 5.1 Create `apps/nova-gear/src/components/commerce/AddressBookView.astro` — fetches and lists customer addresses, shows edit/delete/set-default actions per card and "add new" button; renders empty state when no addresses
- [x] 5.2 Create `apps/nova-gear/src/components/commerce/AddressFormView.astro` — create/edit form with all address fields; includes ubigeo search widget (debounced fetch to `searchUbigeo`) with dropdown for selection; pre-fills fields in edit mode; posts to create or update route
- [x] 5.3 Update `apps/nova-gear/src/components/commerce/CheckoutView.astro` — add saved address dropdown (rendered only when `capabilities.address_book === true` and customer has addresses); populate hidden `address_id` field on selection; add ubigeo search field (required only when `capabilities.checkout_ubigeo === true`)

## 6. API Routes — nova-gear

- [x] 6.1 Create `apps/nova-gear/src/pages/api/buyer/address/create.ts` — parse form body, call `createCustomerAddress` (using `processCreateAddress` or direct SDK call), redirect to address book on success; redirect to login if unauthenticated; return 400 on validation error
- [x] 6.2 Create `apps/nova-gear/src/pages/api/buyer/address/update.ts` — parse `id` + address fields from form body, call `updateCustomerAddress`, redirect to address book on success; return 400 if `id` is missing or invalid
- [x] 6.3 Create `apps/nova-gear/src/pages/api/buyer/address/delete.ts` — parse `id` from form body, call `processDeleteAddress`, redirect to address book on success; redirect to login if unauthenticated; return 400 if `id` invalid
- [x] 6.4 Create `apps/nova-gear/src/pages/api/buyer/address/default.ts` — parse `id` from form body, call `processSetDefaultAddress`, redirect to address book on success; redirect to login if unauthenticated; return 400 if `id` invalid

## 7. UI Components — atelier

- [x] 7.1 Replicate `AddressBookView.astro` to `apps/atelier/src/components/commerce/AddressBookView.astro`
- [x] 7.2 Replicate `AddressFormView.astro` to `apps/atelier/src/components/commerce/AddressFormView.astro`
- [x] 7.3 Update `apps/atelier/src/components/commerce/CheckoutView.astro` with saved address dropdown and ubigeo field (same changes as nova-gear)

## 8. API Routes — atelier

- [x] 8.1 Create `apps/atelier/src/pages/api/buyer/address/create.ts`
- [x] 8.2 Create `apps/atelier/src/pages/api/buyer/address/update.ts`
- [x] 8.3 Create `apps/atelier/src/pages/api/buyer/address/delete.ts`
- [x] 8.4 Create `apps/atelier/src/pages/api/buyer/address/default.ts`

## 9. UI Components — luma

- [x] 9.1 Replicate `AddressBookView.astro` to `apps/luma/src/components/commerce/AddressBookView.astro`
- [x] 9.2 Replicate `AddressFormView.astro` to `apps/luma/src/components/commerce/AddressFormView.astro`
- [x] 9.3 Update `apps/luma/src/components/commerce/CheckoutView.astro` with saved address dropdown and ubigeo field (same changes as nova-gear)

## 10. API Routes — luma

- [x] 10.1 Create `apps/luma/src/pages/api/buyer/address/create.ts`
- [x] 10.2 Create `apps/luma/src/pages/api/buyer/address/update.ts`
- [x] 10.3 Create `apps/luma/src/pages/api/buyer/address/delete.ts`
- [x] 10.4 Create `apps/luma/src/pages/api/buyer/address/default.ts`
