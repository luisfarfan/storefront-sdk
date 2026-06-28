import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProximaRender } from "../src/cms/website.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchProximaRender locale forwarding", () => {
  it("passes locale query param and Accept-Language header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shell: { shell_sections: {} },
        page: { sections: [], requires_auth: false, not_found: false },
        bootstrap: { categories: [], brands: [] },
        website: { id: "ws-1", business_id: "biz-1", name: "Test", locale: "en", currency: "USD" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchProximaRender({
      baseUrl: "http://api.test",
      domain: "shop.localhost",
      path: "/catalog",
      serviceKey: "pxa_test_key",
      locale: "en",
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    const urlString = String(calledUrl);
    expect(urlString).toContain("locale=en");
    expect(urlString).toContain("path=%2Fcatalog");
    expect(init.headers).toMatchObject({
      "Accept-Language": "en",
      Authorization: "Bearer pxa_test_key",
    });
  });
});
