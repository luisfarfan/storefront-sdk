import { describe, expect, it } from "vitest";
import { validateWebsiteDeployManifest } from "../src/index.js";

const baseManifest = {
  schema_version: "1.0",
  section_types: [
    {
      key: "hero",
      label: "Hero",
      attribute_schema: [],
    },
  ],
  pages: [],
};

describe("website deploy manifest paths", () => {
  it("accepts pages with paths map", () => {
    const result = validateWebsiteDeployManifest({
      ...baseManifest,
      pages: [
        {
          resolver_kind: "content_page",
          paths: { es: "/catalogo", en: "/catalog" },
          label: "Catalog",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("preserves scaffold values and legacy default_values", () => {
    const result = validateWebsiteDeployManifest({
      ...baseManifest,
      section_types: [
        ...baseManifest.section_types,
        { key: "commerce_view", label: "Commerce", attribute_schema: [] },
      ],
      pages: [
        {
          resolver_kind: "cart",
          path: "/carrito",
          label: "Carrito",
          scaffold_sections: [
            {
              section_type: "commerce_view",
              order: 1,
              values: { heading: { es: "Tu carrito" } },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    const section = result.data?.pages[0]?.scaffold_sections?.[0];
    expect(section?.values).toEqual({ heading: { es: "Tu carrito" } });
  });

  it("rejects duplicate locale paths within manifest", () => {
    const result = validateWebsiteDeployManifest({
      ...baseManifest,
      pages: [
        {
          resolver_kind: "content_page",
          path: "/catalogo",
          label: "Catalog A",
        },
        {
          resolver_kind: "content_page",
          paths: { _: "/catalogo" },
          label: "Catalog B",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(String(result.error?.issues[0]?.message)).toContain("duplicate path");
  });
});
