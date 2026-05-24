import type { APIRoute } from 'astro';
import { mergeGuestCart, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';
import { getWebsite, proximaConfig } from '../../../lib/proxima';

/**
 * POST /api/cart/merge
 *
 * Fusiona el carrito guest (session_id) con el carrito del buyer autenticado.
 * Llamar inmediatamente después de un login o registro exitoso, antes de redirigir.
 */
export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  // Si no hay token o no hay sesión guest, no hay nada que fusionar
  if (!token || !sessionId) {
    return Response.json({ ok: true, merged: false });
  }

  try {
    const website = await getWebsite();
    await mergeGuestCart(proximaConfig, website, { token, sessionId });

    // Limpiar la cookie de sesión guest tras fusionar
    cookies.delete('proxima_session', { path: '/' });

    return Response.json({ ok: true, merged: true });
  } catch {
    // Silenciar el error — mejor perder los items del carrito guest
    // que bloquear al usuario recién logueado
    return Response.json({ ok: true, merged: false });
  }
};
