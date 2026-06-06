import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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
  const client = createStorefrontClient(config);
  return client.get<CustomerAddress[]>(StorefrontEndpoints.buyer.addresses(), {
    businessId: website.business_id,
    token: params.token,
    failPrefix: 'fetchCustomerAddresses failed',
  });
}

/** Save a new address to the customer's address book. */
export async function createCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; address: AddressInput }
): Promise<CustomerAddress> {
  const client = createStorefrontClient(config);
  return client.post<CustomerAddress>(
    StorefrontEndpoints.buyer.addresses(),
    params.address,
    {
      businessId: website.business_id,
      token: params.token,
      failLabel: 'createCustomerAddress failed',
    },
  );
}

/** Partially update a saved address. Only the fields included in `address` are changed. */
export async function updateCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number; address: Partial<AddressInput> }
): Promise<CustomerAddress> {
  const client = createStorefrontClient(config);
  return client.patch<CustomerAddress>(
    StorefrontEndpoints.buyer.address(params.addressId),
    params.address,
    {
      businessId: website.business_id,
      token: params.token,
      failLabel: 'updateCustomerAddress failed',
    },
  );
}

/** Delete a saved address. Throws if the address does not exist. */
export async function deleteCustomerAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<void> {
  const client = createStorefrontClient(config);
  await client.delete(StorefrontEndpoints.buyer.address(params.addressId), {
    businessId: website.business_id,
    token: params.token,
    failPrefix: 'deleteCustomerAddress failed',
  });
}

/** Mark an address as the customer's default. The previous default is unset automatically. */
export async function setDefaultAddress(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const client = createStorefrontClient(config);
  return client.post<CustomerAddress>(
    StorefrontEndpoints.buyer.defaultAddress(params.addressId),
    undefined,
    {
      businessId: website.business_id,
      token: params.token,
      failPrefix: 'setDefaultAddress failed',
    },
  );
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
  const client = createStorefrontClient(config);
  return client.get<UbigeoResult[]>(StorefrontEndpoints.catalog.ubigeos(), {
    query: { q: params.q },
    fallback: [],
  });
}
