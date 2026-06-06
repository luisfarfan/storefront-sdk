import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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
  const client = createStorefrontClient(config);

  try {
    const order = await client.post<{ id: string }>(
      StorefrontEndpoints.checkout(),
      checkout,
      {
        businessId: website.business_id,
        sessionId: session_id,
      },
    );
    return { orderId: order.id };
  } catch (e) {
    const err = e as Error & { data?: { detail?: unknown } };
    const detail = err.data?.detail ?? "";
    if (detail === "Cart is empty" || detail === "Cart not found") {
      throw new GuestOrderError("CART_NOT_FOUND", detail);
    }
    if (typeof detail === "object" && detail !== null && (detail as { code?: string }).code === "OUT_OF_STOCK") {
      throw new GuestOrderError("OUT_OF_STOCK", "Some items are out of stock");
    }
    throw new GuestOrderError("SERVER_ERROR", String(detail || (err as Error & { status?: number }).status));
  }
}
