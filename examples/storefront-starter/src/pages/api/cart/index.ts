import type { APIRoute } from 'astro';
import { processGetCart, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const context = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  try {
    const cart = await processGetCart(config, context, { token, session_id: sessionId });
    return Response.json(cart);
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 500 });
  }
};
