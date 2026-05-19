import { describe, expect, it } from "vitest";
import { validateTemplateManifest } from "../src/index.js";

const baseManifest = {
  template_key: "demo",
  name: "Demo",
  slug: "demo",
  category: "commerce",
  repository_config: { provider: "github", repo: "proxima/templates" },
  deployment_config: { runtime_kind: "managed_bundle", status: "ready" },
  section_types: [
    {
      key: "product_grid",
      label: "Product grid",
      renderer: "ProductGrid",
      attribute_schema: [
        {
          name: "products_collection",
          type: "smart_collection_id",
          localizable: false,
          config: { allowed_smart_collection_types: ["product_list"] },
        },
      ],
    },
  ],
  smart_collection_placeholders: [{ key: "featured_products", name: "Featured", type: "product_list" }],
  pages: [
    {
      name: "Home",
      path: "/",
      sections: [
        {
          name: "Products",
          type: "product_grid",
          values: { products_collection: { _smart_collection_placeholder: "featured_products" } },
        },
      ],
    },
  ],
};

describe("template manifest schema", () => {
  it("accepts a valid manifest", () => {
    expect(validateTemplateManifest(baseManifest).success).toBe(true);
  });

  it("rejects secrets in source metadata", () => {
    const result = validateTemplateManifest({
      ...baseManifest,
      repository_config: { provider: "github", github_token: "secret" },
    });

    expect(result.success).toBe(false);
    expect(String(result.error?.issues[0]?.message)).toContain("sensitive metadata");
  });

  it("rejects undeclared placeholders", () => {
    const result = validateTemplateManifest({
      ...baseManifest,
      smart_collection_placeholders: [],
    });

    expect(result.success).toBe(false);
    expect(String(result.error?.issues[0]?.message)).toContain("not declared");
  });

  it("rejects sections without declared section types", () => {
    const result = validateTemplateManifest({
      ...baseManifest,
      section_types: [],
    });

    expect(result.success).toBe(false);
  });
});
