/** A line item inside a Cart. */
export interface CartItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  metadata?: {
    name?: string | null;
    slug?: string | null;
    brand?: string | null;
    image?: string | null;
    unit_price?: number | null;
    unit_price_string?: string | null;
  } | null;
}

export interface CartTotals {
  subtotal: number;
  formatted_subtotal: string;
  currency: string;
}

/** Shopping cart for a guest session or authenticated customer. */
export interface Cart {
  id: string;
  session_id?: string | null;
  customer_id?: number | null;
  items: CartItem[];
  totals: CartTotals;
}

/** Customer and shipping details submitted at checkout. */
export interface CheckoutRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  customer_doc_type?: number | null;
  customer_doc_number?: string | null;
  address_id?: number | null;
}