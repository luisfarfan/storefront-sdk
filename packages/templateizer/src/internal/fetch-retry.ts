export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(url, init);
      if (res.status < 500 || i === attempts - 1) return res;
      await new Promise<void>((r) => setTimeout(r, 500 * 2 ** i));
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      await new Promise<void>((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastError ?? new Error('fetch failed after retries');
}
