import type { APIRoute } from 'astro';
import { validateCoupon } from '@proxima-io/storefront-core';
import { getWebsite, proximaConfig } from '../../../lib/proxima';

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code');
  const amount = Number(url.searchParams.get('amount') ?? '0');

  if (!code) {
    return Response.json({ ok: false, error: 'Código de cupón requerido' }, { status: 400 });
  }

  try {
    const website = await getWebsite();
    const result = await validateCoupon(proximaConfig, website, { code, amount });
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
