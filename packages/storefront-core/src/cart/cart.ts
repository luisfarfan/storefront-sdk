import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type { Cart } from '../types/cart.js';
import type { CouponValidationResult } from '../types/catalog.js';

function cartContext(
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null },
) {
  return {
    businessId: website.business_id,
    token: params.token,
    sessionId: params.sessionId,
  };
}

/** Fetch the current cart. Works for both guest sessions and authenticated customers. */
export async function fetchCart(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null }
): Promise<Cart> {
  const client = createStorefrontClient(config);
  return client.get<Cart>(StorefrontEndpoints.cart.root(), cartContext(website, params));
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
  const client = createStorefrontClient(config);
  return client.post<Cart>(
    StorefrontEndpoints.cart.items(),
    { product_variant_id: params.variantId, quantity: params.quantity },
    cartContext(website, params),
  );
}

/** Update the quantity of an existing cart item. Set `quantity` to 0 to remove it. */
export async function updateCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const client = createStorefrontClient(config);
  return client.patch<Cart>(
    StorefrontEndpoints.cart.item(params.variantId),
    { quantity: params.quantity },
    cartContext(website, params),
  );
}

/** Remove a product variant from the cart entirely. */
export async function removeCartItem(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: ProximaWebsiteResponse,
  params: { token?: string | null; sessionId?: string | null; variantId: number }
): Promise<Cart> {
  const client = createStorefrontClient(config);
  return client.delete<Cart>(
    StorefrontEndpoints.cart.item(params.variantId),
    cartContext(website, params),
  );
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
  const client = createStorefrontClient(config);
  return client.post<Cart>(StorefrontEndpoints.cart.merge(), undefined, {
    businessId: website.business_id,
    token: params.token,
    headers: { 'X-Session-ID': params.sessionId },
  });
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
  const client = createStorefrontClient(config);
  return client.get<CouponValidationResult>(StorefrontEndpoints.commerce.validateCoupon(), {
    businessId: website.business_id,
    query: { code: params.code, amount: params.amount },
  });
}
