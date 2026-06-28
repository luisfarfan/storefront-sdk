import { describe, expect, it } from "vitest";
import {
  buildCanonicalUrl,
  buildHreflangAlternates,
} from "../src/seo/hreflang.js";

describe("buildCanonicalUrl", () => {
  it("omits prefix for default locale", () => {
    expect(buildCanonicalUrl("shop.example.com", "es", "/catalogo", "es")).toBe(
      "https://shop.example.com/catalogo",
    );
  });

  it("adds locale prefix for non-default locale", () => {
    expect(buildCanonicalUrl("shop.example.com", "en", "/catalog", "es")).toBe(
      "https://shop.example.com/en/catalog",
    );
  });

  it("handles home path for non-default locale", () => {
    expect(buildCanonicalUrl("shop.example.com", "en", "/", "es")).toBe(
      "https://shop.example.com/en",
    );
  });
});

describe("buildHreflangAlternates", () => {
  it("emits alternates for enabled locales and x-default", () => {
    const alternates = buildHreflangAlternates({
      domain: "shop.example.com",
      localizedPaths: { es: "/catalogo", en: "/catalog" },
      enabledLocales: ["es", "en"],
      defaultLocale: "es",
    });

    expect(alternates).toEqual([
      { hreflang: "es", href: "https://shop.example.com/catalogo" },
      { hreflang: "en", href: "https://shop.example.com/en/catalog" },
      { hreflang: "x-default", href: "https://shop.example.com/catalogo" },
    ]);
  });

  it("falls back to default locale path when locale path missing", () => {
    const alternates = buildHreflangAlternates({
      domain: "shop.example.com",
      localizedPaths: { es: "/nosotros" },
      enabledLocales: ["es", "en"],
      defaultLocale: "es",
    });

    expect(alternates.find((item) => item.hreflang === "en")?.href).toBe(
      "https://shop.example.com/en/nosotros",
    );
  });
});
