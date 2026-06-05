import { apiError, authHeaders, cartHeaders } from '../internal/http.js';
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
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token) },
    body: JSON.stringify(params.checkout),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's order history, paginated. */
export async function fetchOrders(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; page?: number; size?: number }
): Promise<OrderListResponse> {
  const url = new URL("/api/v1/store/me/orders", config.baseUrl);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.size) url.searchParams.set("size", String(params.size));
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch a single order by ID. Works for authenticated customers and guests with the receipt token. */
export async function fetchOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; orderId: string }
): Promise<Order> {
  const url = new URL(`/api/v1/orders/${params.orderId}`, config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}