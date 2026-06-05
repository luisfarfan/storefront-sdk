export interface WishlistItem {
  id: number;
  customer_id: number;
  business_id: string;
  product_id: string;       // UUID — references catalog, no FK enforced
  variant_id: string | null;
  notes: string | null;
  added_at: string;         // ISO datetime
}