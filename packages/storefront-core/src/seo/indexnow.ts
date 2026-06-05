// ---------------------------------------------------------------------------
// IndexNow — real-time URL change notifications
// ---------------------------------------------------------------------------

/**
 * Submit a list of changed URLs to the IndexNow API.
 *
 * IndexNow notifies Bing, Yandex, and (increasingly) Google about new or
 * updated pages so they are re-crawled within seconds instead of waiting for
 * the next sitemap crawl.
 *
 * **Setup (one-time per storefront):**
 * 1. Generate or reuse the key from `PROXIMA_INDEXNOW_KEY` env var.
 * 2. Serve `GET /{key}.txt` returning the key as plain text — see the scaffold
 *    template at `src/pages/[indexnow_key].txt.ts`.
 * 3. That's it — IndexNow verifies the key automatically on first submission.
 *
 * @param apiKey   Your IndexNow key (platform-level; served at `/{apiKey}.txt`)
 * @param siteUrl  Absolute origin of the site, e.g. `https://example.com`
 * @param urls     Absolute URLs that changed (max 10 000 per call)
 *
 * @example
 * await notifyIndexNow("my-secret-key", "https://214store.com", [
 *   "https://214store.com/producto/laptop-gamer",
 * ]);
 */
export async function notifyIndexNow(
  apiKey: string,
  siteUrl: string,
  urls: string[]
): Promise<void> {
  if (!apiKey || urls.length === 0) return;

  const host = new URL(siteUrl).hostname;
  const payload = {
    host,
    key: apiKey,
    keyLocation: `${siteUrl}/${apiKey}.txt`,
    urlList: urls,
  };

  try {
    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok && resp.status !== 202) {
      console.warn(`[IndexNow] Submission returned ${resp.status} for ${host}`);
    }
  } catch (err) {
    console.warn(`[IndexNow] Submission failed for ${host}:`, err);
  }
}