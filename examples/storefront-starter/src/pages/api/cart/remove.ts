import type { APIRoute } from 'astro';
import { processRemoveCartItem, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const context = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

export const DELETE: APIRoute = async ({ request, cookies }) => {
  let body: { item_id?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { item_id } = body;
  if (!item_id) {
    return Response.json({ ok: false, error: 'item_id requerido' }, { status: 422 });
  }

  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  try {
    const cart = await processRemoveCartItem(config, context, {
      token,
      session_id: sessionId,
      item_id,
    });
    return Response.json({ ok: true, cart });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
