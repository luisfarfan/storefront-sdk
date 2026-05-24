import type { APIRoute } from 'astro';
import { processAddToCart, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const context = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { variant_id?: number; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { variant_id, quantity = 1 } = body;
  if (!variant_id) {
    return Response.json({ ok: false, error: 'variant_id requerido' }, { status: 422 });
  }

  const token = cookies.get(BUYER_COOKIE_NAME)?.value;

  // Crear session_id si no existe (para compradores anónimos)
  let sessionId = cookies.get('proxima_session')?.value;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookies.set('proxima_session', sessionId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  try {
    const cart = await processAddToCart(config, context, {
      token,
      session_id: sessionId,
      variant_id,
      quantity,
    });
    return Response.json({ ok: true, cart });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
