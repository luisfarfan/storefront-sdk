import { apiError, cartHeaders } from '../internal/http.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type { Cart } from '../types/cart.js';
import type { CouponValidationResult } from '../types/catalog.js';

/** Fetch the current cart. Works for both guest sessions and authenticated customers. */
export async function fetchCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null }
): Promise<Cart> {
  const url = new URL("/api/v1/cart", config.baseUrl);
  const res = await fetch(url, { headers: cartHeaders(website.business_id, params.token, params.sessionId) });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product variant to the cart. Use `StorefrontProductSummary.default_variant_id`
 * as `variantId` when adding from a listing card.
 */
export async function addToCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/items", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token, params.sessionId) },
    body: JSON.stringify({ product_variant_id: params.variantId, quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Update the quantity of an existing cart item. Set `quantity` to 0 to remove it. */
export async function updateCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cartHeaders(website.business_id, params.token, params.sessionId) },
    body: JSON.stringify({ quantity: params.quantity }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Remove a product variant from the cart entirely. */
export async function removeCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number }
): Promise<Cart> {
  const url = new URL(`/api/v1/cart/items/${params.variantId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: cartHeaders(website.business_id, params.token, params.sessionId),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Merge a guest cart (identified by session ID) into the authenticated customer's cart.
 * Call this immediately after a successful login if there is an active guest session.
 *
 * @example
 * const sessionId = localStorage.getItem('proxima_session_id');
 * if (sessionId) await mergeGuestCart(config, website, { token, sessionId });
 */
export async function mergeGuestCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token: string; sessionId: string }
): Promise<Cart> {
  const url = new URL("/api/v1/cart/merge", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Business-ID": website.business_id,
      "X-Session-ID": params.sessionId,
      "Authorization": `Bearer ${params.token}`,
    },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Validate a coupon code before checkout. Always resolves — check `result.valid`.
 * Use the `discount_amount` from the result to preview the discount in the UI.
 *
 * @example
 * const result = await validateCoupon(config, website, { code: 'PROMO10', amount: 150.00 });
 * if (result.valid) showDiscount(result.discount_amount);
 * else showError(result.error);
 */
export async function validateCoupon(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { code: string; amount: number }
): Promise<CouponValidationResult> {
  const url = new URL("/api/v1/commerce/coupons/validate", config.baseUrl);
  url.searchParams.set("code", params.code);
  url.searchParams.set("amount", String(params.amount));
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}