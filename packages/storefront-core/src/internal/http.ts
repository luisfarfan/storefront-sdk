export function apiError(status: number, data: unknown): Error {
  return Object.assign(new Error(`Request failed: ${status}`), { status, data });
}

export function authHeaders(
  businessId: string,
  token?: string | null
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// Internal helper: builds the Accept-Language + X-Currency + X-Business-ID headers
export function storefrontHeaders(
  businessId: string,
  locale?: string,
  currency?: string,
): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (locale)   h["Accept-Language"] = locale;
  if (currency) h["X-Currency"] = currency;
  return h;
}

export function cartHeaders(businessId: string, token?: string | null, sessionId?: string | null): Record<string, string> {
  const h: Record<string, string> = { "X-Business-ID": businessId };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (sessionId && !token) h["X-Session-ID"] = sessionId;
  return h;
}