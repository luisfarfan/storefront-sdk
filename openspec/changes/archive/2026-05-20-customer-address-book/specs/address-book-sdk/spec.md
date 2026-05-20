## ADDED Requirements

### Requirement: CustomerAddress type is exported from storefront-core
`packages/storefront-core/src/index.ts` SHALL export a `CustomerAddress` interface that exactly mirrors the backend address object shape, including all optional fields and the nested `ubigeo` object.

#### Scenario: Type is importable by storefront apps
- **WHEN** a storefront app imports `CustomerAddress` from `@proxima/storefront-core`
- **THEN** TypeScript resolves the type with fields: `id: number`, `label?: string | null`, `recipient_name?: string | null`, `phone?: string | null`, `line1: string`, `line2?: string | null`, `ubigeo_code?: string | null`, `ubigeo?: { code: string; department: string; province: string; district: string; full_name: string } | null`, `reference?: string | null`, `is_default: boolean`, `created_at: string`

### Requirement: UbigeoResult type is exported from storefront-core
`packages/storefront-core/src/index.ts` SHALL export a `UbigeoResult` interface for ubigeo search results returned by `GET /api/v1/ubigeos?q=`.

#### Scenario: Type covers all ubigeo search result fields
- **WHEN** a storefront app imports `UbigeoResult` from `@proxima/storefront-core`
- **THEN** TypeScript resolves the type with fields: `code: string`, `department: string`, `province: string`, `district: string`, `full_name: string`

### Requirement: AddressInput type is exported from storefront-core
`packages/storefront-core/src/index.ts` SHALL export an `AddressInput` interface representing the writable fields for creating or updating an address.

#### Scenario: AddressInput covers all mutable address fields
- **WHEN** a storefront app imports `AddressInput` from `@proxima/storefront-core`
- **THEN** TypeScript resolves the type with fields: `label?: string | null`, `recipient_name?: string | null`, `phone?: string | null`, `line1: string`, `line2?: string | null`, `ubigeo_code?: string | null`, `reference?: string | null`

### Requirement: fetchCustomerAddresses SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `fetchCustomerAddresses(config, { token })` that calls `GET /api/v1/store/me/addresses` with a Bearer token and returns `Promise<CustomerAddress[]>`.

#### Scenario: Successful address list retrieval
- **WHEN** called with a valid token and config
- **THEN** returns an array of `CustomerAddress` objects from the backend response

#### Scenario: Unauthenticated request throws
- **WHEN** called with an invalid or expired token
- **THEN** throws an error with `status: 401`

### Requirement: createCustomerAddress SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `createCustomerAddress(config, { token, address: AddressInput })` that calls `POST /api/v1/store/me/addresses` and returns `Promise<CustomerAddress>`.

#### Scenario: Successful address creation
- **WHEN** called with a valid token and a complete `AddressInput` (at minimum `line1`)
- **THEN** returns the newly created `CustomerAddress` with a server-assigned `id`

#### Scenario: Missing required field throws
- **WHEN** called without `line1` in the address input
- **THEN** throws an error with `status: 422`

### Requirement: updateCustomerAddress SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `updateCustomerAddress(config, { token, addressId: number, address: Partial<AddressInput> })` that calls `PATCH /api/v1/store/me/addresses/{id}` and returns `Promise<CustomerAddress>`.

#### Scenario: Successful address update
- **WHEN** called with a valid token, existing `addressId`, and a partial `AddressInput`
- **THEN** returns the updated `CustomerAddress` with changed fields reflected

#### Scenario: Address not found throws
- **WHEN** called with an `addressId` that does not belong to the authenticated customer
- **THEN** throws an error with `status: 404`

### Requirement: deleteCustomerAddress SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `deleteCustomerAddress(config, { token, addressId: number })` that calls `DELETE /api/v1/store/me/addresses/{id}` and returns `Promise<void>`.

#### Scenario: Successful address deletion
- **WHEN** called with a valid token and an existing `addressId`
- **THEN** resolves without returning a value and the address is removed on the backend

#### Scenario: Address not found throws
- **WHEN** called with an `addressId` that does not exist for the customer
- **THEN** throws an error with `status: 404`

### Requirement: setDefaultAddress SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `setDefaultAddress(config, { token, addressId: number })` that calls `POST /api/v1/store/me/addresses/{id}/default` and returns `Promise<CustomerAddress>`.

#### Scenario: Successful default address assignment
- **WHEN** called with a valid token and an existing `addressId`
- **THEN** returns the updated `CustomerAddress` with `is_default: true`

#### Scenario: Only one address is default at a time
- **WHEN** setDefaultAddress is called for address B while address A is already the default
- **THEN** the returned address B has `is_default: true` (backend enforces single default)

### Requirement: searchUbigeo SDK function is exported
`packages/storefront-core/src/index.ts` SHALL export `searchUbigeo(config, { q: string })` that calls `GET /api/v1/ubigeos?q=<q>` without authentication and returns `Promise<UbigeoResult[]>`.

#### Scenario: Successful ubigeo search
- **WHEN** called with a non-empty query string
- **THEN** returns an array of `UbigeoResult` objects matching the query

#### Scenario: Empty query returns empty array or all results
- **WHEN** called with an empty string `q: ""`
- **THEN** returns an array (may be empty or a default list, as determined by the backend)

### Requirement: CheckoutRequest accepts optional address_id
The `CheckoutRequest` interface in `packages/storefront-core/src/index.ts` SHALL include an optional `address_id?: number | null` field, allowing callers to reference a saved customer address.

#### Scenario: Checkout with saved address ID
- **WHEN** `createOrder` is called with `checkout.address_id` set to a valid address ID
- **THEN** the `address_id` field is included in the POST body sent to `/api/v1/checkout`

#### Scenario: Checkout without address_id is backward-compatible
- **WHEN** `createOrder` is called without `checkout.address_id`
- **THEN** the request body is identical to the pre-change behavior (no `address_id` key or `null`)

### Requirement: processSetDefaultAddress server helper is exported
`packages/storefront-core/src/index.ts` SHALL export `processSetDefaultAddress(env: BuyerServerEnv, params: { token: string; addressId: number })` that resolves the website and delegates to `setDefaultAddress`, returning `Promise<CustomerAddress>`.

#### Scenario: Helper resolves website and calls setDefaultAddress
- **WHEN** called with a valid `BuyerServerEnv` and params
- **THEN** internally calls `fetchProximaWebsite` then `setDefaultAddress` and returns the result

### Requirement: processDeleteAddress server helper is exported
`packages/storefront-core/src/index.ts` SHALL export `processDeleteAddress(env: BuyerServerEnv, params: { token: string; addressId: number })` that resolves the website and delegates to `deleteCustomerAddress`, returning `Promise<void>`.

#### Scenario: Helper resolves website and calls deleteCustomerAddress
- **WHEN** called with a valid `BuyerServerEnv` and params
- **THEN** internally calls `fetchProximaWebsite` then `deleteCustomerAddress` and resolves

### Requirement: WebsiteCapabilities type in storefront apps includes address_book and checkout_ubigeo flags
Each storefront app's `src/lib/types.ts` SHALL include `address_book?: boolean` and `checkout_ubigeo?: boolean` in its `WebsiteCapabilities` interface (or equivalent type).

#### Scenario: address_book flag is typed and optional
- **WHEN** a storefront app reads `capabilities.address_book` from the website response
- **THEN** TypeScript resolves it as `boolean | undefined` with no type error

#### Scenario: checkout_ubigeo flag is typed and optional
- **WHEN** a storefront app reads `capabilities.checkout_ubigeo` from the website response
- **THEN** TypeScript resolves it as `boolean | undefined` with no type error
