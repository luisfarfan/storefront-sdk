import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import { GuestOrderError, type GuestOrderPayload, type GuestOrderResult } from '../types/guest-order.js';

/**
 * Create an order without buyer authentication.
 * The cart is identified by `session_id` (from the storefront session cookie).
 * Throws `GuestOrderError` for typed error cases.
 */
export async function initiateGuestOrder(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  payload: GuestOrderPayload
): Promise<GuestOrderResult> {
  const { session_id, ...checkout } = payload;
  const url = new URL("/api/v1/checkout", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Business-ID": website.business_id,
      "X-Session-ID": session_id,
    },
    body: JSON.stringify(checkout),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail ?? "";
    if (detail === "Cart is empty" || detail === "Cart not found") {
      throw new GuestOrderError("CART_NOT_FOUND", detail);
    }
    if (typeof detail === "object" && detail?.code === "OUT_OF_STOCK") {
      throw new GuestOrderError("OUT_OF_STOCK", "Some items are out of stock");
    }
    throw new GuestOrderError("SERVER_ERROR", String(detail || res.status));
  }

  const order = await res.json();
  return { orderId: order.id };
}