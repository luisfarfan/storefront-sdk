## ADDED Requirements

### Requirement: AddressBookView.astro component lists saved addresses
Each storefront app (nova-gear, atelier, luma) SHALL have an `AddressBookView.astro` component in `src/components/commerce/` that displays the authenticated customer's saved addresses. The component SHALL only be rendered when `capabilities.address_book === true`.

#### Scenario: Authenticated customer with saved addresses
- **WHEN** an authenticated customer navigates to the address book view
- **THEN** the page displays each address with: label, recipient name, phone, line1, line2, ubigeo full name, reference, and a "default" badge if `is_default` is true

#### Scenario: No saved addresses
- **WHEN** an authenticated customer has no saved addresses
- **THEN** the page displays an empty state with a prompt to add the first address

#### Scenario: Each address has edit and delete actions
- **WHEN** the address list is rendered
- **THEN** each address card shows an "Edit" link (navigates to the edit form) and a "Delete" button (posts to `/api/buyer/address/delete`)

#### Scenario: Each address has a "Set as default" action
- **WHEN** an address in the list does not have `is_default: true`
- **THEN** a "Set as default" button is shown that posts to `/api/buyer/address/default`

#### Scenario: "Add new address" button is present
- **WHEN** the address list is rendered
- **THEN** an "Add new address" button or link is shown that navigates to the address creation form

### Requirement: AddressFormView.astro component handles create and edit
Each storefront app SHALL have an `AddressFormView.astro` component in `src/components/commerce/` that renders a form for creating a new address or editing an existing one.

#### Scenario: Create mode — empty form
- **WHEN** the form is rendered without an existing address
- **THEN** all fields are empty and submission POSTs to `/api/buyer/address/create`

#### Scenario: Edit mode — pre-filled form
- **WHEN** the form is rendered with an existing `CustomerAddress` passed as a prop
- **THEN** all fields are pre-filled with the address values and submission POSTs to `/api/buyer/address/update` with the address `id` in a hidden field

#### Scenario: Ubigeo search widget
- **WHEN** the user types in the ubigeo search field
- **THEN** a debounced fetch call to `/api/v1/ubigeos?q=<query>` (via `searchUbigeo`) returns suggestions displayed as a dropdown, and selecting one populates `ubigeo_code` and shows the `full_name`

#### Scenario: Form fields
- **WHEN** the form is rendered
- **THEN** it includes fields for: `label`, `recipient_name`, `phone`, `line1`, `line2`, `ubigeo_code` (via search widget), `reference`

#### Scenario: Form validation — line1 is required
- **WHEN** the user submits the form without filling in `line1`
- **THEN** the form shows a validation error and does not submit

### Requirement: CheckoutView.astro shows saved address selector when address_book is enabled
Each storefront app's `CheckoutView.astro` SHALL render a "Use saved address" dropdown when `capabilities.address_book === true` and the customer is authenticated with at least one saved address.

#### Scenario: Address book enabled — dropdown shown
- **WHEN** `capabilities.address_book` is true and the customer has saved addresses
- **THEN** a dropdown of saved addresses is shown above the manual address fields; selecting one populates the hidden `address_id` field and the checkout form submits with `address_id`

#### Scenario: Address book enabled — no saved addresses
- **WHEN** `capabilities.address_book` is true but the customer has no saved addresses
- **THEN** the dropdown is not shown (or shows empty state) and the manual address field is displayed normally

#### Scenario: Address book disabled — no dropdown
- **WHEN** `capabilities.address_book` is false or undefined
- **THEN** the checkout form behaves identically to the pre-change behavior (no address selector shown)

#### Scenario: checkout_ubigeo enabled — ubigeo field is required
- **WHEN** `capabilities.checkout_ubigeo` is true
- **THEN** the checkout form includes a ubigeo search field that is required for submission; `ubigeo_code` is submitted as part of the checkout form data

#### Scenario: checkout_ubigeo disabled — ubigeo field not shown
- **WHEN** `capabilities.checkout_ubigeo` is false or undefined
- **THEN** the checkout form does not include a ubigeo field and behavior is identical to pre-change

### Requirement: Address API route — create.ts handles POST /api/buyer/address/create
Each storefront app SHALL have `src/pages/api/buyer/address/create.ts` that accepts a POST request with address form fields, calls `createCustomerAddress` (or the equivalent process helper), and redirects to the address book on success.

#### Scenario: Successful address creation
- **WHEN** a POST request is received with valid address fields and a valid buyer token cookie
- **THEN** the address is created via the SDK and the response redirects to the address book page

#### Scenario: Unauthenticated request
- **WHEN** a POST request is received without a valid buyer token
- **THEN** the response redirects to the login page

#### Scenario: Validation error from API
- **WHEN** the backend returns a 422 error
- **THEN** the route returns a 400 response or redirects back with an error message

### Requirement: Address API route — update.ts handles POST /api/buyer/address/update
Each storefront app SHALL have `src/pages/api/buyer/address/update.ts` that accepts a POST with `id` and address fields, calls `updateCustomerAddress`, and redirects to the address book on success.

#### Scenario: Successful address update
- **WHEN** a POST request is received with a valid `id`, updated fields, and a valid buyer token
- **THEN** the address is updated via the SDK and the response redirects to the address book page

#### Scenario: Invalid address ID
- **WHEN** the `id` field is missing or not a valid integer
- **THEN** the route returns a 400 response

### Requirement: Address API route — delete.ts handles POST /api/buyer/address/delete
Each storefront app SHALL have `src/pages/api/buyer/address/delete.ts` that accepts a POST with `id`, calls `deleteCustomerAddress` (or `processDeleteAddress`), and redirects to the address book on success.

#### Scenario: Successful address deletion
- **WHEN** a POST request is received with a valid `id` and a valid buyer token
- **THEN** the address is deleted via the SDK and the response redirects to the address book page

#### Scenario: Unauthenticated request
- **WHEN** a POST request is received without a valid buyer token
- **THEN** the response redirects to the login page

### Requirement: Address API route — default.ts handles POST /api/buyer/address/default
Each storefront app SHALL have `src/pages/api/buyer/address/default.ts` that accepts a POST with `id`, calls `setDefaultAddress` (or `processSetDefaultAddress`), and redirects to the address book on success.

#### Scenario: Successful default address assignment
- **WHEN** a POST request is received with a valid `id` and a valid buyer token
- **THEN** the address is set as default via the SDK and the response redirects to the address book page

#### Scenario: Unauthenticated request
- **WHEN** a POST request is received without a valid buyer token
- **THEN** the response redirects to the login page
