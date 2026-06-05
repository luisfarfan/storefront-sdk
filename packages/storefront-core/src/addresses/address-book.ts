import { authHeaders } from '../internal/http.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type { AddressInput, CustomerAddress, UbigeoResult } from '../types/address.js';

// ---------------------------------------------------------------------------
// Address Book
// ---------------------------------------------------------------------------

/** Fetch all saved addresses for the authenticated customer. */
export async function fetchCustomerAddresses(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<CustomerAddress[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`fetchCustomerAddresses failed: ${res.status}`);
  return res.json();
}

/** Save a new address to the customer's address book. */
export async function createCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; address: AddressInput }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("createCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Partially update a saved address. Only the fields included in `address` are changed. */
export async function updateCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number; address: Partial<AddressInput> }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.address),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("updateCustomerAddress failed"), { status: res.status, detail: err.detail });
  }
  return res.json();
}

/** Delete a saved address. Throws if the address does not exist. */
export async function deleteCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}`, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`deleteCustomerAddress failed: ${res.status}`);
}

/** Mark an address as the customer's default. The previous default is unset automatically. */
export async function setDefaultAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const res = await fetch(`${config.baseUrl}/api/v1/store/me/addresses/${params.addressId}/default`, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw new Error(`setDefaultAddress failed: ${res.status}`);
  return res.json();
}

/**
 * Search Peruvian ubigeo codes (department/province/district) by name.
 * Use this to power the address form's location selector.
 * Returns an empty array on error instead of throwing.
 */
export async function searchUbigeo(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { q: string }
): Promise<UbigeoResult[]> {
  const res = await fetch(`${config.baseUrl}/api/v1/catalog/locations/ubigeos?q=${encodeURIComponent(params.q)}`);
  if (!res.ok) return [];
  return res.json();
}