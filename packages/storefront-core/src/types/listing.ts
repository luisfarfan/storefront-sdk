import type { StorefrontFacetOption, StorefrontProductListingResponse } from './catalog.js';

export interface ProductListingFilters {
  brand?: string | null;
  category?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  in_stock?: boolean | null;
}

export type ProductListingSortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

/** @deprecated Use StorefrontFacetOption from the main listing types */
export type ProductFacet = StorefrontFacetOption;

/** @deprecated Use StorefrontProductListingResponse */
export type ProductListingResult = StorefrontProductListingResponse;