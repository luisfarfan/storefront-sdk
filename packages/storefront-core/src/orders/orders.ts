import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type { CheckoutRequest } from '../types/cart.js';
import type { Order, OrderListResponse } from '../types/order.js';

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Submit the current cart as an order (checkout). The cart must be non-empty.
 * On success the cart is cleared. Throws 400 on validation errors (e.g. out of stock).
 */
export async function createOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; checkout: CheckoutRequest }
): Promise<Order> {
  const client = createStorefrontClient(config);
  return client.post<Order>(StorefrontEndpoints.checkout(), params.checkout, {
    businessId: website.business_id,
    token: params.token,
  });
}

/** Fetch the authenticated customer's order history, paginated. */
export async function fetchOrders(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; page?: number; size?: number }
): Promise<OrderListResponse> {
  const client = createStorefrontClient(config);
  return client.get<OrderListResponse>(StorefrontEndpoints.buyer.orders(), {
    businessId: website.business_id,
    token: params.token,
    query: { page: params.page, size: params.size },
  });
}

/** Fetch a single order by ID. Works for authenticated customers and guests with the receipt token. */
export async function fetchOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; orderId: string }
): Promise<Order> {
  const client = createStorefrontClient(config);
  return client.get<Order>(StorefrontEndpoints.orders.byId(params.orderId), {
    businessId: website.business_id,
    token: params.token,
  });
}
