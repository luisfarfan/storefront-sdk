import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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
  const client = createStorefrontClient(config);
  return client.get<WishlistItem[]>(StorefrontEndpoints.buyer.wishlist(), {
    businessId: website.business_id,
    token: params.token,
  });
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
  const client = createStorefrontClient(config);
  return client.post<WishlistItem>(
    StorefrontEndpoints.buyer.wishlist(),
    {
      product_id: params.productId,
      variant_id: params.variantId ?? null,
      notes: params.notes ?? null,
    },
    {
      businessId: website.business_id,
      token: params.token,
    },
  );
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
  const client = createStorefrontClient(config);
  await client.delete(StorefrontEndpoints.buyer.wishlistItem(params.productId), {
    businessId: website.business_id,
    token: params.token,
  });
}
