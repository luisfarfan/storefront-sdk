import type { APIRoute } from 'astro';
import { processBuyerCheckout, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const context = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ ok: false, error: 'Debes iniciar sesión para completar la compra' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const order = await processBuyerCheckout(config, context, {
      token,
      address_id: body.address_id as number,
      delivery_mode: body.delivery_mode as 'delivery' | 'pickup',
      coupon_code: body.coupon_code as string | undefined,
      payment_method: body.payment_method as string,
    });

    return Response.json({ ok: true, order });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
