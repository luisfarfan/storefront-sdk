import type { APIRoute } from 'astro';
import {
  fetchBuyerProfile,
  updateBuyerProfile,
  BUYER_COOKIE_NAME,
} from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const ctx    = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

/**
 * GET /api/buyer/profile
 * Devuelve el perfil del buyer autenticado.
 * El middleware ya validó el token y lo guardó en locals.buyer.
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.buyer) {
    return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  return Response.json({ ok: true, buyer: locals.buyer });
};

/**
 * PATCH /api/buyer/profile
 * Actualiza campos del perfil. Solo se actualizan los campos enviados.
 */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) {
    return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Campos permitidos para actualizar
  const allowed = ['first_name', 'last_name', 'phone', 'accept_marketing'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return Response.json({ ok: false, error: 'No hay campos válidos para actualizar' }, { status: 422 });
  }

  try {
    const buyer = await updateBuyerProfile(config, ctx, { token, ...updates });
    return Response.json({ ok: true, buyer });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e.data?.detail ?? 'Error al actualizar el perfil' },
      { status: e.status ?? 400 }
    );
  }
};
