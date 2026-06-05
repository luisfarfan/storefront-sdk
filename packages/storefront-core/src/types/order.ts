export interface OrderItem {
  id: number;
  product_variant_id?: number | null;
  product_id?: number | null;
  product_slug?: string | null;
  product_image?: string | null;
  product_name?: string | null;
  brand_name?: string | null;
  category_name?: string | null;
  sku?: string | null;
  quantity: number;
  price_at_purchase?: number | null;
  /** @deprecated use price_at_purchase */
  unit_price?: number | null;
  /** @deprecated use product_name */
  name?: string | null;
}

/** An order placed by a customer. */
export interface Order {
  id: string;
  order_number?: string | null;
  status: string;
  total_amount?: number | null;
  currency?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: string | null;
  created_at: string;
  items?: OrderItem[];
  /** @deprecated use total_amount */
  total?: number;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
}