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
