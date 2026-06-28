import { describe, expect, it, vi } from "vitest";
import { generateSitemapXml } from "../src/seo/sitemap.js";
import {
  fetchBrandsDirectory,
  fetchCategoryNavTree,
  fetchStorefrontProducts,
} from "../src/catalog/listings.js";

vi.mock("../src/catalog/listings.js", () => ({
  fetchCategoryNavTree: vi.fn().mockRejectedValue(new Error("offline")),
  fetchBrandsDirectory: vi.fn().mockRejectedValue(new Error("offline")),
  fetchStorefrontProducts: vi.fn().mockRejectedValue(new Error("offline")),
}));

describe("generateSitemapXml multilocale", () => {
  it("emits one url per locale when localized_paths is present", async () => {
    const xml = await generateSitemapXml(
      {
        domain: "shop.example.com",
        default_locale: "es",
        enabled_locales: ["es", "en"],
        pages: [
          {
            resolver_kind: "content_page",
            path: "/catalogo",
            localized_paths: { es: "/catalogo", en: "/catalog" },
          },
        ],
      },
      "http://localhost:8000",
    );

    expect(xml).toContain("https://shop.example.com/catalogo");
    expect(xml).toContain("https://shop.example.com/en/catalog");
  });

  it("keeps legacy single-path fallback", async () => {
    const xml = await generateSitemapXml(
      {
        domain: "shop.example.com",
        pages: [{ resolver_kind: "content_page", path: "/about" }],
      },
      "http://localhost:8000",
    );

    expect(xml).toContain("https://shop.example.com/about");
    expect(xml).not.toContain("/en/about");
  });

  it("emits bilingual product URLs when engine paths are configured", async () => {
    vi.mocked(fetchStorefrontProducts).mockResolvedValueOnce({
      items: [{ slug: "g502", name: "G502" }],
      pagination: { page: 1, page_size: 60, total: 1, total_pages: 1 },
    } as any);

    const xml = await generateSitemapXml(
      {
        domain: "shop.example.com",
        default_locale: "es",
        enabled_locales: ["es", "en"],
        pages: [
          {
            resolver_kind: "product_detail",
            path: "/producto/{slug}",
            localized_paths: { es: "/producto/{slug}", en: "/product/{slug}" },
          },
        ],
      },
      "http://localhost:8000",
    );

    expect(xml).toContain("https://shop.example.com/producto/g502");
    expect(xml).toContain("https://shop.example.com/en/product/g502");
  });
});
