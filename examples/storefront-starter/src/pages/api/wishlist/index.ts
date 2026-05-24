import type { APIRoute } from 'astro';
import {
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
  BUYER_COOKIE_NAME,
} from '@proxima-io/storefront-core';

const config = { baseUrl: import.meta.env.PROXIMA_API_URL };
const ctx = { business_id: import.meta.env.PROXIMA_BUSINESS_ID };

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ items: [] });

  try {
    const wishlist = await fetchWishlist(config, { ...ctx, token });
    return Response.json(wishlist);
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  const { product_id } = await request.json();

  try {
    await addToWishlist(config, { ...ctx, token }, { product_id });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  const { product_id } = await request.json();

  try {
    await removeFromWishlist(config, { ...ctx, token }, { product_id });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
