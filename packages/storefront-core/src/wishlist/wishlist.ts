import { apiError, authHeaders } from '../internal/http.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import type { WishlistItem } from '../types/wishlist.js';

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

/**
 * Fetch all wishlist items for the authenticated customer.
 * Returns an empty array if the wishlist is empty.
 */
export async function fetchWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<WishlistItem[]> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Add a product to the wishlist. Idempotent — if the product is already
 * in the wishlist, returns the existing item without creating a duplicate.
 */
export async function addToWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: {
    token: string;
    productId: string;
    variantId?: string | null;
    notes?: string | null;
  }
): Promise<WishlistItem> {
  const url = new URL("/api/v1/store/me/wishlist", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify({
      product_id: params.productId,
      variant_id: params.variantId ?? null,
      notes: params.notes ?? null,
    }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Remove a product from the wishlist.
 * Throws { status: 404 } if the product was not in the wishlist.
 */
export async function removeFromWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; productId: string }
): Promise<void> {
  const url = new URL(`/api/v1/store/me/wishlist/${params.productId}`, config.baseUrl);
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}