export interface GuestOrderPayload {
  session_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  shipping_address?: string | null;
  notes?: string | null;
}

export interface GuestOrderResult {
  orderId: string;
}

export class GuestOrderError extends Error {
  constructor(
    public readonly code: "CART_NOT_FOUND" | "OUT_OF_STOCK" | "SERVER_ERROR",
    message: string
  ) {
    super(message);
    this.name = "GuestOrderError";
  }
}